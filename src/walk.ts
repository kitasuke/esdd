// Graph walk: drive an implementation through the IR's state machine and compare, in every state
// it reaches, what the implementation accepts with what the IR allows.
// Scenarios check the paths someone wrote down; the walk checks every cell it can reach. In each
// stable state it probes the events the target can probe:
//   - a transition the implementation refuses is a liveness violation (it refuses what it must accept)
//   - an impossible event the implementation accepts is a safety violation (it allows what it must not)
//   - after an event, a state other than the one the IR leads to is a safety violation
// Then it fires an event it has not covered yet, and starts a new run when it reaches a terminal
// state or has nothing left to cover from where it is (docs/generation.md "Graph walk").
//
// Two kinds of target. A screen answers "is this control offered?" without changing anything, so
// every event is probed in every state. An API has no such question: the only probe is sending the
// request. An API target therefore attempts each event the IR declares impossible (it must be
// refused and leave the state as it was), and checks a transition when it fires it.

import { type Cell, type Model, cellKey } from "./types.ts";

interface TargetBase {
  /**
   * The events the target can probe: a screen's controls, an API's operations. Other events
   * (actor: system, an event from another device) cannot be refused by the target, so they are only
   * fired where the IR has a transition or an ignored cell for them
   */
  probes: readonly string[];
  /** Starts a new instance in the IR's initial state */
  reset(): Promise<void>;
  /**
   * Optional: builds an instance directly in the state (fixtures on a real database, say). With it,
   * a run can start next to a cell not covered yet instead of walking there from the initial state.
   * It shortens walks, but a state built directly has no history, so the walk still starts its
   * first run from the initial state and keeps walking from every state it lands in
   */
  resetTo?(state: string): Promise<void>;
  /** Fires an event that is not probed. `to` is the state the IR leads to (a fake backend may need it); absent for an ignored cell */
  fire(event: string, step: { from: string; to?: string }): Promise<void>;
  /** Whether the instance is in the state. undefined when nothing observable tells it apart: reported, never counted as a pass */
  shows(state: string): Promise<boolean | undefined>;
}

/**
 * A screen. Every method returns once the screen is stable — a timer still pending or a request still
 * in flight is not stable, and probing before it misjudges what is offered.
 */
export interface ScreenTarget extends TargetBase {
  /** Whether the event's control is offered now. Hidden or disabled is not offered; a control that answers with an error is offered */
  offered(event: string): Promise<boolean>;
  /** Fires any event, probed or not */
  fire(event: string, step: { from: string; to?: string }): Promise<void>;
}

/**
 * The outcome of sending an event's request. "refused" is a rejection the bindings name for the
 * operation (its `refused` codes); anything else that is not a success (a server error, a timeout, an
 * unknown code) is `failed`, so an outage never reads as a refusal
 */
export type Attempt = "accepted" | "refused" | { failed: string };

/** An API. Probing an event sends its request, so the state can change */
export interface ApiTarget extends TargetBase {
  /** Sends the event's request. `to` is the state the IR leads to, absent when the IR does not allow the event */
  attempt(event: string, step: { from: string; to?: string }): Promise<Attempt>;
}

export type WalkTarget = ScreenTarget | ApiTarget;

export interface WalkOptions {
  /** Upper bound on fired events and attempted requests over all runs (default 200) */
  maxSteps?: number;
  /** Seed for choosing among cells not covered yet (default 1). The same seed walks the same way */
  seed?: number;
}

/** Where a reproduction starts: the initial state, or a state the target built directly (resetTo) */
export interface Start {
  state: string;
  direct: boolean;
}

export interface Violation {
  kind: "liveness" | "safety";
  state: string;
  event: string;
  start: Start;
  /** The events since the run started, the reproduction. An attempt the target refused is marked "(refused)" */
  trace: string[];
  message: string;
}

/** An attempt that neither succeeded nor was refused: the walk cannot judge the cell, and stops the run */
export interface Inconclusive {
  state: string;
  event: string;
  start: Start;
  trace: string[];
  message: string;
}

export interface WalkReport {
  violations: Violation[];
  inconclusive: Inconclusive[];
  /** Transition and ignored cells fired, as `<from> <event>` */
  covered: string[];
  /** Transition and ignored cells never fired */
  uncovered: string[];
  /** Cells whose acceptance was probed against the IR, as `<state> <event>` */
  probed: string[];
  /** States the walk could not observe (shows returned undefined) */
  unobservable: string[];
  steps: number;
  runs: number;
}

