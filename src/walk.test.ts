import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIR } from "./parse.ts";
import type { Model } from "./types.ts";
import { type ApiTarget, type ScreenTarget, expectedOffer, renderWalkReport, walk } from "./walk.ts";

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`could not parse the IR: ${JSON.stringify(findings)}`);
  return model;
}

const ORDER = model(readFileSync(new URL("../examples/order-cancel.usecase.yaml", import.meta.url), "utf8"));

type Status = "PLACED" | "PACKED" | "HANDED_OVER" | "COMPLETED" | "CANCELED";

// An implementation of the order example written by hand, not derived from the IR: which control
// each status offers, and where each event leads. Tests break one entry to plant a defect
interface Implementation {
  offers: Record<string, Status[]>;
  leadsTo: Record<string, Partial<Record<Status, Status>>>;
  /** Status text per status; a status without one cannot be told apart on the screen */
  text: Partial<Record<Status, string>>;
}

const CORRECT: Implementation = {
  offers: { pack: ["PLACED"], hand_over: ["PACKED"], cancel: ["PLACED", "PACKED"] },
  leadsTo: {
    pack: { PLACED: "PACKED" },
    hand_over: { PACKED: "HANDED_OVER" },
    cancel: { PLACED: "CANCELED", PACKED: "CANCELED" },
    complete: { HANDED_OVER: "COMPLETED" },
  },
  text: { PACKED: "Packed", HANDED_OVER: "Shipped", COMPLETED: "Delivered", CANCELED: "Canceled" },
};

function target(impl: Implementation): ScreenTarget & { fired: string[] } {
  let status: Status = "PLACED";
  const fired: string[] = [];
  return {
    fired,
    probes: ["pack", "hand_over", "cancel"],
    reset: async () => void (status = "PLACED"),
    offered: async (event) => impl.offers[event]?.includes(status) ?? false,
    fire: async (event) => {
      fired.push(event);
      status = impl.leadsTo[event]?.[status] ?? status;
    },
    shows: async (state) => {
      const expected = impl.text[state as Status];
      return expected === undefined ? undefined : impl.text[status] === expected;
    },
  };
}

describe("expectedOffer", () => {
  it("reads transitions as offered, impossible cells as refused, and ignored cells as either", () => {
    expect(expectedOffer(ORDER, "PLACED", "pack")).toBe("offered");
    expect(expectedOffer(ORDER, "HANDED_OVER", "cancel")).toBe("refused");
    const ignored = model(`
usecase: UC-TEST-001
name: t
source: { spec: "https://example.com/spec" }
initial: A
states: [{ id: A }, { id: B, terminal: true }]
events: [{ id: go, actor: user }, { id: again, actor: user }]
transitions:
  - { from: A, on: go, to: B, outcome: ["B"] }
  - { from: A, on: again, ignored: true, reason: a repeated press changes nothing }
  - { from: B, on: [go, again], impossible: true, reason: done }
scenarios: [{ id: SC-001, name: go, path: [go] }]
`);
    expect(expectedOffer(ignored, "A", "again")).toBe("either");
  });
});

