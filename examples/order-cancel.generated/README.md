# Generated from order-cancel — a worked example of the generation rules

What a generator following [docs/generation.md](../../docs/generation.md#generation-rules--from-the-approved-ir-to-code)
produces from [order-cancel.usecase.yaml](../order-cancel.usecase.yaml) and
[order-cancel.bindings.yaml](../order-cancel.bindings.yaml). The unit test runs with
`npm test`; the Playwright files show the shape only and need a project's app, fake
backend and seed tooling to run.

| File | Kind | Built from | Nodes |
| --- | --- | --- | --- |
| [order-cancel.tests.yaml](order-cancel.tests.yaml) | target IR (tests) | layer routing, fixtures, open questions | — |
| [order-cancel.decision.yaml](order-cancel.decision.yaml) | decision record (product code) | pattern selections, open questions | — |
| [cancellation-terms.ts](cancellation-terms.ts) | product code | `rules` RULE-001 | — |
| [cancellation-terms.test.ts](cancellation-terms.test.ts) | unit | RULE-001 case table | RULE-001-c1, -c2 |
| [order-driver.ts](order-driver.ts) | semantic driver | IR events + the observables outcomes name | — |
| [order-driver.playwright.ts](order-driver.playwright.ts) | adapter | bindings `elements` / `literals` | — |
| [harness.ts](harness.ts) | project-provided contract | fake backend, seed, sign-in | — |
| [order-cancel.integration.ts](order-cancel.integration.ts) | integration | every scenario's path | SC-001, SC-002, SC-003 |
| [order-cancel.e2e.ts](order-cancel.e2e.ts) | E2E | `critical: true` scenarios | SC-001, SC-002 |

Things to notice:

- **The no-invention rule leaves visible gaps.** The IR says "no cancellation fee is
  charged" but names nothing to observe it by, so `T-PLACED-cancel-o2` is not asserted
  and goes on the question list. The trace reports it as uncovered until the spec answers
- **The pure function carries no fee amount.** RULE-001 only states the notice after
  packing; the amount is a question for the spec owner, not a value to pick
- **Each outcome-bearing step asserts before and after**, then prints its
  `[ESDD-OUTCOME]` marker. [order-cancel.e2e-results.xml](../order-cancel.e2e-results.xml)
  is what the E2E file's run looks like
- **Test bodies hold IR vocabulary only.** Locators and copy reach them through the
  adapter, so a bindings change touches no test body
