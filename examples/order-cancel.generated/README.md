# Generated from order-cancel — a worked example of the generation rules

What a generator following [docs/generation.md](../../docs/generation.md#generation-rules--from-the-approved-ir-to-code)
produces from three reviewed inputs:

- [order-cancel.usecase.yaml](../order-cancel.usecase.yaml) — the behavior
- [order-cancel.bindings.yaml](../order-cancel.bindings.yaml) — locators and copy
- [order-cancel.steps.yaml](../order-cancel.steps.yaml) — the step vocabulary: which driver or harness call each phrase is

```bash
node examples/generator/generate.ts          # regenerate
node examples/generator/generate.ts --check  # compare with the committed files (also run by npm test)
```

| File | Generated | Kind | Nodes |
| --- | --- | --- | --- |
| [scenarios/](scenarios/) | yes | resolved scenario files, one per scenario and race outcome | — |
| [order-cancel.integration.ts](order-cancel.integration.ts) | yes | integration: every scenario and the losing side of each race | SC-001..003, RACE-PLACED-pack-cancel-outcome |
| [order-cancel.e2e.ts](order-cancel.e2e.ts) | yes | E2E: `critical: true` scenarios | SC-001, SC-002 |
| [cancellation-terms.test.ts](cancellation-terms.test.ts) | yes | unit: RULE-001's case table | RULE-001-c1, -c2 |
| [cancellation-terms.ts](cancellation-terms.ts) | no | product code: the rule as a pure function | — |
| [order-cancel.decision.yaml](order-cancel.decision.yaml) | no | decision record for the product code | — |
| [order-driver.ts](order-driver.ts) | no | semantic driver (IR vocabulary) | — |
| [order-driver.playwright.ts](order-driver.playwright.ts) | no | the single adapter; reads the bindings file | — |
| [harness.ts](harness.ts) | no | the project-provided contract: fixtures, fake backend, sign-in | — |

The unit test runs with `npm test`. The Playwright files typecheck but need a project's
app, fake backend and seed tooling to run.

The trace over all three layers has no errors:

```bash
npm run check -- examples/order-cancel.usecase.yaml --trace examples/order-cancel.trace.yaml \
  --results unit=examples/order-cancel.unit-results.xml \
  --results integration=examples/order-cancel.integration-results.xml \
  --results e2e=examples/order-cancel.e2e-results.xml
```

The unit results and their negative controls come from a real run. The integration and
E2E results are illustrative, so their negative controls stay `pending`.

Things to notice:

- **Resolution finds what interpretation would hide.** SC-003's given says the order is
  already packed, but its path starts with packing: resolution puts that on the question
  list ([scenarios/SC-003.yaml](scenarios/SC-003.yaml))
- **No invention leaves visible gaps.** Nothing in the IR shows that "no cancellation fee
  is charged", so `T-PLACED-cancel-o2` is `unresolved` in the step definitions. It renders
  as a comment, and the trace shows it as `untested` with the question as the reason. The
  hand-over race offers a returns flow the IR never names, so that race gets no test
- **The pure function carries no fee amount.** RULE-001 only states the notice after
  packing, so the amount is a question for the spec owner, not a value to pick
- **Test bodies hold IR vocabulary only.** Locators and copy reach them through the
  adapter, so a bindings change touches no test body