describe("walk", () => {
  it("fires every transition of a conforming implementation without violations", async () => {
    const report = await walk(ORDER, target(CORRECT));
    expect(report.violations).toEqual([]);
    expect(report.uncovered).toEqual([]);
    expect(report.covered).toHaveLength(5);
    // Every UI event is probed in every state, terminal states included
    expect(report.probed).toHaveLength(5 * 3);
    // No status text for PLACED: reported as unobservable, not as a pass
    expect(report.unobservable).toEqual(["PLACED"]);
    expect(report.stopped).toBe("covered");
  });

  it("reports an impossible event the implementation offers as a safety violation, with its reproduction", async () => {
    const leaky = { ...CORRECT, offers: { ...CORRECT.offers, cancel: ["PLACED", "PACKED", "HANDED_OVER"] as Status[] } };
    const report = await walk(ORDER, target(leaky));
    expect(report.violations).toEqual([
      {
        kind: "safety",
        state: "HANDED_OVER",
        event: "cancel",
        start: { state: "PLACED", direct: false },
        trace: ["pack", "hand_over"],
        message: "cancel is offered in HANDED_OVER, where the IR declares it impossible",
      },
    ]);
  });

  it("treats every event in a terminal state as refused", async () => {
    const lingering = { ...CORRECT, offers: { ...CORRECT.offers, cancel: ["PLACED", "PACKED", "CANCELED"] as Status[] } };
    const report = await walk(ORDER, target(lingering));
    expect(report.violations.map((v) => [v.kind, v.state, v.event])).toEqual([["safety", "CANCELED", "cancel"]]);
  });

  it("reports a transition the implementation does not offer as a liveness violation and covers the rest", async () => {
    const stuck = { ...CORRECT, offers: { ...CORRECT.offers, hand_over: [] as Status[] } };
    const report = await walk(ORDER, target(stuck));
    expect(report.violations.map((v) => [v.kind, v.state, v.event])).toEqual([["liveness", "PACKED", "hand_over"]]);
    expect(report.uncovered).toEqual(["PACKED hand_over", "HANDED_OVER complete"]);
  });

  it("reports a screen that ends in another state than the IR's as a safety violation", async () => {
    const wrong = { ...CORRECT, leadsTo: { ...CORRECT.leadsTo, pack: { PLACED: "HANDED_OVER" as Status } } };
    const report = await walk(ORDER, target(wrong));
    expect(report.violations[0]).toMatchObject({ kind: "safety", state: "PACKED", event: "pack", trace: ["pack"] });
  });

  it("walks the same way for the same seed and stops at the step budget", async () => {
    const a = target(CORRECT);
    const b = target(CORRECT);
    await walk(ORDER, a, { seed: 7 });
    await walk(ORDER, b, { seed: 7 });
    expect(a.fired).toEqual(b.fired);

    const report = await walk(ORDER, target(CORRECT), { maxSteps: 2 });
    expect(report.steps).toBe(2);
    expect(report.stopped).toBe("steps");
    expect(report.uncovered.length).toBeGreaterThan(0);
  });

  it("reports a probe that throws as inconclusive, not as a refusal, and walks the rest", async () => {
    const flaky = target(CORRECT);
    const offered = flaky.offered;
    let flaked = false;
    flaky.offered = async (event) => {
      if (!flaked && event === "hand_over" && flaky.fired.at(-1) === "pack") {
        flaked = true;
        throw new Error("locator.isVisible: Timeout 5000ms exceeded.\nCall log: …");
      }
      return offered(event);
    };
    const report = await walk(ORDER, flaky);
    expect(report.violations).toEqual([]);
    // The cell that flaked is not probed again in PACKED, so its transition stays unfired; the rest is walked
    expect(report.uncovered).toEqual(["PACKED hand_over", "HANDED_OVER complete"]);
    expect(report.covered).toHaveLength(3);
    expect(report.inconclusive).toMatchObject([
      { state: "PACKED", event: "hand_over", trace: ["pack"], message: "could not probe hand_over in PACKED: locator.isVisible: Timeout 5000ms exceeded." },
    ]);
  });

  it("reports a screen that does not settle as inconclusive, not as being in another state", async () => {
    const unsettled = target(CORRECT);
    const shows = unsettled.shows;
    unsettled.shows = async (state) => (state === "PACKED" ? { failed: "a loading indicator is still shown" } : shows(state));
    const report = await walk(ORDER, unsettled);
    expect(report.violations).toEqual([]);
    expect(report.inconclusive.map((i) => i.message)).toContain("could not observe PACKED after pack: a loading indicator is still shown");
  });

  it("ends a walk that runs out of time and says so", async () => {
    let clock = 0;
    const slow = target(CORRECT);
    const fire = slow.fire;
    slow.fire = async (event, step) => {
      clock += 60_000; // a step on a real system can take a minute
      return fire(event, step);
    };
    const report = await walk(ORDER, slow, { maxDuration: 150_000, now: () => clock });
    expect(report.stopped).toBe("time");
    expect(report.steps).toBe(3);
    expect(renderWalkReport(report)).toContain("stopped: time budget reached");
  });

  it("stops when the target cannot start a run", async () => {
    const broken = target(CORRECT);
    broken.reset = async () => {
      throw new Error("environment unavailable");
    };
    const report = await walk(ORDER, broken);
    expect(report.stopped).toBe("reset failed");
    expect(report.inconclusive.map((i) => i.message)).toEqual(["could not start a run in PLACED: environment unavailable"]);
  });

  it("renders the violations with their reproduction", async () => {
    const leaky = { ...CORRECT, offers: { ...CORRECT.offers, cancel: ["PLACED", "PACKED", "HANDED_OVER"] as Status[] } };
    expect(renderWalkReport(await walk(ORDER, target(leaky)))).toContain(
      "safety: cancel is offered in HANDED_OVER, where the IR declares it impossible (from PLACED: pack → hand_over)",
    );
  });
});

