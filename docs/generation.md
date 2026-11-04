# Generation principles — generating tests and implementation from the approved contract

The checker in this repository guards the quality of the contract (UseCase IR +
bindings). This document collects the principles for the **side that generates tests
and implementation** from that contract. It does not include a generator
implementation — only the principles and the structure learned from real use (2026,
first-shot Green demonstrated on several internal features).

## Test layers — route each scenario to the cheapest layer that can catch it

One IR feeds four test layers (the same names the behavior trace uses, [trace.md](trace.md)).
The routing is part of the method, not a per-project choice:

| Layer | Source in the IR | Scope | Backend | Role |
| --- | --- | --- | --- | --- |
| **Unit** | `rules` case tables | every rule case | none (pure functions) | rules are extracted into pure functions; the function and its tests come from the same case table, so unit tests are **Green from birth** (a Red here is a generator bug) |
| **Backend** | race winners, server-side decisions (filtering by permission or region, first-to-arrive), mechanism scenarios | what the server decides | **real database** | the state is built directly with fixtures, so windows an E2E test cannot reach become testable. Races go here and to integration as two nodes ([trace.md](trace.md#a-race-is-two-nodes--the-winner-at-backend-the-losers-view-at-integration)) |
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
- **E2E checks that a server-side decision is connected, not the decision.** Filtering
  by permission or region is asserted in backend tests, which build the state cheaply
  and deterministically; an E2E test that passes through it only checks that the path works

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
could not be written at the state-machine level. A mobile case that reaches generation
without a layer is sent back to the test plan; the generator does not route it.

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

A step definition names only driver or harness calls that already exist in the project's
helper registry. A missing call is added to the registry before the step is defined, so
resolution never points at a call nobody wrote.

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

The rule also runs backwards: every gated assertion traces to an IR outcome. An
assertion with no source (an orphan) is a drift alarm — the test checks something the
contract does not say — and is reviewed, not kept.

### Product code

Product code goes through the same three stages as tests, with the pattern registry in the
place of the step definitions:

```
approved IR + bindings + step definitions + pattern registry
   ↓ select — every shape must match a pattern, or generation stops
decision record (generated: the pattern per target, its filled slots, and `unprescribed`)
   ↓ render — no decisions left to make
product code
```

Selection fills each slot from an input: status copy from the outcomes and the bindings
literals, controls from the events and their actors, which states offer a control from the
transition matrix, rule calls from the outcomes that cite a rule, and API conventions from the
registry's rulings. A slot no input fills becomes an `unprescribed` entry rather than a
choice, and the code renders without it. The rule functions come from the same case table as
their unit tests, so those tests are Green from birth. The integration tests are generated
independently of the product code, and are the check that the two agree.

The example in [examples/order-cancel.generated/](../examples/order-cancel.generated/) runs
this end to end: `npm run example:integration` runs the generated integration tests against
the generated screen in Chromium. Selection flags two questions on its own: no outcome names
the status text of the initial state, and the bindings have nothing for what the losing side
of one race sees. This is the least established part of the method; the registry format and
the slots are one possible shape, not something the checker enforces.

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

## Test data, side effects, and tests ahead of the implementation

Steps and assertions derive mechanically from the IR. Three things around them do not,
and each needs a rule of its own.

### Test data lifetime

How long test data lives depends on the target resource's API, not on the IR. Pick one
named strategy per resource:

| Strategy | When | What |
| --- | --- | --- |
| **full-cycle** | the resource has a delete API | each run creates, verifies, and deletes. Nothing accumulates, and every run exercises the create path |
| **create-once fixture + per-run update** | no delete API (often by design, e.g. records that must be retained) | a marked fixture is created through the UI on the first run only (that run verifies the create path); later runs find it and verify the update path. Accumulation stops at the number of fixtures |
| **idempotent seed** | the test needs reference data (people, accounts) | upsert or assign-once into records reserved for tests |

Decide by checking for a delete API first; without one, use create-once. When a
scenario needs a subject in several states (a filter needs both "answered" and
"unanswered" items), keep one fixture per state, record in the scenario file which
fixture permanently holds which state, and never let a per-run update break that state.
Without a natural key, find a fixture by a marker at the start of a free-text field
that the list view shows, so people can recognize it too.

### External side effects

Before running generated tests in a shared environment, check whether any IR outcome
causes a side effect outside that environment: calls, messages, emails, push
notifications, payments, writes to an external service — anything cleanup cannot undo.

1. Go through the outcomes one by one and list each side effect and its recipient.
   Check whether the recipient falls back to an environment default; defaults are
   sometimes real people or businesses
2. Send side effects only to recipients the testing team owns. Without such a fixture,
   generate and compile the test but do not run it, and hold its promotion
3. Declare the side effects in the scenario file. The test fails fast, before the
   action that causes the side effect, when the fixture is not configured — it never
   falls back to the default silently

### Tests before the implementation exists

Tests can be generated before the feature is implemented. Until it lands, prove the
test code itself (locators, flow, waits) against a **generated frontend (the scaffold)**:

1. Locators cannot be measured, so the bindings are the source of locators — check
   them (including literal_coverage) before generating
2. Generate the scaffold with the pattern registry. When the API has not landed, a
   **temporary schema** shaped exactly like the contract lets it run locally: add the
   contract's fields, inputs, payloads and errors to a local copy of the schema,
   regenerate the client, and wire the scaffold to it. The temporary schema is never
   committed; the real API lands through the backend's own change, and if its shape
   matches the contract, only the one call site that invokes it moves
3. Run the tests against the scaffold until they are Green and have negative controls.
   This verifies the tests, not the product
4. Keep the scaffold out of the test change. Only the tests are delivered in it; the
   scaffold is handed over separately as a candidate implementation (below)
5. The delivered tests are Red detectors until the implementation lands. Mark them as
   waiting in the scenario file and keep them out of gating CI lanes until they have
   been seen Green against the implementation

**Simulated backend.** When a given creates data through a backend path (a webhook, a
callback), the scaffold has no backend, so a throwaway stub stands in. Derive the stub
from the helper contracts instead of improvising it: list each helper's preconditions
from its definition and from the step order of existing scenarios that use it, and
enforce them in the stub (a call that skips a precondition creates nothing, or fails).
Reuse helpers in the same order existing scenarios call them, not just by name. A stub
whose preconditions could not be derived is low confidence: say so, and run against the
real system before trusting a Green. In one trial, a stub that did not require an
earlier webhook let a generated test pass against the scaffold that failed against the
real system.

**Blind runs against an existing feature** use the same scaffold, temporarily placed on
the real route, and must then run against the implementation; classify its Reds as in
[Handling Red](#handling-red).

### The scaffold is a candidate implementation

Write the scaffold to the bar of product code, so the implementing team can take it as
the start of their change instead of rewriting it. A scaffold written only to make tests
pass is read once and thrown away; one written to the codebase's own standard can be
reviewed and merged. The bar:

- **Read the project's rules before writing**, and check against them after (below)
- **The project's rules for product code apply in full**: its coding standards, its
  structure (logic in pure, unit-tested functions rather than inside components), its
  existing components and helpers reused rather than copied, and the same lint, type and
  unit-test checks a product change must pass. Run the project's own self-review for the
  platform (the review a human change gets before review) on the scaffold, and fix what
  it finds in the scaffold's lines
- **Nothing that cannot be merged as is**: no hand edits to generated files, no change
  to a shared contract made only to get the scaffold running. A temporary schema or a
  stub stays outside the scaffold's diff and is listed as what the real backend must
  provide
- **Delivered with a merge-readiness report, written by someone other than the generator**:
  a reviewer that is not given the generator's own conclusions (given them, it tends to
  agree). The report has the tests before and after the scaffold, the checks that passed,
  the self-review result, and what still blocks merging, sorted by who must act: backend work (a missing
  field, a query that would run once per row), design decisions the spec does not make
  (where a new column goes, how a preview is labeled), and spec questions the scaffold
  raised. Each decision the scaffold had to make that the IR does not state is listed;
  those are questions, not answers
- **Separate from the test change**: a patch or a branch of its own, never committed
  with the tests, so the tests can merge before the implementation is decided

#### What a project provides

Good generated code depends far more on what the project has written down and can check by
machine than on the generator. The contents differ from project to project and are the
project's own; esdd only needs them to exist. A project that wants merge-ready scaffolds
provides, per platform:

- **Coding guidelines** the generator reads first: structure (where logic, components and
  tests go), naming, error handling, state and data fetching, testing, and the guides for
  the kinds of code it builds (forms, lists, styling, navigation). Include the component
  library's usage notes, each app's own notes, and the domain's spec guides
- **Machine checks**, which matter most: a formatter, a linter (house conventions encoded as
  custom rules where possible, since a rule is enforced on every change and a guideline only
  when someone reads it), a type checker or compiler, and unit tests. A scaffold that passes
  them is reviewable; one that has nothing to pass cannot show its quality
- **A self-review procedure**: the review a human change gets before review, runnable on the
  scaffold
- **A pattern registry with real exemplars**: for each recurring building block, when to
  pick it and an existing file that shows it, so the scaffold copies the codebase rather than
  the generator's habits. A registry entry for a platform comes from a census of that
  platform's code, and a building block that does not exist there is recorded as absent
- **The check commands**, next to the patterns, so the generator and the reviewer run the
  same checks
- **Backend guides** (data loading, authorization, schema changes), so the report can name
  backend work precisely, such as which loading pattern removes a per-row query

Where one of these is missing, the scaffold's quality cannot be assured for that platform;
say so in the report rather than presenting the scaffold as merge-ready.

**Against an existing implementation**, build the scaffold for the gaps when the tests are
Red because the approved spec differs from the product (spec drift). It is the only way to
show that the Red tests can turn Green: a test that cannot pass against any
implementation (it never sets up the data the screen loads), or that passes for the wrong
reason, shows up here and not in the Red run. In one trial, a scaffold for three gaps
turned six of seven Red tests Green, exposed one test that no implementation could pass and
one that passed only because an upload failed, and surfaced a spec answer that contradicted
an earlier product decision to remove the feature.

### Givens against a fake server

When the fake server synthesizes responses for operations nothing registered, a
scenario's default given is "register nothing":

- **Success paths** need no registration
- **Rejections by the server** register an error response that fills every field the
  operation selects; its message is the contract literal from the IR. When the screen
  shows a heading and the message together, match the message as contained text, not as
  the whole text
- **Lists whose content is asserted** (empty state, counts, row content) register a
  fixture, because synthesized values are arbitrary
- **Required selections whose value does not matter** pick the first option through the
  driver, so a required field never leaves the submit silently invalid

Verify sends by matching the recorded request, and non-sends by a call count of zero
(a negative oracle). Business decisions stay in backend tests; integration verifies
only how their responses are displayed.

## Acceptance-first

For a new feature, integration tests can be made to "work" with zero implementation.
In a blind trial, every Red from IR-only tests run against an existing implementation
was a naming decision nobody had made (locators, button and option copy, the layout of a
filter). What was missing was not better guessing but one place to make those decisions
before the implementation:

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
and tests. Its code differed from a hand-written version in 20–35% of lines, all of it
cosmetic or unprescribed, and the tests found no behavioral difference: the contract
fixes behavior, not bytes.

Do not run acceptance-first for a feature that already exists. Use blind-generated tests
there as a conformance probe — a list of the places where the implementation decided
something the spec does not — and generate the real tests by lowering against the
implementation's vocabulary.

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
- Keep one small adapter per usecase, and write widget interaction idioms once in a
  shared driver base that every adapter uses (in one blind trial, three of four Reds
  could be absorbed in the adapter alone)
- For an existing feature, the adapter may be written after the implementation, or
  generated by reading it. This is not circular: the contract lives in the bindings, not
  in the adapter

## Graph walk — every reachable cell, not only the written paths

Scenarios check the paths someone wrote down. A states-mode IR says more than its paths:
every cell is a transition, `ignored` or `impossible`, so for each state it fixes which
events the implementation must accept and which it must refuse. The graph walk
(`src/walk.ts`) checks that against a running implementation, in every state it reaches:

| In a stable state, for each event the screen fires | IR cell | Violation |
| --- | --- | --- |
| the control is not offered (hidden or disabled) | transition | **liveness**: it refuses what it must accept |
| the control is offered (a control that answers with an error counts as offered) | `impossible`, or no cell in a terminal state | **safety**: it allows what it must not |
| either | `ignored` | — (fired, and the state must not change) |
| after the event, the screen does not show the state the IR leads to | transition | **safety** |

It then fires a cell it has not covered yet (seeded, so a walk replays), or heads for
one, and resets to the initial state at a terminal state or when nothing is left to
cover from where it is. Each violation is reported once, with the events fired since
the last reset as its reproduction. This is graph-based testing with the IR as the
model: its transitions are the traces the implementation may produce, and its impossible
cells are what the implementation must refuse in a stable state.

The walk drives a **target** (`WalkTarget`) that the project writes once per usecase.
There are two kinds, because a screen and an API answer the question "would you accept
this event?" differently:

| Target | How an event is probed | Built on |
| --- | --- | --- |
| **Screen** (`ScreenTarget`) | asked without changing anything: is the control offered? Every probed event is checked in every state | the [semantic driver](#semantic-driver-vocabulary-isolation), with two probes that answer instead of asserting: whether an event's control is offered, and whether the screen shows a state |
| **API** (`ApiTarget`) | only by sending the request. An impossible event is attempted: it must be refused and leave the state as it was. A transition is checked when it is fired: it must be accepted and lead where the IR says | the bindings `events` (the operation per event, and its `refused` codes) and a read of the state |

- **Events the target cannot refuse are not probed.** `actor: system` events and events
  from another device are fired only where the IR has a transition or an ignored cell;
  the target injects them (a fixture, a fake, an API call)
- **A refusal is a rejection the bindings name; anything else is inconclusive.** An API
  target reads a rejection carrying one of the operation's `refused` codes
  ([bindings.md](bindings.md)) as a refusal. A server error, a timeout or an unknown
  code is reported as inconclusive and ends the run, never counted as a refusal, so an
  outage cannot pass an impossible cell. A cell found inconclusive or in violation is
  not attempted again, so one defect does not stop the rest of the walk
- **A probe with no answer is inconclusive, on every target.** Any target method may
  answer `{ failed }`, and one that throws (a locator timeout, a dropped connection) is
  read the same way. A screen probe that times out is not "not offered", and a screen
  that never settled is not "in another state": either would turn a flaky environment
  into a liveness or safety violation. `shows` answers `false` only when the screen
  settled in another state. The run ends, the cell is not probed again, and the report
  lists it with its reproduction. A walk that could not start a run at all stops with
  "could not start a run"
- **Runs may start from a state built directly.** A target with `resetTo` (test data on
  a real database, say) lets later runs start next to a cell not covered yet, instead of
  walking there from the initial state. The first run still starts from the initial
  state, and every run keeps walking from where it lands: a state built directly has no
  history, and bugs that depend on how a state was reached only show on walked paths. A
  reproduction says where it started ("from PACKED, built directly: …")
- **A state with nothing observable is reported, not passed.** When no literal tells a
  state apart, the probe answers "unknown" and the report lists the state as not
  checked. It is the same question as an outcome the bindings name nothing for
- **Probe only stable screens.** A pending timer or a request in flight makes the
  answer depend on timing. The target's methods return once the screen has settled,
  and a state with a timer still running is not stable until the timer fires
- **Races are not walked.** The walk fires one event at a time; races keep their two
  nodes ([trace.md](trace.md#a-race-is-two-nodes--the-winner-at-backend-the-losers-view-at-integration))

The same walk runs on several layers, with different targets:

| Layer | Target | What a violation means |
| --- | --- | --- |
| **Integration** | a screen, on a fake that answers each event with the state the IR leads to | the screen offers or shows something the IR does not allow. Cheap and deterministic, so it can run on every change |
| **Backend** | the API, on the real backend and a real database | the server accepts or refuses something the IR does not. Unlike a fake, the backend remembers: a leftover entity, an earlier refusal, a stale attempt are all still there, so walked sequences reach states that no scenario sets up. No screens and no devices, so it is cheap enough to run often |
| **E2E** | screens, on the real system | the system as a whole allows or refuses something the IR does not, including whether several screens agree on the state. Opt-in. Bound it with a step budget (`maxSteps`) and a time budget (`maxDuration`): every fired event is one more chance of a nondeterministic failure, and a step can take minutes, so an unbounded walk on a shared environment fails, or outlives its lane, for reasons unrelated to the product. The report says why the walk ended (`stopped`), so a walk cut short by its budget reads as partial coverage, not as a failure |

A common balance is the walk at Integration and Backend, and the `critical: true`
scenarios at E2E: the walk covers every reachable cell where it is cheap, and E2E keeps
the few paths that check the screens against the real system.

Against product code generated from the same IR, the walk agrees by construction, like
the integration tests ([Handling Red](#handling-red)); its negative control (a mutated
screen that offers an impossible event) is what shows it can fail. Its value is against
an implementation the IR did not produce: an existing feature, a hand-written screen,
and the real system at E2E.

The order example walks both kinds of target, each with negative controls:

- [order-cancel.walk.ts](../examples/order-cancel.generated/order-cancel.walk.ts): the
  screen on the integration layer, against a screen that still offers cancel after
  hand-over (`npm run example:walk`)
- [order-cancel.api-walk.test.ts](../examples/order-cancel.generated/order-cancel.api-walk.test.ts):
  the API of a hand-written stand-in for the backend
  ([order-service.ts](../examples/order-cancel.generated/order-service.ts)), from the
  initial state and from states built directly, against a service that accepts cancel
  after hand-over, one that refuses hand-over, and one whose operation is down (`npm test`)

## Pattern registry (select → instantiate)

Components are not free-generated. Two stages: **select(pattern) →
instantiate(bindings vocabulary)**:

1. Choose a pattern from the **shape** of the IR's scenario / event / outcome (the
   registry's `selects_on` is the only basis for selection)
2. Read the pattern's **exemplar (a real file)** and follow its structure, error
   handling, and placement. When the spec names an existing screen to match, that
   screen overrides the registry's exemplar
3. Materialize the vocabulary from the bindings / IR literals (the no-invention rule)
4. When you meet a shape with no matching pattern, **extend the registry first**,
   then generate

The registry is a project-specific asset; [examples/pattern-registry.yaml](../examples/pattern-registry.yaml)
shows the shape for the order-cancel example, where the example generator's renderers stand in
for the exemplars. How to build one: census the existing codebase and record the recurring archetypes as
"selection criteria + exemplar + structural notes". Where competing implementation
styles exist, write the winner down as a **ruling**, and explicitly mark patterns
with no real exemplar as "not registered" (to distinguish them from the unexamined).

The provenance audit that grounds this: every decision in a hand-written
implementation (~1,000 lines) could be classified into **A) contract-derived /
B) house-pattern-derived / C) free discretion (cosmetic)** — with zero left
unclassified. So the inputs needed for generation close over the contract (A) and
the registry (B), and C can follow the exemplar.

Generating components and tests from one contract also improves the tests. The Red class
caused by undecided names disappears, because the component is built with the bindings'
names. Each widget's driver idiom is known at generation time, because the pattern chose
the widget. And patterns answer the UI decisions specs omit (empty states, where an add
action sits, where errors show), so the question list holds only real spec questions.

## Generation decision records

Record generation-level decisions as a **decision record**, written before the code:

```yaml
record: FE-GEN-<usecase-id>
source: { usecase: <path>@<version>, bindings: …, registry: … }
selections:            # which pattern was chosen for which shape (references only)
  - { target: "the save form of SC-001", pattern: mutation_form, exemplar: …, output: … }
file_plan: { new: […], modified: […] } # modified: relative to the current head
unprescribed:          # every decision no input prescribed (write [] explicitly if empty)
  - { decision: "placement of the warning", disposition: registry-addition } # or question-list / accepted
literal_sweep: { unmatched_rules: [] }
```

- Carries no re-description of behavior and no code fragments (decisions and
  references only), and never introduces vocabulary missing from the bindings — add it
  there first
- A selection references only IR nodes and registry pattern names; any other name is a
  gap to fix before generating
- Rules listed in `literal_sweep.unmatched_rules` get no generated display until the
  bindings supply a literal (no invention)
- `unprescribed` dispositions: `registry-addition` (the machine answers next time) /
  `question-list` (a hole in the spec) / `accepted` (usable only for cosmetic free
  discretion)
- Purpose: turn "decisions nobody made" into a **reviewable artifact before
  generation**, not a self-report after it (in one replication run, nine such decisions
  surfaced only in the implementer's own report)

## Bug tickets — mechanism scenarios

When the input is a bug report instead of a spec, read the report, its discussion, the
fix's description and the incident timeline as the spec — they describe **how the
failure happens**. Write that mechanism ("while the region is not yet decided, a
notification arrives") as **its own scenario**, separate from the scenarios for the
general rule. Tests of the general rule alone can be Green on the unfixed code and
never catch the bug again. Then route the mechanism scenario to the layer that can
reach its state: an E2E test that waits for a terminal state cannot observe a window
that closes in milliseconds, so such mechanisms usually belong in a backend test that
builds the state directly, and the E2E scenario records why the state is unreachable
there. If nothing describes the mechanism, put that on the question list.

Confirm each generated test **fails on the code before the fix** — a Green alone is no
evidence that it detects the bug:

1. **Check that the mechanism still exists.** If a later change removed it (the window
   no longer opens), no test can catch the bug in the current code — report that and
   stop. Do the same when no layer can build the mechanism at all (a misconfigured
   external service, outside the app's own paths), and propose a configuration checklist
   or monitoring of the symptom instead of a test
2. **Use evidence from the shared environment first.** Run the generated test there once
   and read the target record's state and timestamps from the environment's data and
   logs. Search logs by structured attributes, and check the query against a known value
   first so that an empty result means absence rather than a bad query. If they settle
   whether the run was inside the mechanism's state, the old code's behavior follows from that
3. Only otherwise, replay the old decision in a backend test with the fix temporarily
   removed, then restore it. Ask before changing a local database or container setup for
   the replay, and restore that too
4. A test that does not fail on the old code is a guard for the general rule; never
   report it as a detector of the bug. State for each test, in the report, whether it
   fails on the pre-fix code

## No false greens

A generated test can pass because nothing changed, not because the right thing
happened. Guard against it while writing and after running:

- **Assert the state before the action too.** A test that asserts an outcome first
  asserts that the outcome does **not** hold yet ("before the assignment arrives, the
  order is not confirmed" → "after, it is"). Otherwise a test passes on an
  implementation that was already in the end state. Outcomes that cannot have a "before"
  (something is not shown) need two contrasts instead: the same path does display other
  data created at the same time (the path worked), and the hidden data itself exists
  (someone allowed to see it sees it, or the API returns it). Without the second, the
  oracle also passes when the data was never created — say so in the scenario and do not
  promote the test
- **Put fake values where the implementation reads them.** Before injecting an error
  message or a displayed value into a fake, check which field the implementation
  actually displays. A value in the wrong field fails a correct implementation, or
  passes a wrong one
- **Count a Green only after a negative control.** Break the expectation or change the
  fake's response, and confirm the test fails once. Report Greens without one as
  "Green (no negative control yet)"
- **Inverting an assertion is not always a control.** An absence check ("the notice is
  hidden") passes at once, before an action's response has rendered, so turning a presence
  check into an absence check can stay Green against a working implementation. Withhold the
  fixture instead (for a race, the fake's rejection of the loser), and generate absence
  outcomes after a presence assertion that waits for the response
- **A Green against a stand-in is not a Green against the real system.** A test that
  passed against a scaffold or a simulated backend has verified the test, not
  the product; report which target each layer ran against

## Visual evidence

Generated tests leave screenshots a reviewer can check against the spec — did the test
really see the screen the spec describes? Evidence is informational and never replaces
an assertion: gated assertions come from the outcomes, and images are review material.
An outcome left uncaptured records why, so a deliberate omission can be told apart from
a missing one.

- **Capture points come from the IR, not from the generator.** Capture once per scenario
  outcome (`then`), named `<usecase>/<scenario>/then-<n>-<slug>.png` (slug: a short
  kebab-case summary of the outcome), so every image traces back to a node
- **Screenshots mainly at integration, video only at E2E.** Integration runs every
  scenario on deterministic fake data, so its images form a complete, reproducible set
  of outcomes that can be diffed between runs. Video belongs to E2E, where real
  transitions and timing matter; E2E keeps outcome stills as well. Integration records no
  video — a deterministic run of seconds per scenario makes it noise
- **One shared capture helper per platform.** Generated tests call it at each outcome
  point; the generator does not generate its own. When the helper exists in more than one
  copy, change them together
- **Tests without a screen capture nothing on their own.** Tests that drive a state
  machine headlessly produce no images unless they render the production UI components
  at each outcome point

### Capture idiom

Wait for finite animations to finish before capturing, and capture with animations
allowed: disabling animations at capture time can rewind an in-flight transition to its
start, so a dialog that is fading in shows up invisible or as a ghost. Skip infinite
animations (spinners), whose completion never resolves. When a dialog is open, also save
a crop of the topmost one — a full-screen capture is often too small to read, and when
dialogs stack, the first match is the one underneath.

### Evidence page

Each local generation run publishes one evidence page: scenario → outcome → image, with
run metadata. Runs in CI keep their evidence in the CI's own artifacts.

- **No page without an image per scenario.** The page is not built unless every scenario
  has at least one image at some layer, or a declared reason for none. In one trial, a
  run of headless tests published a page with zero images because this was not enforced
- **Look before publishing.** Look at every image: it shows the implementation rather
  than a placeholder screen, and a dialog crop shows the intended dialog, not one
  underneath it. The summary states which target each layer ran against (scaffold,
  implementation, shared environment)

### Promotion and evidence

Only critical-path tests are promoted into the regression suite. Other generated tests
are not committed: the code can be regenerated from the IR, and for those scenarios the
evidence page is the lasting record that the behavior was verified at generation time.

## Handling Red

- **A generated test going Red against an existing implementation = detection of
  drift between spec and implementation.** A human adjudicates which side is right.
  Quietly fixing the test to Green destroys the detector
- **An E2E test generated before the implementation exists is expected to be Red.** It
  is a detector waiting for the implementation, shown as a `trace-failing` warn, not a
  defect
- **A Red in a deliberate blind run** (generated without reading an existing
  implementation) is classified before anyone acts on it: missed lowering, spec drift, or
  environment — decided with **one-variable A/B probes** (run an existing similar test as
  the control and revert the differences one at a time). Fix a missed lowering and record
  why in the scenario; send spec drift to a human like any other drift
- Unit tests immediately after generation are expected Green (the function and the
  test come from the same case table). Red there means a generator bug
- Under co-generation (implementation and tests generated from the same contract)
  the two agree constructively, so the safety net moves to contract review
  (bindings + generation decision records). co-generation without contract review is
  self-consistently wrong
