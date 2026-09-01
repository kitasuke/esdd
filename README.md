# ESDD — Executable Spec-Driven Development

**ESDD turns a product spec into a machine-checkable intermediate representation (UseCase IR), asks the questions the spec forgot to answer, and generates tests — and eventually implementation — from the same single contract.**

A spec written in prose can silently omit half its own decision space. ESDD makes the omissions mechanical: declare the state machine (or the input axes) of a feature, and the checker enforces exhaustiveness — every state × event cell, every input × condition cell, every race between actors, every rule's UI literal — must be either specified, declared impossible (with a reason), or explicitly flagged as an open question. What survives the check is a contract that both tests and implementation can be generated from, so that when they disagree, the disagreement is a detected spec drift rather than a silent bug.

The method decomposes specification verification into **test execution by machines
and approval by humans**: the check results *are* the question list for the spec
owner, and there is exactly **one human approval point** — an IR that passes every
check. Scope: the UI behavior of web and mobile apps (states, transitions, displayed
text, input validation) — not layout or visual design, which belong to the
design-tool and component layers.

---

## Pipeline

```
Spec (PRD, …)
   ↓ conversion + checks (this repository's checker)
UseCase IR ……… single source of behavior (states/events/transitions/races/inputs/scenarios/rules)
   +
bindings ……… locator / literal contract (single source of UI vocabulary)
   ↓ generation
test code / implementation code (all quality concentrates in the upstream contract)
```

One IR feeds three test layers (see [docs/generation.md](docs/generation.md)):
`rules` become pure functions + unit tests, **all** `scenarios` become integration
tests against a fake backend (the main body of coverage), and only scenarios marked
`critical: true` become E2E tests against the real environment — kept small and
independent, as the drift detector between spec and reality.

Design principles:

- **Exhaustiveness is machine-enforced** — the machine knows the universe
  (states×events, inputs×conditions, all rules). Humans write the closure (a stance
  for every cell). The checker verifies the full population
- **No invention** — generated artifacts must not carry behavior, copy, or locators
  that do not derive from the IR / bindings. Decisions absent from the spec are not
  generated; they go on the question list
- **Open questions are carved in, not erased** — unanswered spec questions stay in
  the IR as `TBD` markers. The checker tracks them as warns and forces resolution
  before approval
- **Red is a detector** — when a generated test goes Red against the implementation,
  that is detected drift between spec and implementation. A human adjudicates which
  side is right (tests are never quietly fixed to Green)

## Quick start

Node.js 22.6+ (runs TypeScript directly).

```bash
npm install   # or pnpm install

# states-mode example: state machine exhaustiveness checks + path suggestions for uncovered transitions
npm run check -- examples/order-cancel.usecase.yaml --suggest-paths

# form mode (no states) + cross-check against bindings (the locator/literal contract)
npm run check -- examples/contact-email.usecase.yaml --bindings examples/contact-email.bindings.yaml

npm test
```

## What the checker checks

**UseCase IR** (`docs/usecase-ir.md`):

| Check | What it enforces |
| --- | --- |
| exhaustiveness | every non-terminal state × event cell is declared as a transition or `impossible: true` + reason |
| determinism | no duplicate declarations for the same cell |
| reachability / escapability | no state unreachable from the initial state, no state that cannot reach a terminal |
| race obligation | if events of different actors are both possible in a state, a `races` winner declaration is required |
| path validity / coverage | every scenario `path` is executable, and every transition is exercised by a scenario |
| input axis matrix | every `inputs` field/option × condition cell takes a stance via `covers` or `na` + reason |
| pending | tracks unanswered markers such as `TBD` / `TODO` as warns |

**bindings** (`docs/bindings.md`):

| Check | What it enforces |
| --- | --- |
| schema | each element has exactly one addressing form (role+name / label / testid / text) |
| uniqueness | two elements with the same addressing = a warn forecasting a locator mix-up |
| naming derivation | an event's `called_api` matches the name mechanically derived from operation/kind |
| literal_coverage | **every rule in the IR** has a UI-copy stance (`literal: <key>` / `ui_text: none` / `TBD`) |

## Why literal_coverage

When implementation and tests are **co-generated** from the contract (bindings), they
agree constructively — a wrong contract produces a wrong implementation and a wrong
test that agree and pass. So contract review becomes the quality safety net.
literal_coverage turns the "the rule demands UI copy but the contract has none" class
of inconsistency into a machine finding at contract-review time instead of a
discovery after generation.

## Documentation

- [docs/pipeline.md](docs/pipeline.md) — the pipeline: the single approval point, the
  two phases (drift detection vs co-generation), diff-editability, and target IRs
- [docs/usecase-ir.md](docs/usecase-ir.md) — the UseCase IR format and its authoring modes
- [docs/bindings.md](docs/bindings.md) — the bindings (locator/literal contract) format
- [docs/generation.md](docs/generation.md) — generation-side principles (acceptance-first,
  semantic drivers, pattern registries, generation decision records)

## Status

v0.1 — includes the IR checker and the bindings checker (web/Playwright profile).
Platform profiles are designed as an extension point (for mobile and the like, each
project swaps in its own locator vocabulary). The generator itself is not included —
generation is run per project, following the principles in `docs/generation.md`,
together with that project's vocabulary registries.

## License

MIT
