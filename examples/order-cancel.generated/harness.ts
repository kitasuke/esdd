// The project-provided pieces the generated tests rely on. Only their contract is shown;
// each project implements them on its own fake backend, seed tooling and sign-in.
// Fixture names are the ones the step definitions (order-cancel.steps.yaml) refer to.
import type { Browser, Page } from "@playwright/test";
import type { OrderDriver } from "./order-driver.ts";

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
  /** Opens the order on the actor's screen (signed in as that actor). */
  screen(actor: Actor, orderId: string): Promise<OrderDriver>;
}

/** Integration: a deterministic fake backend, keyed by IR event ids (bindings resolve them to operations). */
export interface FakeBackend {
  /** The order's status every read returns from now on. */
  setStatus(orderId: string, status: OrderStatus): void;
  /** The response of the event's operation (bindings `events`). */
  respond(event: UiEvent, order: { status: OrderStatus }): void;
  /** The event's operation fails with the error the backend returns to the loser of a race. */
  rejectAsConflict(event: UiEvent): void;
  /** Recorded calls of the event's operation (bindings `called_api`), in order. */
  calls(event: UiEvent): unknown[];
}

export declare function integrationHarness(page: Page): Promise<Harness & { fake: FakeBackend }>;
export declare function e2eHarness(browser: Browser): Promise<Harness>;