export type Offer = "offered" | "refused" | "either";

/**
 * What the IR says the target must do with the event in the state. A terminal state has no
 * transitions, so an event it does not declare is refused. undefined for an undeclared or
 * nondeterministic cell (the checker reports those)
 */
export function expectedOffer(model: Model, state: string, event: string): Offer | undefined {
  const cells = model.cells.get(cellKey(state, event));
  if (cells === undefined) return model.states.get(state)?.terminal ? "refused" : undefined;
  if (cells.length !== 1) return undefined;
  const [cell] = cells as [Cell];
  if (cell.ignored) return "either";
  return cell.impossible ? "refused" : "offered";
}

/** The cells the walk fires: transitions and ignored cells (an ignored cell is fired to check that nothing changes) */
function firableCells(model: Model): Cell[] {
  const out: Cell[] = [];
  for (const list of model.cells.values()) {
    if (list.length !== 1) continue;
    const [cell] = list as [Cell];
    if (!cell.impossible || cell.ignored) out.push(cell);
  }
  return out;
}

/** First event of the shortest route, over transitions, from the state to a state with an uncovered cell */
function towardUncovered(cells: Cell[], from: string, covered: Set<string>): string | undefined {
  const queue: { state: string; first?: string }[] = [{ state: from }];
  const visited = new Set([from]);
  while (queue.length > 0) {
    const { state, first } = queue.shift()!;
    if (first !== undefined && cells.some((c) => c.from === state && !covered.has(cellKey(c.from, c.on)))) return first;
    for (const c of cells) {
      if (c.from !== state || c.to === undefined || visited.has(c.to)) continue;
      visited.add(c.to);
      queue.push({ state: c.to, first: first ?? c.on });
    }
  }
  return undefined;
}

