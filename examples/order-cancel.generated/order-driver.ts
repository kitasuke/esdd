// Semantic driver for UC-ORDER-CANCEL-001. Test bodies use only these methods, so they
// carry IR vocabulary only: one method per event the UI drives, plus the observables the
// outcomes name. The step definitions (order-cancel.steps.yaml) refer to these names;
// keys are bindings literal keys.

export type StatusLiteral = "status_packed" | "status_shipped" | "status_delivered" | "status_canceled";
export type UiEvent = "pack" | "hand_over" | "cancel";

export interface OrderDriver {
  pack(): Promise<void>; // event pack (actor: staff)
  handOver(): Promise<void>; // event hand_over (actor: staff)
  cancel(): Promise<void>; // event cancel (actor: customer)
  /** Plumbing: re-read the screen after an actor: system event. */
  refresh(): Promise<void>;
  expectStatus(key: StatusLiteral): Promise<void>;
  expectStatusNot(key: StatusLiteral): Promise<void>;
  expectFeeNotice(): Promise<void>;
  expectNoFeeNotice(): Promise<void>;
  expectCanceledNotice(): Promise<void>;
  expectNoCanceledNotice(): Promise<void>;
  // Probes for the graph walk (src/walk.ts): they answer instead of asserting
  /** Whether the event's control is offered: visible and enabled */
  offers(event: UiEvent): Promise<boolean>;
  /** Whether the status shows the literal, waiting for the screen to settle */
  shows(key: StatusLiteral): Promise<boolean>;
}