// The same hand-written implementation behind an API: probing means sending the request
function api(impl: Implementation, options: { direct?: boolean; refuseButMove?: [string, Status] } = {}): ApiTarget {
  let status: Status = "PLACED";
  const target: ApiTarget = {
    probes: ["pack", "hand_over", "cancel"],
    reset: async () => void (status = "PLACED"),
    attempt: async (event) => {
      const to = impl.leadsTo[event]?.[status];
      if (options.refuseButMove?.[0] === event && to === undefined) {
        status = options.refuseButMove[1];
        return "refused";
      }
      if (to === undefined) return "refused";
      status = to;
      return "accepted";
    },
    fire: async (event) => void (status = impl.leadsTo[event]?.[status] ?? status),
    shows: async (state) => status === state,
  };
  if (options.direct) target.resetTo = async (state) => void (status = state as Status);
  return target;
}

describe("walk on an API target", () => {
  it("never sends more requests than the step budget, probes included", async () => {
    let requests = 0;
    const counting = api(CORRECT);
    const attempt = counting.attempt;
    counting.attempt = async (event, step) => {
      requests++;
      return attempt(event, step);
    };
    for (const maxSteps of [1, 2, 5]) {
      requests = 0;
      const report = await walk(ORDER, counting, { maxSteps });
      expect(report.steps).toBeLessThanOrEqual(maxSteps);
      expect(requests).toBeLessThanOrEqual(maxSteps);
      expect(report.stopped).toBe("steps");
    }
  });

  it("reports a refusal that still changes the state as a safety violation", async () => {
    const report = await walk(ORDER, api(CORRECT, { refuseButMove: ["hand_over", "CANCELED"] }));
    expect(report.violations[0]).toMatchObject({ kind: "safety", state: "PLACED", event: "hand_over", trace: ["hand_over (refused)"] });
  });

  it("starts the reproduction at a state built directly when the run started there", async () => {
    const leaky = { ...CORRECT, leadsTo: { ...CORRECT.leadsTo, cancel: { ...CORRECT.leadsTo.cancel, HANDED_OVER: "CANCELED" as Status } } };
    const report = await walk(ORDER, api(leaky, { direct: true }), { seed: 3 });
    const violation = report.violations.find((v) => v.state === "HANDED_OVER" && v.event === "cancel");
    expect(violation?.kind).toBe("safety");
    const text = renderWalkReport(report);
    expect(text).toContain("cancel is accepted in HANDED_OVER, where the IR declares it impossible");
    expect(text).toContain(`from ${violation?.start.state}, built directly:`);
    // The known defect is not attempted again, so the rest of the graph is still walked
    expect(report.uncovered).toEqual([]);
  });
});
