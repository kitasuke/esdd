// The project-provided pieces the generated tests rely on. Only their contract is shown;
// each project implements them on its own fake backend, seed tooling and sign-in.
import type { Browser, Page } from "@playwright/test";

export type OrderStatus = "PLACED" | "PACKED" | "HANDED_OVER" | "COMPLETED" | "CANCELED";
export type Actor = "staff" | "customer";

/** Integration: a deterministic fake backend, keyed by IR event ids (bindings resolve them to operations). */
export interface FakeBackend {
  /** The order every read returns from now on. */
  setOrder(order: { id: string; status: OrderStatus }): void;
  /** The response of the event's operation (bindings `events`). */
  respond(event: "pack" | "hand_over" | "cancel", order: { status: OrderStatus }): void;
  /** Recorded calls of the event's operation (bindings `called_api`), in order. */
  calls(event: "pack" | "hand_over" | "cancel"): unknown[];
}
export declare function fakeBackend(page: Page): Promise<FakeBackend>;

/** E2E: data creation and system-actor entry points of the real environment. */
export interface Seed {
  /** A paid order in PLACED. Values the IR does not name are fixture choices, never asserted. */
  paidOrder(): Promise<string>;
  /** Drives the `complete` event (actor: system) through the real system's own entry point. */
  completeDelivery(orderId: string): Promise<void>;
}
export declare const seed: Seed;

/** E2E: a page signed in as the IR actor. */
export declare function signedIn(browser: Browser, actor: Actor): Promise<Page>;
