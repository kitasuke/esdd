// Semantic driver for UC-ORDER-CANCEL-001. Test bodies use only these methods, so they
// carry IR vocabulary only: one method per event the UI drives, plus the observables the
// outcomes name. Keys are bindings literal keys.
import type { Actor } from "./harness.ts";

export type StatusLiteral = "status_packed" | "status_shipped" | "status_delivered" | "status_canceled";

export interface OrderDriver {
  open(orderId: string, actor: Actor): Promise<void>;
  pack(): Promise<void>; // event pack (actor: staff)
  handOver(): Promise<void>; // event hand_over (actor: staff)
  cancel(): Promise<void>; // event cancel (actor: customer)
  /** Plumbing: re-read the screen after an actor: system event. */
  refresh(): Promise<void>;
  expectStatus(key: StatusLiteral): Promise<void>;
  expectStatusNot(key: StatusLiteral): Promise<void>;
  expectFeeNotice(): Promise<void>;
  expectNoFeeNotice(): Promise<void>;
}
