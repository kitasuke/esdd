// The project-provided pieces the generated tests rely on. The integration harness is a working
// example: a fake backend at the network level (page.route) and an app shell that mounts the
// generated screen. The E2E harness is only a contract — it needs a real environment.
// Fixture names are the ones the step definitions (order-cancel.steps.yaml) refer to.
import { readFileSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import ts from "typescript";
import { parse } from "yaml";
import type { OrderDriver } from "./order-driver.ts";
import { orderDriver } from "./order-driver.playwright.ts";

export type OrderStatus = "PLACED" | "PACKED" | "HANDED_OVER" | "COMPLETED" | "CANCELED";
export type Actor = "staff" | "customer";
type UiEvent = "pack" | "hand_over" | "cancel";

/** Builds the start state of a test and drives actor: system events. Values the IR does not name are fixture choices, never asserted. */
export interface Fixtures {
  paidOrder(): Promise<string>;
  packedOrder(): Promise<string>;
  completeDelivery(orderId: string): Promise<void>;
}

export interface Harness {
  fixtures: Fixtures;
  /** Opens the order on the actor's screen (signed in as that actor) once it has loaded. */
  screen(actor: Actor, orderId: string): Promise<OrderDriver>;
}

/** Integration: a deterministic fake backend, keyed by IR event ids (bindings resolve them to operations). */
export interface FakeBackend {
  /** The order's status every read returns from now on. */
  setStatus(orderId: string, status: OrderStatus): void;
  /** The response of the event's operation (bindings `events`); the order keeps that status afterwards. */
  respond(event: UiEvent, order: { status: OrderStatus }): void;
  /** The event's operation fails with the error the backend returns to the loser of a race. */
  rejectAsConflict(event: UiEvent): void;
  /** Recorded calls of the event's operation (bindings `called_api`), in order. */
  calls(event: UiEvent): unknown[];
}

const ORIGIN = "http://app.test";
const ORDER_ID = "order-1";
const fromHere = (path: string) => new URL(path, import.meta.url);
const yaml = <T>(path: string) => parse(readFileSync(fromHere(path), "utf8")) as T;

export async function integrationHarness(page: Page): Promise<Harness & { fake: FakeBackend }> {
  const bindings = yaml<{ graph: string; events: Record<string, { operation: string }> }>("../order-cancel.bindings.yaml");
  const api = yaml<{ api: Record<string, { endpoint: string; read: string; conflict_code: string }> }>("../pattern-registry.yaml").api[bindings.graph]!;
  const eventOf = new Map(Object.entries(bindings.events).map(([event, b]) => [b.operation, event]));

  const statuses = new Map<string, OrderStatus>();
  const responses = new Map<string, OrderStatus>();
  const rejected = new Set<string>();
  const calls = new Map<string, unknown[]>();

  await page.route(`${ORIGIN}${api.endpoint}`, async (route) => {
    const { operationName, variables } = route.request().postDataJSON() as { operationName: string; variables: { id: string } };
    const order = (status: OrderStatus | undefined) => ({ data: { order: { id: variables.id, status } } });
    if (operationName === api.read) return route.fulfill({ json: order(statuses.get(variables.id)) });
    const event = eventOf.get(operationName);
    if (event === undefined) return route.fulfill({ status: 400, json: { errors: [{ message: `unknown operation ${operationName}` }] } });
    calls.set(event, [...(calls.get(event) ?? []), variables]);
    if (rejected.has(event)) {
      return route.fulfill({ json: { errors: [{ message: "conflict", extensions: { code: api.conflict_code } }] } });
    }
    const next = responses.get(event);
    if (next === undefined) return route.fulfill({ status: 500, json: { errors: [{ message: `no response registered for ${event}` }] } });
    statuses.set(variables.id, next);
    return route.fulfill({ json: order(next) });
  });
  // The generated product code, transpiled for the browser
  await page.route(`${ORIGIN}/app/*.ts`, async (route) => {
    const file = new URL(route.request().url()).pathname.replace("/app/", "");
    const source = readFileSync(fromHere(`./${file}`), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    return route.fulfill({ contentType: "text/javascript", body: outputText });
  });
  // The app shell: /<actor>/orders/<orderId>
  await page.route(`${ORIGIN}/*/orders/*`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><main id="app"></main><script type="module">
import { mountOrderScreen } from "/app/order-screen.ts";
const [, actor, , orderId] = location.pathname.split("/");
mountOrderScreen(document.getElementById("app"), { actor, orderId });
</script>`,
    }),
  );

  const at = (status: OrderStatus) => async () => {
    statuses.set(ORDER_ID, status);
    return ORDER_ID;
  };
  return {
    fixtures: {
      paidOrder: at("PLACED"),
      packedOrder: at("PACKED"),
      completeDelivery: async (orderId) => void statuses.set(orderId, "COMPLETED"),
    },
    screen: async (actor, orderId) => {
      await page.goto(`${ORIGIN}/${actor}/orders/${orderId}`);
      await page.locator("[data-ready]").waitFor();
      return orderDriver(page);
    },
    fake: {
      setStatus: (orderId, status) => void statuses.set(orderId, status),
      respond: (event, order) => void responses.set(event, order.status),
      rejectAsConflict: (event) => void rejected.add(event),
      calls: (event) => calls.get(event) ?? [],
    },
  };
}

export declare function e2eHarness(browser: Browser): Promise<Harness>;
