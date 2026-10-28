# Generation principles — generating tests and implementation from the approved contract

The checker in this repository guards the quality of the contract (UseCase IR +
bindings). This document collects the principles for the **side that generates tests
and implementation** from that contract. It does not include a generator
implementation — only the principles and the structure learned from real use (2026,
first-shot Green demonstrated on several internal features).

## Test layers — route each scenario to the cheapest layer that can catch it

One IR feeds three test layers. The routing is part of the method, not a per-project
choice:

| Layer | Source in the IR | Scope | Backend | Role |
| --- | --- | --- | --- | --- |
| **Unit** | `rules` case tables | every rule case | none (pure functions) | rules are extracted into pure functions; the function and its tests come from the same case table, so unit tests are **Green from birth** (a Red here is a generator bug) |
| **Integration** | **all** `scenarios` | full scenario set | **fake server** (deterministic) | the main body of coverage and the acceptance-first layer below. Givens are registered on the fake; side effects are verified by asserting the recorded API calls (and their absence, as a negative oracle) |
| **E2E** | only scenarios marked `critical: true` | the few must-not-break paths | real environment | **drift detector**: it runs against the real system, so a Red means the spec and reality diverged — a human adjudicates which side is right |

Two consequences worth stating explicitly:

- **Coverage lives in Integration, not E2E.** E2E stays small (critical paths only)
  because its job is detection against reality, not breadth. Breadth belongs to the
  deterministic layer where flakiness cannot blur the verdict
- **E2E must stay independent of co-generation.** When implementation and Integration
  tests are generated from the same contract they agree constructively (see
  "Handling Red"); E2E is kept as an oracle that does not share that construction,
  so the pipeline always retains one detector the contract cannot fool

### Integration on mobile apps — name the layer

On the web, integration means one thing (the page against a fake server). A mobile app
with an on-device state machine splits it into layers, and a case belongs to the one
that can actually observe its outcome. Decide the layer in the test plan, not while
generating:

| Layer | Drives | Fits |
| --- | --- | --- |
| `state_machine` | the app's state machine with a fake API | transitions, which dialog appears, whether an API is called, showing a server-supplied message |
| `screenshot` | the real UI components rendered in a test | display format (name suffixes, ordering), elements that must be absent (an input that is not offered, an unsupported attachment), masked values |
| `backend` | server-side tests | race winners and first-to-arrive decisions — anything the server adjudicates |

A case that spans layers (the server picks the winner, the app shows the loser's
message) is split into one case per layer. Routing every mobile case to "integration"
without a layer leaves cases that no layer can run: in one trial, 5 of 11 such cases
could not be written at the state-machine level.

## Generation rules — from the approved IR to code

The rest of this document explains why; this section is the conversion itself. Tests are
generated in two stages:

```
approved IR + bindings + step definitions
   ↓ resolve — every phrase must have a step definition, or generation stops
scenario files (one per scenario and per race outcome: the walked path, resolved)
   ↓ render — no decisions left to make
test code
```

