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
   ↓ transform
UseCase IR ……… single source of behavior (states/events/transitions/races/inputs/scenarios/rules)
   + bindings … locator / literal contract (single source of UI vocabulary)
   ↓ machine checks (this repository's checker)
check results = the question list for the spec owner
   ↓ answers are folded back in; approval once every check passes  ← the single human approval point
approved contract
   ↓ generation (decisions only, recorded in thin target IRs)
test code / implementation code (all quality concentrates in the upstream contract)
```

One IR feeds four test layers (see [docs/generation.md](docs/generation.md)):
`rules` become pure functions + unit tests, race winners and other server-side decisions
become backend tests against a real database, **all** `scenarios` become integration
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

# states mode + bindings + step definitions (the inputs examples/order-cancel.generated/ is built from)
npm run check -- examples/order-cancel.usecase.yaml --bindings examples/order-cancel.bindings.yaml \
  --steps examples/order-cancel.steps.yaml

# form mode (no states) + cross-check against bindings (the locator/literal contract)
npm run check -- examples/contact-email.usecase.yaml --bindings examples/contact-email.bindings.yaml

# the approval digest: the IR as Markdown for the approver (no checks)
npm run check -- examples/order-cancel.usecase.yaml --digest

# a PRD: check the frame (why) together with the IRs it links (what), then render the PRD document
npm run check -- --prd examples/order-cancel.prd.yaml
npm run check -- --prd examples/order-cancel.prd.yaml --profile examples/prd-profile.yaml --render

npm test
```

## What the checker checks

Every check is a plain graph traversal over the declared format; there is no model
checker. The format is designed so the checks are trivial, and each failure message is
phrased as a question for the author and the spec owner.

**UseCase IR** (`docs/usecase-ir.md`):

| Check | What it enforces |
| --- | --- |
| structure | schema shape, ID formats and required fields; also text split by an ASCII comma in a flow sequence `[...]` / flow mapping `{...}` in scenario given/when/then, transitions/races outcome and rules expected (e.g. `[shows $9,000]` parsed as `shows $9` and `000`: a trailing digit followed by a 3-digit item, an unclosed bracket pair, or a key with no value) |
| exhaustiveness | every non-terminal state × event cell is declared as a transition, `impossible: true` + reason (the event never arrives) or `ignored: true` + reason (it arrives and changes nothing) |
| determinism | no duplicate declarations for the same cell |
| terminals | no transition leaves a terminal state, and at least one terminal state exists |
| reachability / escapability | no state unreachable from the initial state, no state that cannot reach a terminal |
| race obligation | if events of different actors are both possible in a state, a `races` winner declaration is required (one of the two events, or `first` when arrival order decides) |
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

**step definitions** (`docs/generation.md#checking-step-definitions`):

| Check | What it enforces |
| --- | --- |
| schema | each phrase maps to exactly one kind of call (a screen method, a fixture, an assertion) or to an `unresolved` reason |
| coverage | **every IR event, given, outcome and rule case** resolves, and no definition names something the IR lacks |
| unresolved / given-state | outcomes that cannot be asserted yet and givens that disagree with the path, as warns for the question list |

## Why literal_coverage

When implementation and tests are **co-generated** from the contract (bindings), they
agree constructively — a wrong contract produces a wrong implementation and a wrong
test that agree and pass. So contract review becomes the quality safety net.
literal_coverage turns the "the rule demands UI copy but the contract has none" class
of inconsistency into a machine finding at contract-review time instead of a
discovery after generation.

## Documentation

- [docs/pipeline.md](docs/pipeline.md) — the pipeline: the single approval point, the
  two phases (drift detection vs co-generation), input modes, running review rounds
  (questions and severity, proposed answers, accept-by-default assumptions, bulk overrides, the answer ledger), diff-editability, and target IRs
- [docs/usecase-ir.md](docs/usecase-ir.md) — the UseCase IR format and its authoring modes
- [docs/prd.md](docs/prd.md) — writing the PRD itself from the IRs: the PRD frame (problem, users,
  goals with metrics, non-goals), its checks, the rendered PRD (EARS-style requirements, acceptance
  criteria, open questions from the checker), per-company profiles, and the authoring loop
- [docs/bindings.md](docs/bindings.md) — the bindings (locator/literal contract) format
- [docs/generation.md](docs/generation.md) — generation-side rules and principles (the
  IR-to-code conversion rules for tests and product code, step definitions and scenario files, test layers incl. mobile,
  acceptance-first with declaration-only stubs, semantic drivers, pattern registries,
  generation decision records, test data and side effects, tests ahead of the implementation,
  mechanism scenarios for bug tickets, no false greens, visual evidence, handling Red).
  [examples/order-cancel.generated/](examples/order-cancel.generated/) is a worked example, produced from
  the IR, its bindings, its step definitions and a pattern registry by the example generator in [examples/generator/](examples/generator/)
- [docs/approval.md](docs/approval.md) — approved IRs: the approval record, `--approved`, what the
  approver reads (`--digest` and the diff from the last approval), binding the approval to one exact IR,
  sending an approval back, partial approval, and order-preserving updates
- [docs/trace.md](docs/trace.md) — the behavior trace: cross-checks that every IR node
  is confirmed by a test that actually ran (`--results`), with negative-control records

## Configuration

A project narrows or extends the checker without forking it: pass a TypeScript module with
`--config <file>` whose default export is an `EsddConfig` (`src/config.ts`). Every field is optional.

| Field | What it does |
| --- | --- |
| `actors` | closes the actor vocabulary; an event with another actor is a structure error |
| `pendingMarkers` | more markers that count as unanswered, besides `TBD` / `TODO` / `FIXME` / `UNRESOLVED` |
| `platforms` | bindings platforms besides `web`, by name ([docs/bindings.md](docs/bindings.md#extending-platform-profiles)) |
| `digest` | the approval digest's fixed words (`DigestLabels` in `src/digest.ts`), for approvers who read another language |

[examples/esdd.config.ts](examples/esdd.config.ts) uses every field. A project that copies `src/` into
its own repository keeps the copy unchanged and puts what is its own in this module, so a later copy
replaces `src/` without a merge.

## Status

v0.2 — includes the IR checker, the bindings checker (web/Playwright profile), the
approved-IR check (`--approved`, including accepted assumptions), declared assumptions
(`ASSUMED(<id>)`), the step definitions check (`--steps`) and the behavior trace (`--results`).
Platform profiles are an extension point (for mobile and the like, each project adds its own
locator vocabulary through the configuration). A production generator is not included —
generation is run per project, following the rules in `docs/generation.md`, together
with that project's vocabulary registries. `examples/generator/` is an example-only
generator for the order-cancel example: it generates the tests and the product code, and
`npm run example:integration` runs the generated integration tests against the generated
product code in Chromium.

## License

MIT
