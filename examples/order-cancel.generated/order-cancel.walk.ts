// Graph walk of UC-ORDER-CANCEL-001 on the integration layer (docs/generation.md "Graph walk").
// Written by hand, not generated: the target is the project's piece, like the harness. It drives the
// screen through the semantic driver only; the fake backend answers each event with the state the
// IR leads to, so what the walk checks here is the screen: which controls it offers in each state,
// and which status it shows after each event. An E2E target would be the same with the real backend.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";
import { parseIR } from "../../src/parse.ts";
import { type WalkTarget, renderWalkReport, walk } from "../../src/walk.ts";
import { type OrderStatus, integrationHarness } from "./harness.ts";
import type { OrderDriver, StatusLiteral, UiEvent } from "./order-driver.ts";

const { model } = parseIR(readFileSync(new URL("../order-cancel.usecase.yaml", import.meta.url), "utf8"));
if (!model) throw new Error("order-cancel.usecase.yaml does not parse");

// The status literal each state shows. PLACED has none in the bindings (a question on the list),
// so the walk reports it as not observable
const STATUS: Partial<Record<OrderStatus, StatusLiteral>> = {
  PACKED: "status_packed",
  HANDED_OVER: "status_shipped",
  COMPLETED: "status_delivered",
  CANCELED: "status_canceled",
};

async function orderTarget(page: Page): Promise<WalkTarget> {
  const h = await integrationHarness(page);
  let orderId = "";
  let screen: { actor: string; driver: OrderDriver } | undefined;
  // One page: probing another actor's control opens that actor's screen
  const on = async (actor: string) => {
    if (screen?.actor !== actor) screen = { actor, driver: await h.screen(actor as "staff" | "customer", orderId) };
    return screen.driver;
  };
  const actorOf = (event: string) => model!.events.get(event)!.actor;
  return {
    uiEvents: ["pack", "hand_over", "cancel"],
    reset: async () => {
      orderId = await h.fixtures.paidOrder();
      screen = undefined;
      await on("staff");
    },
    offered: async (event) => (await on(actorOf(event))).offers(event as UiEvent),
    fire: async (event, { to }) => {
      if (event === "complete") {
        await h.fixtures.completeDelivery(orderId);
        return screen!.driver.refresh();
      }
      if (to !== undefined) h.fake.respond(event as UiEvent, { status: to as OrderStatus });
      const driver = await on(actorOf(event));
      const calls = h.fake.calls(event as UiEvent).length;
      await (event === "hand_over" ? driver.handOver() : event === "pack" ? driver.pack() : driver.cancel());
      await expect.poll(() => h.fake.calls(event as UiEvent).length).toBe(calls + 1);
    },
    shows: async (state) => {
      const key = STATUS[state as OrderStatus];
      return key === undefined ? undefined : screen!.driver.shows(key);
    },
  };
}

test("UC-ORDER-CANCEL-001 graph walk: the screen offers what the IR allows in every state", async ({ page }) => {
  const report = await walk(model, await orderTarget(page));
  console.log(renderWalkReport(report));
  expect(report.violations).toEqual([]);
  expect(report.uncovered).toEqual([]);
});

// Negative control: the same walk on a screen that still offers cancel after hand-over must fail
test("UC-ORDER-CANCEL-001 graph walk: negative control — cancel offered after hand-over", async ({ page }) => {
  const target = await orderTarget(page);
  // Registered after the harness, so it wins over the harness's route for the same file
  const source = readFileSync(new URL("./order-screen.ts", import.meta.url), "utf8");
  const mutated = source.replace('in: ["PLACED", "PACKED"]', 'in: ["PLACED", "PACKED", "HANDED_OVER"]');
  expect(mutated).not.toBe(source);
  await page.route("http://app.test/app/order-screen.ts", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: ts.transpileModule(mutated, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
    }),
  );
  const report = await walk(model, target);
  console.log(renderWalkReport(report));
  expect(report.violations.map((v) => `${v.kind} ${v.state} ${v.event}`)).toEqual(["safety HANDED_OVER cancel"]);
});
