# Generated from order-cancel — a worked example of the generation rules

What a generator following [docs/generation.md](../../docs/generation.md#generation-rules--from-the-approved-ir-to-code)
produces, both tests and product code, from four reviewed inputs:

- [order-cancel.usecase.yaml](../order-cancel.usecase.yaml): the behavior
- [order-cancel.bindings.yaml](../order-cancel.bindings.yaml): locators and copy
- [order-cancel.steps.yaml](../order-cancel.steps.yaml): the step vocabulary, which driver or harness call each phrase is
- [pattern-registry.yaml](../pattern-registry.yaml): the product-code patterns and the house rulings

```bash
node examples/generator/generate.ts          # regenerate
node examples/generator/generate.ts --check  # compare with the committed files (also run by npm test)
npm run example:integration                  # the integration tests against the generated product code, in Chromium
                                             # (once: npx playwright install chromium)
```

| File | Generated | Kind | Nodes |
| --- | --- | --- | --- |
| [scenarios/](scenarios/) | yes | resolved scenario files, one per scenario and race outcome | — |
| [order-cancel.integration.ts](order-cancel.integration.ts) | yes | integration: every scenario and the losing side of each race | SC-001..003, RACE-PLACED-pack-cancel-outcome |
| [order-cancel.e2e.ts](order-cancel.e2e.ts) | yes | E2E: `critical: true` scenarios | SC-001, SC-002 |
| [cancellation-terms.test.ts](cancellation-terms.test.ts) | yes | unit: RULE-001's case table | RULE-001-c1, -c2 |
| [order-cancel.decision.yaml](order-cancel.decision.yaml) | yes | decision record: the pattern per target, its slots, and what no input prescribes | — |
| [cancellation-terms.ts](cancellation-terms.ts) | yes | product code: RULE-001 as a pure function (`pure_rule_function`) | — |
| [order-screen.ts](order-screen.ts) | yes | product code: the order screen (`entity_status_with_actions`) | — |
| [order-driver.ts](order-driver.ts) | no | semantic driver (IR vocabulary) | — |
| [order-driver.playwright.ts](order-driver.playwright.ts) | no | the single adapter; reads the bindings file | — |
| [harness.ts](harness.ts) | no | fixtures and a working fake backend + app shell for integration; a contract only for E2E | — |

Both product files are checked by tests that actually run: the unit tests run with `npm
test`, and the integration tests run in Chromium with `npm run example:integration`. The E2E
file typechecks but needs a real environment.

The trace over all three layers has no errors:

```bash
npm run check -- examples/order-cancel.usecase.yaml --trace examples/order-cancel.trace.yaml \
  --results unit=examples/order-cancel.unit-results.xml \
  --results integration=examples/order-cancel.integration-results.xml \
  --results e2e=examples/order-cancel.e2e-results.xml
```

The unit and integration results come from real runs, and every Green node carries a measured
negative control in [order-cancel.trace.yaml](../order-cancel.trace.yaml). The E2E results are
illustrative.

Things to notice:

- **Resolution and selection find what interpretation would hide.**
  - On the test side, SC-003's given says the order is already packed, but its path starts
    with packing ([scenarios/SC-003.yaml](scenarios/SC-003.yaml)).
  - On the product side, no outcome names the status text of PLACED, and the bindings have
    nothing for what the losing side of the hand-over race sees
    ([order-cancel.decision.yaml](order-cancel.decision.yaml) `unprescribed`).
  - All three go on the question list instead of being guessed.
- **No invention leaves visible gaps.** Nothing in the IR shows that "no cancellation fee is
  charged", so `T-PLACED-cancel-o2` is `unresolved`: it renders as a comment, and the trace
  shows it as `untested` with the question as the reason.
- **The integration tests are the check on the product code.** They are generated from the
  step definitions, independently of the screen, and the screen passed them unchanged.
- **One negative control was not a control.** Inverting the race's notice assertion into
  "hidden" stayed Green, because an absence check passes before the click's response renders.
  Withholding the fake's rejection is what made the test fail.
- **The registry rulings carry what no contract says**: the API endpoint and conflict code,
  how a race loser's rejection looks, and that the screen reads once on load.