// mulberry32: a small seeded generator, so a walk can be replayed
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function walk(model: Model, target: WalkTarget, options: WalkOptions = {}): Promise<WalkReport> {
  if (!model.hasStateMachine || model.initial === undefined) throw new Error("the graph walk needs an IR with states");
  const initial = model.initial;
  const maxSteps = options.maxSteps ?? 200;
  const next = random(options.seed ?? 1);
  const pick = <T>(list: T[]): T | undefined => list[Math.floor(next() * list.length)];
  const api = "attempt" in target ? target : undefined;
  const screen = "offered" in target ? target : undefined;
  const probes = new Set(target.probes);
  const cells = firableCells(model);
  const covered = new Set<string>();
  const probed = new Set<string>();
  const unobservable = new Set<string>();
  const violations: Violation[] = [];
  const inconclusive: Inconclusive[] = [];
  // API cells already judged a violation or inconclusive: attempting them again would end every
  // later run at the same place, so the rest of the graph would never be walked
  const settled = new Set<string>();
  let steps = 0;
  let runs = 0;

  while (steps < maxSteps) {
    const coveredBefore = covered.size;
    // Later runs start next to an uncovered cell when the target can build that state
    const jump = runs > 0 && target.resetTo !== undefined ? pick(cells.filter((c) => !covered.has(cellKey(c.from, c.on))))?.from : undefined;
    const start: Start = { state: jump ?? initial, direct: jump !== undefined };
    await (jump !== undefined ? target.resetTo!(jump) : target.reset());
    runs++;
    let state = start.state;
    const trace: string[] = [];

    // Each defect once, with the first reproduction found
    const report = (kind: Violation["kind"], event: string, message: string) => {
      if (!violations.some((v) => v.kind === kind && v.state === state && v.event === event)) {
        violations.push({ kind, state, event, start, trace: [...trace], message });
      }
    };
    const fail = (event: string, failed: { failed: string }) =>
      inconclusive.push({ state, event, start, trace: [...trace], message: `${event} in ${state} neither succeeded nor was refused: ${failed.failed}` });
    // false when the instance is somewhere else: the walk no longer knows where it is
    const observe = async (after: string, expected: string): Promise<boolean> => {
      const shown = await target.shows(expected);
      if (shown === undefined) unobservable.add(expected);
      if (shown !== false) return true;
      state = expected;
      report("safety", after, `after ${after} the instance is not in ${expected}`);
      return false;
    };
    if (!(await observe(start.direct ? "resetTo" : "reset", state))) break;

    run: while (steps < maxSteps) {
      // Probe
      const offered = new Map<string, boolean>();
      for (const event of probes) {
        const expected = expectedOffer(model, state, event);
        if (expected === undefined) continue;
        if (screen) {
          const actual = await screen.offered(event);
          offered.set(event, actual);
          probed.add(cellKey(state, event));
          if (expected === "offered" && !actual) report("liveness", event, `${event} is not offered in ${state}, where the IR has a transition`);
          else if (expected === "refused" && actual) report("safety", event, `${event} is offered in ${state}, where the IR declares it impossible`);
        } else if (api && expected !== "offered" && !settled.has(cellKey(state, event))) {
          // A transition is checked when it is fired; probing it here would move the state
          const result = await api.attempt(event, { from: state });
          steps++;
          probed.add(cellKey(state, event));
          if (expected === "either") covered.add(cellKey(state, event));
          if (typeof result === "object") {
            settled.add(cellKey(state, event));
            fail(event, result);
            break run;
          }
          if (result === "accepted" && expected === "refused") {
            settled.add(cellKey(state, event));
            report("safety", event, `${event} is accepted in ${state}, where the IR declares it impossible`);
            break run;
          }
          trace.push(result === "refused" ? `${event} (refused)` : event);
          if (!(await observe(event, state))) break run;
        }
      }
      if (model.states.get(state)?.terminal) break;

      // Fire
      const here = cells.filter(
        (c) => c.from === state && (!probes.has(c.on) || (screen ? offered.get(c.on) === true : c.to !== undefined)),
      );
      const fresh = here.filter((c) => !covered.has(cellKey(c.from, c.on)));
      const toward = towardUncovered(cells, state, covered);
      const cell = fresh.length > 0 ? pick(fresh) : here.find((c) => c.on === toward);
      if (cell === undefined) break;

      steps++;
      covered.add(cellKey(cell.from, cell.on));
      if (api && probes.has(cell.on)) {
        const result = await api.attempt(cell.on, { from: state, to: cell.to });
        if (typeof result === "object") {
          fail(cell.on, result);
          break;
        }
        if (result === "refused") {
          report("liveness", cell.on, `${cell.on} is refused in ${state}, where the IR has a transition`);
          trace.push(`${cell.on} (refused)`);
          continue;
        }
      } else {
        await target.fire(cell.on, { from: state, to: cell.to });
      }
      trace.push(cell.on);
      const to = cell.to ?? state;
      if (!(await observe(cell.on, to))) break;
      state = to;
    }
    // A run that covered nothing new will not cover anything on the next one either
    if (covered.size === coveredBefore || covered.size === cells.length) break;
  }

  const keys = cells.map((c) => cellKey(c.from, c.on));
  return {
    violations,
    inconclusive,
    covered: keys.filter((k) => covered.has(k)),
    uncovered: keys.filter((k) => !covered.has(k)),
    probed: [...probed],
    unobservable: [...unobservable],
    steps,
    runs,
  };
}

function reproduction(start: Start, trace: string[]): string {
  const from = start.direct ? `${start.state}, built directly` : start.state;
  return `from ${from}: ${trace.join(" → ") || "nothing fired"}`;
}

/** The report as lines for a test log */
export function renderWalkReport(report: WalkReport): string {
  const lines = [
    `graph walk: ${report.steps} steps over ${report.runs} runs — ${report.covered.length}/${report.covered.length + report.uncovered.length} cells fired, ${report.probed.length} cells probed, ${report.violations.length} violations`,
  ];
  for (const v of report.violations) lines.push(`  ${v.kind}: ${v.message} (${reproduction(v.start, v.trace)})`);
  for (const i of report.inconclusive) lines.push(`  inconclusive: ${i.message} (${reproduction(i.start, i.trace)})`);
  if (report.uncovered.length > 0) lines.push(`  not fired: ${report.uncovered.join(", ")}`);
  if (report.unobservable.length > 0) lines.push(`  not observable, not checked: ${report.unobservable.join(", ")}`);
  return lines.join("\n");
}
