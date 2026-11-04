import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseIR } from "./parse.ts";
import type { Model } from "./types.ts";
import { type WalkTarget, expectedOffer, renderWalkReport, walk } from "./walk.ts";

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

function target(impl: Implementation): WalkTarget & { fired: string[] } {
  let status: Status = "PLACED";
  const fired: string[] = [];
  return {
    fired,
    uiEvents: ["pack", "hand_over", "cancel"],
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
  });

  it("reports an impossible event the implementation offers as a safety violation, with its reproduction", async () => {
    const leaky = { ...CORRECT, offers: { ...CORRECT.offers, cancel: ["PLACED", "PACKED", "HANDED_OVER"] as Status[] } };
    const report = await walk(ORDER, target(leaky));
    expect(report.violations).toEqual([
      {
        kind: "safety",
        state: "HANDED_OVER",
        event: "cancel",
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
    expect(report.uncovered.length).toBeGreaterThan(0);
  });

  it("renders the violations with their reproduction", async () => {
    const leaky = { ...CORRECT, offers: { ...CORRECT.offers, cancel: ["PLACED", "PACKED", "HANDED_OVER"] as Status[] } };
    expect(renderWalkReport(await walk(ORDER, target(leaky)))).toContain(
      "safety: cancel is offered in HANDED_OVER, where the IR declares it impossible (from the initial state: pack → hand_over)",
    );
  });
});
