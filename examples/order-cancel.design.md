<!-- Example design doc for the order-cancel example. Its review is order-cancel.design-review.md (docs/pdd.md). -->

# Design doc: self-service order cancellation

Link: https://example.com/design/order-cancel — last edited 2026-10-22T14:10Z
PRD: https://example.com/specs/order-cancel

## API

`POST /orders/{id}/cancel`

Request body:

| Field | Type | Constraint |
| --- | --- | --- |
| reason_code | enum | required; one of `changed_mind`, `wrong_item`, `other` |
| note | string | optional; max 500 characters |

Responses:

| Status | Code | When |
| --- | --- | --- |
| 200 | - | canceled; body carries `fee_amount` |
| 409 | ORDER_ALREADY_HANDED_OVER | the order was handed to the carrier |
| 409 | ORDER_ALREADY_CANCELED | the order is already canceled |
| 403 | NOT_ORDER_OWNER | the caller did not place the order |

Cancellation is allowed while the order is `placed` or `packed`. To reduce support load, it is
also allowed within 30 minutes after hand-over, as long as the carrier has not scanned the parcel.

## Data model

`orders.status`: enum `placed`, `packed`, `handed_over`, `delivered`, `canceled`, `refund_pending`.
Cancel sets `refund_pending`; the refund job sets `canceled` when the payment provider confirms.

`order_cancellations`: `order_id` (unique), `reason_code`, `note TEXT NULL` (no length limit),
`fee_amount`, `created_at`.

Fee: 5% of the order total, minimum $3, for orders canceled while `packed`. The rate and the
minimum live in the `fee_settings` table and are changed by hand in SQL by the operations team.

## Processing

Cancel writes `order_cancellations`, sets the status in one transaction, and publishes
`OrderCanceled` to the event bus. The refund worker consumes it and calls the payment provider
with up to 5 retries. The order list is cached for 60 seconds per customer.

## Comments

- Thread 1 (open), on "Cancellation is allowed while…": "Should staff be able to cancel on the
  customer's behalf from the support tool?"
- Thread 2 (resolved), on "Fee": "Agreed in the review meeting: no fee for orders under $10."
  The body was not updated.
- Thread 3 (open), on `reason_code`: "Do we really want the reason to be required? It adds a step."
