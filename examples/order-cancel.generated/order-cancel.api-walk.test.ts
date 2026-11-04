// Graph walk of UC-ORDER-CANCEL-001 on the API (docs/generation.md "Graph walk"). Written by hand: the
// target is the project's piece. It sends each event's operation (bindings `events`) to the order
// service and reads a rejection with one of the operation's `refused` codes as a refusal; any other
// failure is inconclusive. Against a real backend the target is the same, over HTTP.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseIR } from "../../src/parse.ts";
import { type ApiTarget, renderWalkReport, walk } from "../../src/walk.ts";
import { type OrderService, type OrderStatus, RULES, orderService } from "./order-service.ts";

const { model } = parseIR(readFileSync(new URL("../order-cancel.usecase.yaml", import.meta.url), "utf8"));
if (!model) throw new Error("order-cancel.usecase.yaml does not parse");
const bindings = parse(readFileSync(new URL("../order-cancel.bindings.yaml", import.meta.url), "utf8")) as {
  events: Record<string, { operation: string; refused?: string[] }>;
};

function apiTarget(service: OrderService, options: { direct?: boolean } = {}): ApiTarget {
  let id = "";
  const target: ApiTarget = {
    probes: Object.keys(bindings.events),
    reset: async () => void (id = service.create()),
    attempt: async (event) => {
      const { operation, refused } = bindings.events[event]!;
      const response = service.handle({ operationName: operation, variables: { id } });
      if ("data" in response) return "accepted";
      const code = response.errors[0]?.extensions?.code;
      if (code !== undefined && refused?.includes(code)) return "refused";
      return { failed: `${operation}: ${code ?? `HTTP ${response.status}`}` };
    },
    // complete (actor: system) is the carrier's report, not an operation of the API
    fire: async () => service.completeDelivery(id),
    shows: async (state) => {
      const response = service.handle({ operationName: "Order", variables: { id } });
      return "data" in response && response.data.order.status === state;
    },
  };
  if (options.direct) target.resetTo = async (state) => void (id = service.seed(state as OrderStatus));
  return target;
}

describe("UC-ORDER-CANCEL-001 API graph walk", () => {
  it("accepts every transition and refuses every impossible event, walking from the initial state", async () => {
    const report = await walk(model, apiTarget(orderService()));
    expect(report.violations).toEqual([]);
    expect(report.inconclusive).toEqual([]);
    expect(report.uncovered).toEqual([]);
    // Impossible cells of the three operations: PLACED 1, PACKED 1, HANDED_OVER 3, and 3 in each terminal state
    expect(report.probed).toHaveLength(11);
    expect(report.unobservable).toEqual([]);
  });

  it("covers the same cells when runs start from states built directly", async () => {
    const report = await walk(model, apiTarget(orderService(), { direct: true }));
    expect(report.violations).toEqual([]);
    expect(report.uncovered).toEqual([]);
    expect(report.runs).toBeGreaterThan(1);
  });

  // Negative controls: a service with a planted defect must fail the walk
  it("reports a cancellation the service accepts after hand-over as a safety violation", async () => {
    const rules = { ...RULES, CancelOrder: { from: ["PLACED", "PACKED", "HANDED_OVER"] as OrderStatus[], to: "CANCELED" as const } };
    const report = await walk(model, apiTarget(orderService({ rules })));
    console.log(renderWalkReport(report));
    expect(report.violations.map((v) => `${v.kind} ${v.state} ${v.event}`)).toEqual(["safety HANDED_OVER cancel"]);
  });

  it("reports a hand-over the service refuses as a liveness violation", async () => {
    const rules = { ...RULES, HandOverOrder: { from: [] as OrderStatus[], to: "HANDED_OVER" as const } };
    const report = await walk(model, apiTarget(orderService({ rules })));
    expect(report.violations.map((v) => `${v.kind} ${v.state} ${v.event}`)).toEqual(["liveness PACKED hand_over"]);
  });

  it("reports an operation that is down as inconclusive, never as a refusal", async () => {
    const report = await walk(model, apiTarget(orderService({ down: ["PackOrder"] })));
    expect(report.violations).toEqual([]);
    expect(report.inconclusive.map((i) => i.message)).toContain("pack in PLACED neither succeeded nor was refused: PackOrder: HTTP 503");
    expect(report.uncovered.length).toBeGreaterThan(0);
  });
});
