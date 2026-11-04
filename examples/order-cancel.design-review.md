# Review: the order-cancel design doc

A worked example of [docs/pdd.md](../docs/pdd.md): [order-cancel.design.md](order-cancel.design.md)
read against [order-cancel.usecase.yaml](order-cancel.usecase.yaml) and
[order-cancel.prd.yaml](order-cancel.prd.yaml). The IR it produced is
[order-cancel.design-review.usecase.yaml](order-cancel.design-review.usecase.yaml).

Input mode A (spec only). Sources: PRD v1 in `source.version`, and the design doc edited
2026-10-22T14:10Z in `source.sources`. Check: `npm run check -- examples/order-cancel.design-review.usecase.yaml`: 0 errors and
9 warnings, one per `TBD`. With the assumption W1 they map to Q1–Q8 below; the rest of the list (Q9,
N1, N2) has no IR place and is carried in the PRD frame's `questions`.

## Statements sorted

| Design doc | Spec? | IR place |
| --- | --- | --- |
| cancel allowed while `placed` / `packed` | yes, as the PRD has it | existing transitions |
| cancel allowed within 30 minutes after hand-over | yes, contradicts the PRD | `HANDED_OVER × cancel` (Q1) |
| `reason_code` required enum, `note` max 500 | yes | `inputs` reason, note; RULE-003 |
| 409 `ORDER_ALREADY_HANDED_OVER` | yes, matches the existing race | none new |
| 409 `ORDER_ALREADY_CANCELED`, `order_id` unique | yes | RULE-002 (the same thing twice) |
| 403 `NOT_ORDER_OWNER` | candidate | none yet (N1) |
| status `refund_pending` | yes, if a screen shows it | cancel outcomes (Q2) |
| fee 5%, minimum $3; rate set by hand in SQL | yes | RULE-001 (Q3, Q5) |
| `note TEXT NULL`, no limit | yes, contradicts the API | `note × boundary` (Q8) |
| one transaction, event bus, 5 retries, table names | no | none |
| order list cached 60 seconds | yes, if the list can show an old status | none yet (Q9) |

## Questions

| Id | Tier | Who decides | Question | Proposal | Basis |
| --- | --- | --- | --- | --- | --- |
| Q1 | must ask | spec owner | Can an order be canceled within 30 minutes after hand-over, before the carrier scans it? The design doc allows it; the PRD lists it as a non-goal. | Not allowed: the returns flow is offered, as now | the PRD's non-goal |
| Q2 | must ask (money) | spec owner | What does the order show while the refund is pending, and after the refund fails? | "Canceled" with "Refund in progress"; on failure, a support contact | none in the spec |
| Q3 | must ask (money) | spec owner | Is the fee amount shown on the notice, and in what format? | Shown, as on the order total | the order total's format |
| Q4 | must ask (money) | spec owner | Is the fee waived for orders under $10? Agreed in thread 2 (resolved), not in the body; ledger decision D-1 | Waived; write it into the design doc | thread 2 |
| Q5 | must ask (money) | spec owner | The rate is changed by hand in SQL. If it changes between the notice and the cancellation, which fee is charged? | The fee shown on the notice | what the customer agreed to |
| Q6 | must ask (money) | spec owner | What does a second cancel from another tab show, and is a second fee charged? | "This order is already canceled"; no second fee | `order_id` unique, 409 |
| Q7 | must ask | spec owner | Is a cancellation reason required? Thread 3 (open) | Optional | thread 3; the PRD has no reason |
| Q8 | must ask (contradiction) | spec owner, then implementation team | The note limit is 500 in the API and none in the database. Which holds, and what does the screen show at it? | 500, the counter stops input | the API, the stricter layer the user meets |
| W1 | assume | spec owner (reviews the list) | What does a double press show? | "Canceled" once; the second press changes nothing | `order_id` unique, 409 |
| Q9 | warning | spec owner | The order list is cached 60 seconds. Can a canceled order still show "Packed" in the list? | The list shows "Canceled" on return from the order | the processing section |
| N1 | note | spec owner | The API refuses a caller who did not place the order. Can the screen reach that case? | No: the list shows only the customer's own orders | none |
| N2 | note | spec owner | Thread 1 (open): can staff cancel for the customer from the support tool? | Out of scope: add to `non_goals` | the PRD's users |

## Carried in the PRD frame

Q9, N1 and N2 have no IR place, so no check finds them. They go into the frame's `questions`, which
keeps them on the rendered open questions until they are answered:

```yaml
questions:
  - { question: "Q9: can a canceled order still show \"Packed\" in the list for up to 60 seconds?", proposal: "The list shows \"Canceled\" on return from the order" }
  - { question: "N1: can the screen reach the API's refusal of a caller who did not place the order?", proposal: "No: the list shows only the customer's own orders" }
  - { question: "N2: can staff cancel for the customer from the support tool?", proposal: "Out of scope: add to non_goals" }
```

## Ledger

```yaml
decisions:
  - { id: D-1, answer: "no fee for orders under $10", by: review meeting, source: "design doc, thread 2 (resolved)", applies_to: "RULE-001; not yet in the design doc body (Q4)" }
```
