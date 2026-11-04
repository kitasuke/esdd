<!-- Example design doc written with pdd-author (docs/pdd.md, "Writing a design doc") from the same decisions as
     order-cancel.design.md. It folds into order-cancel.design-authored.usecase.yaml. -->

# Design doc: self-service order cancellation

PRD: [order-cancel.prd.yaml](order-cancel.prd.yaml). IR: [order-cancel.usecase.yaml](order-cancel.usecase.yaml) (in review).

## What this design enforces (from the IR)

| IR | What it says |
| --- | --- |
| `PLACED × cancel` | the order shows "Canceled"; no fee (RULE-001) |
| `PACKED × cancel` | the order shows "Canceled"; the fee notice is shown (RULE-001) |
| `HANDED_OVER × cancel` | impossible: cancellation after hand-over is not allowed, the returns flow is offered |
| race `PLACED`: pack vs cancel | whichever commits first wins; the packing screen shows "Canceled" |
| race `PACKED`: hand_over vs cancel | hand-over wins; the late cancel is refused and the returns flow is offered |
| RULE-001 | fee $0 before packing; fee notice "Cancellations after packing incur a handling fee" after |

`pack`, `hand_over` and `complete` belong to the warehouse and delivery integration, which this design does not change.

## API

`POST /orders/{id}/cancel` with `reason_code` (enum `changed_mind`, `wrong_item`, `other`, required) and `note` (string, max 500, optional).
Responses: 200 with `fee_amount`; 409 `ORDER_ALREADY_HANDED_OVER`; 409 `ORDER_ALREADY_CANCELED`; 403 `NOT_ORDER_OWNER`.

## Data model

`orders.status`: `placed`, `packed`, `handed_over`, `delivered`, `canceled`, `refund_pending`. Cancel sets `refund_pending`;
the refund job sets `canceled` when the payment provider confirms.
`order_cancellations`: `order_id` unique, `reason_code`, `note TEXT NULL`, `fee_amount`. Fee: 5% of the total, minimum $3,
while `packed`; rate and minimum in `fee_settings`, changed by hand in SQL by operations.
The status change and the cancellation row are written in one transaction with a row lock on the order.
The order list is cached 60 seconds per customer.

## Behavior

| Constraint | Enforced at | What the user sees | IR |
| --- | --- | --- | --- |
| cancel is accepted while the order is `placed` or `packed` | API (status check under the row lock) | the order shows "Canceled" | `PLACED × cancel`, `PACKED × cancel` |
| cancel is refused once the order is `handed_over` | API 409 `ORDER_ALREADY_HANDED_OVER` | the cancel is refused and the returns flow is offered | `HANDED_OVER × cancel`, race `PACKED` |
| pack and cancel on the same order are serialized | DB row lock | whichever commits first wins; the packing screen shows "Canceled" if cancel won | race `PLACED` |
| no fee while `placed`, a fee while `packed` | API | fee $0 before packing; the fee notice after packing | RULE-001 |
| the fee is 5% of the total, at least $3 | API | proposed: the notice shows the amount (O2) | none yet: RULE-001 case with `TBD(O2)` |
| one cancellation per order | DB unique `order_id`, API 409 `ORDER_ALREADY_CANCELED` | proposed: a second cancel shows "This order is already canceled", no second fee (O3) | none yet: new rule, `TBD(O3)` |
| a reason is required | API, client | proposed: cancel stays disabled until a reason is chosen (O4) | none yet: input `reason×empty`, `TBD(O4)` |
| the note is at most 500 characters | API, client; the DB column has no limit | the user meets the API limit; the DB is wider only because the limit may change (O5 for what the screen shows) | none yet: input `note×boundary`, `TBD(O5)` |
| a cancel moves the order to `refund_pending` until the refund is confirmed | API, refund job | proposed: the order shows "Canceled" with "Refund in progress"; on failure, a support contact (O6) | `PLACED × cancel`, `PACKED × cancel`: outcome `TBD(O6)` |
| the order list is cached 60 seconds | API cache | proposed: the list may show the old status for up to 60 seconds; the order page is never cached (O7) | none: frame `questions` |

No row: the 403 for a caller who did not place the order (the screen lists only the customer's own orders, so it cannot
reach it), the event bus, the refund retries, table and column names.

## What changes outside the feature

| Change | Who | What the user sees | IR |
| --- | --- | --- | --- |
| the fee rate or minimum is edited in `fee_settings` | operations, by SQL | proposed: the fee shown on the notice is the fee charged, even if the rate changes before the customer confirms (O8) | none yet: RULE-001 case, `TBD(O8)` |
| existing orders at release | migration | none: existing statuses map one to one; no order is `refund_pending` before release | none |

## Open points

| Id | Question | Proposal | Who decides |
| --- | --- | --- | --- |
| O1 | Allow cancel within 30 minutes after hand-over, before the carrier scans? (contradicts the PRD non-goal) | No: keep the PRD; drop it from this design | PRD owner |
| O2 | Is the fee amount shown on the notice, in what format? | Shown, as on the order total | PRD owner |
| O3 | What does a second cancel (another tab) show? | "This order is already canceled", no second fee | PRD owner |
| O4 | Is a reason required? | Optional: the PRD has no reason step | PRD owner |
| O5 | What does the note field show at 500 characters? | The counter stops input at 500 | PRD owner |
| O6 | What does the order show while the refund is pending, and after it fails? | "Canceled" with "Refund in progress"; on failure, a support contact | PRD owner |
| O7 | Can the list show an old status for 60 seconds? | Yes, the order page is never cached | PRD owner |
| O8 | Which fee is charged when the rate changes between the notice and the confirmation? | The fee shown on the notice | PRD owner |
| O9 | Does a double press need anything beyond the unique constraint? | No: the button is disabled while the request is in flight | implementation team |
