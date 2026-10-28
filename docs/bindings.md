# bindings — the locator / literal contract format

bindings maps the UseCase IR's vocabulary — spec-vocabulary ids (in the spec's
language; element and literal keys may be non-ASCII, event keys follow
[usecase-ir.md](usecase-ir.md#inputs-input-axis-matrix--usable-in-both-modes)) — to locators, API operations, and UI
literals. It is a **per-usecase contract file**: both the generated component and the
generated tests take their vocabulary from this file alone. Locators are not derived
mechanically from the spec-language ids: the bindings are that mapping, and each
locator is chosen once, when its entry is added.

co-generation is self-consistent — a wrong binding produces a wrong implementation and
a wrong test at the same time, and the two agree and pass. That is why reviewing the
bindings is the safety net, and why this format is designed above all to be machine-
checkable by the checker.

## Checking

```bash
npm run check -- <usecase.yaml> --bindings <bindings.yaml>
```

Passing the IR alongside also runs the full-population cross-check of
literal_coverage (below). The source of truth for the checks is `src/bindings.ts`
(this document is the explanation; the checker is normative).

## Format

```yaml
bindings: UC-PROFILE-EMAIL-001 # target usecase id (must match the IR)
platform: web                  # v0.1 ships only the web (Playwright/ARIA) profile
graph: account                 # API graph name (required for platform: web)

events: # IR event vocabulary → API operations (called_api is mechanically derived from operation/kind)
  save: { operation: UpdateContactEmail, kind: mutation, called_api: calledUpdateContactEmailMutation }

elements: # spec-vocabulary id → locator. Exactly one addressing form
  save_button: { role: button, name: "Save" } # role comes paired with name
  email_input: { label: "Email address" }
  contact_list: { testid: "contact-list" }        # non-semantic containers only; static kebab-case
  helper_text: { text: "Changes take effect immediately" } # last resort, when neither role+name nor label can reach it
  error_banner: { role: alert, name: "Could not save", note: "shown only after a failed save" } # note: free text, not checked

literals: # approved or proposed UI copy. key → text
  save_success_toast: "Your email address has been updated"

literal_coverage: # a stance for every rule in the IR (fully cross-checked; literal points to a key in literals)
  RULE-001: { literal: save_success_toast }
  RULE-002: { ui_text: none, reason: "ordering rule — no UI text" }
  RULE-003: { literal: TBD } # undecided → pending warn (resolved via the question list)
```

Choose the addressing form in this order: `role` + `name` or `label` first; `testid`
only for non-semantic containers that have no role or label; `text` only as a last
resort.

## Check rules

| check | level | what it enforces |
| --- | --- | --- |
| bindings-schema | error | required keys (bindings/platform/elements; graph for web). Each element has exactly one of role(+name)/label/testid/text. role is within the allowed set (`ALLOWED_ROLES` in `src/bindings.ts`; extend it in step with your project's role table). testid is static kebab-case. An optional `note` is allowed and not checked. Other unknown keys are errors, treated as typos |
| bindings-unique | warn | two elements with the same addressing (identical role+name / label / testid / text) — a strict mode violation waiting to happen |
| bindings-events | error | operation is PascalCase, kind is mutation/query, called_api matches the mechanically derived `called<Operation><Query\|Mutation>` |
| bindings-usecase | error | the `bindings:` id does not match the usecase of the IR passed in / the corresponding IR is missing from the inputs |
| literal-coverage | error | every rule in the IR has a stance (`literal: <key>` / `ui_text: none`). Rule ids absent from the IR and nonexistent literal keys are also errors |
| pending | warn | TBD/TODO/FIXME/UNRESOLVED in a literal value or `literal: TBD` — a mark to resolve before approval |

## The idea behind literal_coverage

The same philosophy as states×events exhaustiveness and the inputs axis matrix:
**the machine knows the universe (all rule ids in the IR), humans declare the closure,
and the checker enforces the full population**.

- A rule with UI copy → `literal: <key>` (the key must exist in literals)
- A rule without UI copy (ordering rules, server-side responsibilities, …) → `ui_text: none` + reason
- Copy not yet decided → `literal: TBD` (pending warn = a question-list line)

This turns the "the rule demands UI copy but the contract has no literal" class of
contract inconsistency into a machine finding at contract-review time instead of a
discovery after generation. In one reproduction trial, this class accounted for 3 of the
9 undecided decisions found during generation.

## Lifecycle

1. Review the bindings at the same time the IR is approved (acceptance-first — generation.md)
2. Send the `literal: TBD` lines to the spec owner as the question list
3. Answered literals are promoted into the IR's rules expected, and the bindings
   remain as the mapping table
4. Generation (component / tests / semantic driver) uses only the bindings
   vocabulary — referencing an element that is not in the bindings violates the
   no-invention rule

## Extending platform profiles

The addressing-form vocabulary is designed to be swappable per platform (the
checker's `ELEMENT_KEYS_BY_PLATFORM`). To extend to mobile native and the like, add a
profile with that UI stack's locator vocabulary (e.g. test tags / accessibility
descriptions / declared screen states). Rules that carry over to such a profile:

- Address controls that advance state by a test tag, not by visible text, because copy
  changes. Name tags in kebab-case as `<kind>-<subject>`
- A screen-state binding is a contract: it names a value the app declares for test
  observation, and is never inferred from visible text or from whether a tag is present
- An event binding can name both the app's event variant (user action vs system or
  server event) and the API method the test fake overrides. That method is the seam
  where a deterministic test sets up its givens and verifies calls