Product code reads the IR, the bindings and the project's pattern registry, and records
its decisions in a [generation decision record](#generation-decision-records) before the
code. A worked example of both is in
[examples/order-cancel.generated/](../examples/order-cancel.generated/), with an example
generator in [examples/generator/](../examples/generator/) whose test regenerates every
file and compares it with the committed one.

### Step definitions and scenario files

The IR says *what* happens in prose ("the order status shows "Packed""), and the bindings
say what the screen's elements and copy are. Neither says which test operation a phrase
is. Without that, every generation run interprets the prose again, and two runs can
interpret it differently. Two artifacts close that gap:

- **Step definitions** (`<usecase>.steps.yaml`, reviewed with the IR and the bindings) — the
  step vocabulary. Every phrase a test has to set up, perform or check maps to a driver
  or harness call: start states to fixtures, `given` texts to the state they describe,
  events to a screen method (or a fixture for `actor: system`), and outcome texts to an
  assertion and its negation. A rule case maps to the pure function's arguments and return
  value. A phrase nothing can observe yet is written down as `unresolved: <reason>`, never
  left out
- **Scenario files** — the resolved form of one scenario: the start fixture, each step
  with its transition, actor, call and operation, and each outcome with its node ID and
  assertion, plus the questions resolution raised. They are generated, never edited, and
  they are the diff to read in review: a change in the IR or the step definitions shows
  up here before it shows up in code

Resolution is the check that makes generation reliable, and the checker runs it before any
generator does (`--steps`, below). A phrase with no step definition stops generation and is
reported. A `given` that describes a different state than the path starts from goes on the
question list. An `unresolved` outcome is rendered as a
comment rather than an assertion, so its trace node stays visible as untested. A race
outcome that cannot be asserted produces no test at all, because a test with nothing to
assert would be a false green.

What matters is the split: vocabulary that people review (the step definitions), a
resolved intermediate that a machine produces (the scenario files), and rendering that
makes no decisions. The scenario file shape is the example generator's choice; the step
definitions format is checked.

#### Checking step definitions

```bash
npm run check -- examples/order-cancel.usecase.yaml --steps examples/order-cancel.steps.yaml
```

```yaml
steps: UC-ORDER-CANCEL-001 # target usecase id (must match the IR)
states:   # start state → fixture
  PLACED: { fixture: paidOrder }
givens:   # given text → the state it describes, or a fixture
  "one paid order exists": { state: PLACED }
events:   # event → a screen method, or a fixture for actor: system
  pack: { screen: pack }
  complete: { fixture: completeDelivery }
outcomes: # outcome text → assertion (+ negation, args), or why it cannot be asserted yet
  'the order status shows "Packed"': { expect: expectStatus, not: expectStatusNot, args: [status_packed] }
  "no cancellation fee is charged (RULE-001)": { unresolved: "nothing shows the fee charged" }
rules:    # rule → the pure function and one entry per IR case, in IR order
  RULE-001:
    function: { name: cancellationTerms, from: ./cancellation-terms.ts }
    cases: [{ args: [PLACED], returns: { kind: free, feeCents: 0 } }, …]
```

With the target IR passed alongside, the check covers the full population the IR declares:

| check | level | what it enforces |
| --- | --- | --- |
| steps-schema | error | the target id; known sections only; a state names its fixture; a given names a state or a fixture; an event a screen method or a fixture (exactly one); an outcome an assertion or a non-empty `unresolved` reason; a rule its function and a case list |
| steps-coverage | error | every IR event, every scenario given, every outcome (states mode: transition and race outcomes; form mode: scenario `then` items) and every rule has a definition; the initial state and every race state have a fixture; a rule has exactly as many cases as the IR; a given's state exists. A definition naming something the IR does not have is also an error — editing an outcome's text in the IR shows up as one missing and one stale entry |
| steps-usecase | error | the target does not match the IR, or the IR is not among the inputs |
| steps-unresolved | warn | an outcome that cannot be asserted yet — it is on the question list |
| steps-given-state | warn | a given describes a state other than the initial one, while every path starts there |

### What each IR element becomes in tests

| IR element | Unit | Integration (every scenario) | E2E (`critical: true` only) |
| --- | --- | --- | --- |
| `rules[].cases` | one table-driven test per rule, one row per case in IR order | — (shows through scenario outcomes) | — |
| `scenarios[].given` | — | the fake's state, set before the page opens | data created through the real system's seed or API |
| `scenarios[].path` | — | one driver call per event, in path order, by the event's `actor` | the same, through the same driver |
| the transition `to` of each step | — | the fake's response for the event's operation | — (the real system decides) |
| a transition's `outcome` items | — | assert before the event that it does not hold yet, assert after, then print the `[ESDD-OUTCOME]` marker | the same |
| the event's operation (bindings `events`) | — | assert the fake recorded the call | — |
| `actor: system` events | — | the fake's state changes; the driver re-reads the screen | the real system's own entry point |
| `races` | the winner (backend) | the loser's view: the fake holds the winner's `to` state and rejects the loser's operation ([trace.md](trace.md#a-race-is-two-nodes--the-winner-at-backend-the-losers-view-at-integration)) | — |
| `impossible: true` cells | nothing | nothing | nothing |

The steps of a test are what walking the path produces. When a scenario's `given` or
`when` disagrees with its path, the path wins and the disagreement goes on the
question list.

### Test files

- **Name**: every test carries `<usecase>__<node>` ([trace.md](trace.md#tags--put-usecase__node-in-the-test-name)):
  one test per scenario (`SC-001`), one row per rule case (`RULE-001-c1`). Do not merge
  scenarios to share setup; share it through fixtures instead
- **Header**: every generated file starts with the IR path, the `source.version` it was
  approved at, the nodes it covers, and the no-invention line. A header whose version
  differs from the approved IR shows in review that the file is stale
- **Test bodies use IR vocabulary only**: they call the
  [semantic driver](#semantic-driver-vocabulary-isolation) with event names and bindings
  literal keys. Locators, copy, routes and widget quirks live in the adapter, which reads
  the bindings file instead of retyping it
- **Fixture values are not oracles**: values the `given` does not name (an item, a price)
  are fixture choices behind the step definitions' fixtures, and no assertion may read them

### What the generator may add, and what it may not

| May add (plumbing) | May not add (behavior) |
| --- | --- |
| waits on a state the IR names, navigation, sign-in, fixture creation and cleanup, adapter mechanics | steps, assertions, copy, locators or data values that no IR or bindings entry derives; retries that hide a Red; dropping an outcome the path implies |

When a test needs something from the right-hand column, it does not get it. A gap in the
spec goes on the question list; a gap in generation decisions goes in `unprescribed`.
Until the spec answers, the outcome stays unasserted, and the trace reports its node as
uncovered.

### Product code

- **Select, then instantiate**: choose a pattern from the registry by the IR's shape,
  follow its exemplar, and record the choice in the decision record
  ([pattern registry](#pattern-registry-select--instantiate))
- **Vocabulary from the bindings only**: element names, copy and API operations
- **A rule is implemented once**: as the pure function its unit tests import. The
  component calls that function and does not reimplement the rule
- **No behavior the IR lacks**: no handler for an `impossible` cell, no user-visible state
  the IR does not name. A value the IR leaves open, such as an amount, goes on the
  question list rather than into a constant
- **Layers stay separate**: product code never imports test code, and tests reach product
  code only through the driver and the rule functions

### Done

| Artifact | Done when |
| --- | --- |
| unit test | Green on the first run (a Red is a generator bug), with a negative control |
| integration test | Green with a negative control, or Red until the implementation lands under acceptance-first |
| E2E test | ran against the real environment; any Red has been adjudicated by a person, not edited to Green |
| product code | the integration suite is Green with no change to test bodies, and the decision record is reviewed with every `unprescribed` entry dispositioned |
| all layers | `--results` for every layer leaves no trace errors |

### When the IR changes

Approved IR updates keep IDs and order ([approval.md](approval.md#updating-an-approved-ir)),
so regenerate per node. Tests for unchanged nodes keep their code, changed nodes are
regenerated, and tests for removed nodes are deleted. A leftover tag fails `trace-tag`.
Do not hand-edit a generated test body; change the IR, or the adapter for implementation
vocabulary.

## Acceptance-first

For a new feature, integration tests can be made to "work" with zero implementation:

1. **Review the bindings at the same time the IR is approved.** Labels, button copy,
   and error copy are fixed up front as contract (anything missing from the spec goes
   on the question list)
2. **Generate the semantic driver and the tests from the IR.** The test bodies carry
   no implementation vocabulary at all, and are landed in an initially Red state
3. **The implementer (human or generator) is done when these tests are Green.**
   An implementation that disagrees with the contract stays Red = the contract is
   enforced mechanically

When the contract introduces names the codebase does not have yet (a new enum value, a
new event, a new screen state), the tests cannot compile. Add **declaration-only
stubs** — the names with no behavior — so the suite compiles and its Reds point at
missing behavior, not missing symbols. Keep the stubs out of the commit: provide them as a
separate patch next to the suite, so implementers can apply them to see the Reds before
they start. Adding a value to an enum that is matched exhaustively will also break
every exhaustive match on it; route the new value to the "unknown" branch in the stubs,
and hand the list of those places to the implementers — each one is a decision the
spec has to make.

Measured: 7 acceptance tests generated ahead of an unimplemented spec → implemented
toward the contract → **all Green with zero changes to the test bodies**. A
replication run — handing only the contract and the documentation to an agent in a
separate session — also reached first-shot Green (zero iterations) on both typecheck
and tests.

## Semantic driver (vocabulary isolation)

Generated tests never touch the screen directly; they go through a **driver** that is
mechanically derivable from the IR's input axes:

```ts
await form.set("email", "a@example.com");
await form.submit();
await form.expectSaved();
```

- The test body uses IR vocabulary only. Implementation vocabulary (real locators,
  widget-interaction quirks) is isolated into **a single adapter file**
- The impact of an implementation vocabulary change is confined to the adapter; the
  test body is invariant
- For new features (acceptance-first) the bindings constrain the implementation, so
  the adapter becomes an identity mapping

## Pattern registry (select → instantiate)

Components are not free-generated. Two stages: **select(pattern) →
instantiate(bindings vocabulary)**:

1. Choose a pattern from the **shape** of the IR's scenario / event / outcome (the
   registry's `selects_on` is the only basis for selection)
2. Read the pattern's **exemplar (a real file)** and follow its structure, error
   handling, and placement
3. Materialize the vocabulary from the bindings / IR literals (the no-invention rule)
4. When you meet a shape with no matching pattern, **extend the registry first**,
   then generate

The registry is a project-specific asset (not included in this repository). How to
build one: census the existing codebase and record the recurring archetypes as
"selection criteria + exemplar + structural notes". Where competing implementation
styles exist, write the winner down as a **ruling**, and explicitly mark patterns
with no real exemplar as "not registered" (to distinguish them from the unexamined).

The provenance audit that grounds this: every decision in a hand-written
implementation (~1,000 lines) could be classified into **A) contract-derived /
B) house-pattern-derived / C) free discretion (cosmetic)** — with zero left
unclassified. So the inputs needed for generation close over the contract (A) and
the registry (B), and C can follow the exemplar.

## Generation decision records

Record generation-level decisions as a **decision record**, written before the code:

```yaml
record: FE-GEN-<usecase-id>
source: { usecase: …, bindings: …, registry: … }
selections:            # which pattern was chosen for which shape (references only)
  - { target: "the save form of SC-001", pattern: mutation_form, exemplar: …, output: … }
file_plan: { new: […], modified: […] }
unprescribed:          # every decision no input prescribed (write [] explicitly if empty)
  - { decision: "placement of the warning", disposition: registry-addition } # or question-list / accepted
literal_sweep: { unmatched_rules: [] }
```

- Carries no re-description of behavior and no code fragments (decisions and
  references only)
- `unprescribed` dispositions: `registry-addition` (the machine answers next time) /
  `question-list` (a hole in the spec) / `accepted` (usable only for cosmetic free
  discretion)
- Purpose: turn "decisions nobody made" into a **reviewable artifact before
  generation**, not a self-report after it

## Bug tickets — mechanism scenarios

When the input is a bug report instead of a spec, read the report, its discussion, the
fix's description and the incident timeline as the spec — they describe **how the
failure happens**. Write that mechanism ("while the region is not yet decided, a
notification arrives") as **its own scenario**, separate from the scenarios for the
general rule. Tests of the general rule alone can be Green on the unfixed code and
never catch the bug again. Then route the mechanism scenario to the layer that can
reach its state: an E2E test that waits for a terminal state cannot observe a window
that closes in milliseconds, so such mechanisms usually belong in a backend test that
builds the state directly. Confirm the generated test **fails on the code before the
fix** — that is the evidence it detects the bug. If nothing describes the mechanism,
put that on the question list.

## No false greens

A generated test can pass because nothing changed, not because the right thing
happened. Guard against it while writing and after running:

- **Assert the state before the action too.** A test that asserts an outcome first
  asserts that the outcome does **not** hold yet ("before the assignment arrives, the
  order is not confirmed" → "after, it is"). Otherwise a test passes on an
  implementation that was already in the end state. Outcomes that cannot have a "before"
  (something is not shown) need a contrast instead: show that the same path does
  display other data
- **Put fake values where the implementation reads them.** Before injecting an error
  message or a displayed value into a fake, check which field the implementation
  actually displays. A value in the wrong field fails a correct implementation, or
  passes a wrong one
- **Count a Green only after a negative control.** Break the expectation or change the
  fake's response, and confirm the test fails once. Report Greens without one as
  "Green (no negative control yet)"

## Handling Red

- **A generated test going Red against an existing implementation = detection of
  drift between spec and implementation.** A human adjudicates which side is right.
  Quietly fixing the test to Green destroys the detector
- Unit tests immediately after generation are expected Green (the function and the
  test come from the same case table). Red there means a generator bug
- Under co-generation (implementation and tests generated from the same contract)
  the two agree constructively, so the safety net moves to contract review
  (bindings + generation decision records). co-generation without contract review is
  self-consistently wrong
