# The pipeline — approval, phases, and day-to-day operation

ESDD decomposes specification verification into two parts: **test execution by
machines, and approval by humans**. This document covers the operational side of the
method: where the single approval point sits, what the two phases mean, how the IR is
edited day to day, and how downstream artifacts stay thin.

## The shape of the pipeline

```
Specification (PRD / design docs)
  ↓  transform (AI or human)
UseCase IR (the spec written as a state machine / input axes)
  ↓  machine checks (exhaustiveness, determinism, reachability, coverage, …)
Check results = a list of questions about the spec (undefined combinations, …)
  ↓  a human answers; the IR is revised
A human approves the IR once every check passes   ← the single human approval point
  ↓  transform (generation)
target IRs → test code / implementation code → execution
```

Quality assurance concentrates on the two ends:

- **Upstream QA = approving the spec.** The checker turns undefined combinations into
  a question list; the human's job narrows to answering those questions and approving
  an IR that passes every check. There is exactly one approval point in the pipeline.
- **Downstream QA = test results.** The pass/fail verdict comes from a machine.
- **The transformations in between carry no semantic checks.** Going from IR to
  target IRs to code, the only thing to verify is **content preservation**: nothing
  from upstream was lost, and nothing that isn't upstream was added (the no-invention
  rule). Concentrating semantic checking at the single upstream point is what makes
  the intermediate artifacts machine-reviewable.

Human review does not disappear — it changes character: from exhaustively reading
artifacts end to end, to answering machine-generated questions and deciding, when a
test fails, whether to fix the spec or the implementation.

## Scope

The pipeline covers the **UI behavior** of web and mobile apps: states, transitions,
displayed text, input validation. It does not cover UX quality such as layout or
visual design. Keeping the appearance and type of input fields out of the IR is a
deliberate decision — that information belongs to the design-tool and component
layers, not the behavioral contract.

## Two phases

The upstream (IR checking and approval) is identical in both phases; what changes is
what a generated test's verdict means.

| | Phase 1: implementation exists | Phase 2: implementation does not exist yet |
| --- | --- | --- |
| What is generated | tests (E2E for critical paths) | frontend code **and** integration tests together |
| Expected verdict | **Green** | Red on the old build, **Green on the generated build** |
| A Red means | **drift detected** between spec and implementation — a human decides which side to fix | on the old build: proof the tests actually verify the feature (the detector criterion) |

Not using E2E as the verification layer in Phase 2 is deliberate: E2E presupposes
that environment, test data, and the full journey between screens already exist —
far too costly in a phase that generates the implementation itself. Integration tests
against a fake server have no environment-induced flakiness, and because frontend and
tests are generated together, the mapping to screen elements is closed inside the
generation step (see [bindings.md](bindings.md) and [generation.md](generation.md)).

## Who answers the questions

**The spec owner answers the question list — never the implementation.** Filling
holes by reading the code silently promotes whatever the code currently does into the
spec, destroying the ability to detect drift.

The one exception is onboarding an existing feature for the first time: there, the
implementation and its tests may serve as a source — but every code-derived fact is
recorded as an explicit delta and surfaced as material for updating the spec, not
silently merged.

## Editable by diff

Every element in the IR keeps a **stable ID** (states, events, scenarios, rules,
inputs), and ordering follows fixed rules. A behavior change is therefore written as
a meaningful diff — "this combination's outcome changed", "this transition was
added" — rather than by regenerating the whole IR.

This is what makes the loop sustainable operationally:

- **A behavior change travels as an IR diff in the same PR as the feature change.**
  This is the only mechanism that keeps spec and tests from drifting apart.
- If full regeneration were the only tool, every small change would put the entire
  approved IR back under review, and the practice would not survive.
- The flow is one-directional and always starts from the spec. **If rewriting the IR
  from the implementation ever becomes routine, that is the sign the loop is no
  longer a loop.**

## Target IRs — decisions only, never behavior

Behavior lives in exactly one place: the UseCase IR. Each deliverable (integration
test code, E2E test code, generated components, …) gets its own thin **target IR**
layered on top. A target IR never restates behavior; it holds only the decisions that
belong to that target, plus references upstream:

```yaml
# target IR for E2E tests (excerpt)
suite: E2E-EXAMPLE-001
usecase: UC-EXAMPLE-001    # behavior is only a reference to the UseCase IR
cases:
  - id: TC-1
    scenario: SC-001       # points at a scenario in the UseCase IR
    priority: high         # a decision specific to this target
    environment: staging   # choice of execution environment
```

Test steps are not written here: scenarios in the UseCase IR are defined as paths
through the transitions, so steps are **derived mechanically by walking the path**.
What remains in a target IR are only the decisions that can be made nowhere else:
which scenarios to include (all of them for integration tests, `critical: true` only
for E2E), priority, environment. Because behavior lives in one place, a spec change
has exactly one place to fix.

The [generation decision record](generation.md#generation-decision-records) is the
target IR for generated implementation code — same contract: selections, references,
and undecided points; no behavior, no code.
