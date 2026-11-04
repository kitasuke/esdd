// Graph walk: drive an implementation through the IR's state machine and compare, in every state
// it reaches, what the implementation offers with what the IR allows.
// Scenarios check the paths someone wrote down; the walk checks every cell it can reach. In each
// stable state it probes every event the target fires from a screen:
//   - a transition the implementation does not offer is a liveness violation (it refuses what it must accept)
//   - an impossible event the implementation offers is a safety violation (it allows what it must not)
//   - after an event, a screen that does not show the state the IR leads to is a safety violation
// Then it fires an event it has not covered yet, and resets to the initial state when it reaches a
// terminal state or has nothing left to cover from where it is (docs/generation.md "Graph walk").

import { type Cell, type Model, cellKey } from "./types.ts";

/**
 * What the walk drives. The same walk runs on any layer: an integration target backs it with a fake
 * backend, an E2E target with the real system. Every method returns once the screen is stable — a
 * timer still pending or a request still in flight is not stable, and probing before it misjudges
 * what is offered.
 */
export interface WalkTarget {
  /**
   * The events fired from a screen. They are probed in every state. Other events (actor: system, an
   * event from another device) cannot be refused by a screen, so they are only fired where the IR
   * has a transition or an ignored cell for them
   */
  uiEvents: readonly string[];
  /** Starts a new instance in the IR's initial state */
  reset(): Promise<void>;
  /** Whether the event's control is offered now. Hidden or disabled is not offered; a control that answers with an error is offered */
  offered(event: string): Promise<boolean>;
  /** Fires the event. `to` is the state the IR leads to (a fake backend may need it); absent for an ignored cell */
  fire(event: string, step: { from: string; to?: string }): Promise<void>;
  /** Whether the screen shows the state. undefined when nothing observable tells it apart: reported, never counted as a pass */
  shows(state: string): Promise<boolean | undefined>;
}

export interface WalkOptions {
  /** Upper bound on fired events over all runs (default 200) */
  maxSteps?: number;
  /** Seed for choosing among cells not covered yet (default 1). The same seed walks the same way */
  seed?: number;
}

export interface Violation {
  kind: "liveness" | "safety";
  state: string;
  event: string;
  /** The events fired since the last reset, the reproduction from the initial state */
  trace: string[];
  message: string;
}

export interface WalkReport {
  violations: Violation[];
  /** Transition and ignored cells fired, as `<from> <event>` */
  covered: string[];
  /** Transition and ignored cells never fired */
  uncovered: string[];
  /** Cells whose offer was probed against the IR, as `<state> <event>` */
  probed: string[];
  /** States the walk could not observe (WalkTarget.shows returned undefined) */
  unobservable: string[];
  steps: number;
  runs: number;
}

export type Offer = "offered" | "refused" | "either";

/**
 * What the IR says the screen must do with the event in the state. A terminal state has no
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
  const maxSteps = options.maxSteps ?? 200;
  const next = random(options.seed ?? 1);
  const ui = new Set(target.uiEvents);
  const cells = firableCells(model);
  const covered = new Set<string>();
  const probed = new Set<string>();
  const unobservable = new Set<string>();
  const violations: Violation[] = [];
  // Each defect once, with the shortest reproduction found (the first one)
  const report = (v: Violation) => {
    if (!violations.some((w) => w.kind === v.kind && w.state === v.state && w.event === v.event)) violations.push(v);
  };
  let steps = 0;
  let runs = 0;

  // false when the screen shows something else: the walk no longer knows where it is
  const observe = async (state: string, trace: string[], event: string): Promise<boolean> => {
    const shown = await target.shows(state);
    if (shown === undefined) unobservable.add(state);
    if (shown !== false) return true;
    report({ kind: "safety", state, event, trace, message: `after ${event} the screen does not show ${state}` });
    return false;
  };

  while (steps < maxSteps) {
    const coveredBefore = covered.size;
    await target.reset();
    runs++;
    let state = model.initial;
    const trace: string[] = [];
    if (!(await observe(state, trace, "reset"))) break;

    while (steps < maxSteps) {
      const offered = new Map<string, boolean>();
      for (const event of ui) {
        const expected = expectedOffer(model, state, event);
        if (expected === undefined) continue;
        const actual = await target.offered(event);
        offered.set(event, actual);
        probed.add(cellKey(state, event));
        if (expected === "offered" && !actual) {
          report({ kind: "liveness", state, event, trace: [...trace], message: `${event} is not offered in ${state}, where the IR has a transition` });
        } else if (expected === "refused" && actual) {
          report({ kind: "safety", state, event, trace: [...trace], message: `${event} is offered in ${state}, where the IR declares it impossible` });
        }
      }
      if (model.states.get(state)?.terminal) break;

      const here = cells.filter((c) => c.from === state && (!ui.has(c.on) || offered.get(c.on) === true));
      const fresh = here.filter((c) => !covered.has(cellKey(c.from, c.on)));
      const toward = towardUncovered(cells, state, covered);
      const cell = fresh.length > 0 ? fresh[Math.floor(next() * fresh.length)] : here.find((c) => c.on === toward);
      if (cell === undefined) break;

      await target.fire(cell.on, { from: state, to: cell.to });
      steps++;
      covered.add(cellKey(cell.from, cell.on));
      trace.push(cell.on);
      state = cell.to ?? state;
      if (!(await observe(state, [...trace], cell.on))) break;
    }
    // A run that covered nothing new will not cover anything on the next one either
    if (covered.size === coveredBefore || covered.size === cells.length) break;
  }

  const keys = cells.map((c) => cellKey(c.from, c.on));
  return {
    violations,
    covered: keys.filter((k) => covered.has(k)),
    uncovered: keys.filter((k) => !covered.has(k)),
    probed: [...probed],
    unobservable: [...unobservable],
    steps,
    runs,
  };
}

/** The report as lines for a test log */
export function renderWalkReport(report: WalkReport): string {
  const lines = [
    `graph walk: ${report.steps} steps over ${report.runs} runs — ${report.covered.length}/${report.covered.length + report.uncovered.length} cells fired, ${report.probed.length} offers probed, ${report.violations.length} violations`,
  ];
  for (const v of report.violations) lines.push(`  ${v.kind}: ${v.message} (from the initial state: ${v.trace.join(" → ") || "nothing fired"})`);
  if (report.uncovered.length > 0) lines.push(`  not fired: ${report.uncovered.join(", ")}`);
  if (report.unobservable.length > 0) lines.push(`  not observable, not checked: ${report.unobservable.join(", ")}`);
  return lines.join("\n");
}
