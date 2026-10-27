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

What an approved IR records about its approval, and how it is committed, checked and
updated, is in [approval.md](approval.md).

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

## Input modes — who answers the questions

**The spec owner answers the question list — never the implementation.** Filling
holes by reading the code silently promotes whatever the code currently does into the
spec, destroying the ability to detect drift.

Declare one of two input modes when you start converting a spec:

| | Mode A: spec only | Mode B: spec + implementation |
| --- | --- | --- |
| Sources | the spec and the owner's answers | the spec, the implementation, its existing tests |
| Use for | features with no implementation yet; reviewing the spec itself; deliberate blind runs | features that already exist (the default when an implementation exists) |
| Holes in the spec | become questions | may be filled from the code, but only as recorded deltas |

Mode B carries one obligation that keeps it from becoming circular: **no code-derived
fact enters the IR silently.** Each one is recorded twice — as a delta (version n →
n+1) and as a reverse question to the owner ("the implementation does X, the spec says
Y or nothing — which is right?"). Record the mode and the implementation reference
(commit, date) in `source.version`. Read the implementation only where an IR slot
points: branches and visible text for transitions and outcomes, validation and
fallbacks for rules, concurrent handlers for races, form validation for inputs, flags
that change behavior. Existing tests are secondary evidence — they show contracts that
used to hold.

## Running a review round

A review round turns check results into questions, collects answers, and repeats until
the IR can be approved. Four rules keep the rounds short:

- **Every finding becomes a question in the first round.** Map each error and each
  pending marker to some question (aggregating is fine — one question per decision),
  and state the mapping in the report as counts (e.g. "16 errors → Q1–Q6, W1–W3;
  16 pending → W4–W12, R1"). Anything the approval check would reject must be asked in
  round one, or it surfaces only when someone tries to approve
- **Each question carries one proposed answer.** Give a concrete answer the owner can
  accept as-is, with a short reason (the closest statement in the spec, the existing
  feature the spec says to treat this "the same as", the usual behavior of similar
  features). For questions about displayed text, propose the literal text — and when
  the same situation already has text in the product, propose that text rather than
  inventing new wording
- **Check the existing screen before using it as a basis.** When a proposal says "the
  same as existing X" (the same situation's text, the neighboring column, existing
  values on the same screen), look up how X appears today — in the client code, its
  formatter, or existing UI tests and snapshots — and cite that file as the basis.
  Check three things:
  - **text**: the wording X uses
  - **format**: currency symbol (and its width), thousands separators, units, how zero
    is shown
  - **empty, failed and no-permission states**: what X shows when a value is missing,
    fails to load, or is not allowed — blank, filled with zero, or the row hidden

  If what X does today contradicts another rule in the spec (X fills with zero; the
  spec says "never show zero for a failure"), the question is must-ask, not an
  assumption. An unchecked "same as existing" is a guess and is not a basis. This is
  the one place mode A reads the implementation, and only for how the existing thing is
  displayed; the new feature's behavior still comes from the spec and the answers
- **Accept by default; ask only what must be asked** (below). Owners should spend their
  time on the decisions that need them, not on confirming the obvious one by one
- **Override in bulk.** Let the owner reply with ranges — `OK: W1–W8` confirms, `W4: "…"`
  replaces one. A reply that matches neither form is not counted; ask again. In an
  interactive session, a form with the proposals pre-selected does the same job
- **Keep an answer ledger.** Record every question, its proposal, the answer, who
  answered and when, and which IR cells or rules it changed. Chat and comments are
  only how answers arrive; the ledger is the source of truth. Answers normally have to
  be written back into the spec before they count. A run may instead declare the
  ledger an addendum to the spec (for example when the spec document cannot be edited)
  — then tag each IR entry it produced with the answer id, and list the answers in the
  change that commits the approved IR, so reviewers can see where spec text that is
  not in the spec document came from

Answers often open new questions — an answer that adds a state brings that state's
undefined cells with it. Re-run the checks after every batch of answers.

### Accept by default

Each question is put in one of three tiers when it is raised. **The tier comes from
rules, not from how confident the proposer feels:**

| Tier | Which questions | Handling |
| --- | --- | --- |
| **Must ask** | contradictions in the spec; anything touching money, legal or compliance, personal data, or safety; a critical gap (undefined combination, dead end) whose proposal has no basis in the spec or in an existing feature | marked `TBD`; asked explicitly; blocks approval until answered |
| **Assume** | everything else with a basis: text, format or empty/failed handling checked against the existing screen, behavior "the same as" a feature the spec names, races with an obvious winner, gaps the spec's own nearby rules settle | the proposal is applied to the IR as a declared assumption (`ASSUMED(<id>)`, [usecase-ir.md](usecase-ir.md#assumptions-and-the-question-list)); listed for review |
| **Note** | suggestions (candidate events the spec does not mention, scope questions) | in the report only |

At approval the owner sees two things: the answers to the must-ask questions, and the
list of assumptions — question, applied answer, basis. Approving the IR accepts every
assumption on that list, and the approval record names them (`assumptions_accepted`,
[approval.md](approval.md#the-approval-record)), so "approved with these assumptions"
is explicit in the file and in its history. The owner only writes something for the
assumptions they disagree with.

In one trial, this would have cut 24 answers to about 8, plus one list to scan. The risk
is that defaults get rubber-stamped; two things keep that in check: must-ask is decided
by rule, and every assumption stays marked in the IR and listed in the change that
commits it, so a test that later fails on an assumption traces straight back to it.

In a later trial, the only problems found after approval were assumptions based on an
existing screen that nobody had looked at: zero written with a currency symbol next to
columns that show a plain `0`, "the same as a failed load of column X" when X actually
fills failures with zero, and a half-width currency symbol where the table uses
full-width. Each forced the approval to be redone, and each would have been caught in
round one by the check above.

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
