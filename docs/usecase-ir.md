# UseCase IR — format

The UseCase IR is the **single source of behavior**, converted from a spec (a PRD or
similar). Everything downstream (test generation, implementation generation, test
planning) reads this IR. Downstream artifacts are forbidden from inventing behavior
that is not in the IR — decisions the spec does not make go on the question list, and
generation happens only after the answers are folded back into the IR.

The checker in `src/` is the source of truth for the checks (this document is the explanation).

## Two authoring modes

| Mode | When to use | Exhaustiveness engine |
| --- | --- | --- |
| **states mode** | the subject is a state machine (orders, applications, sessions — things that transition) | every states × events cell |
| **form mode** (no states) | the subject is inputs and saving (settings screens, registration forms) | every inputs × conditions cell |

## Common header

```yaml
usecase: UC-ORDER-CANCEL-001   # an ID starting with UC-
name: Order cancellation
source:
  spec: "https://…"            # link to the spec (required)
  version: "v1"                # spec version (optional — used for drift tracking)
```

`usecase`, `name`, `source.spec` and at least one scenario are always required.
`states`, `events` and `transitions` are declared together or not at all, and
`initial` is required whenever `states` is present.

## states mode

```yaml
initial: PLACED
states:
  - { id: PLACED, label: Order placed }
  - { id: COMPLETED, label: Delivered, terminal: true }
events:
  - { id: cancel, label: cancel the order, actor: customer } # actor is an open vocabulary
transitions:
  - from: PLACED
    on: cancel
    to: CANCELED
    outcome: ['"Canceled" is shown']    # the observable result (write it as a literal)
  - from: PLACED
    on: [hand_over, complete]       # from/on accept arrays for bulk declarations
    impossible: true
    reason: "unpacked orders never reach hand-over"   # impossible requires a reason
  - from: PLACED
    on: resend_notice
    ignored: true                   # the event arrives but changes nothing
    reason: "a repeated notice for the same order is ignored"   # ignored requires a reason too
races:
  - state: PLACED
    between: [pack, cancel]         # a pair of events with different actors
    winner: first                   # or one of the between events, when the kind of event decides it
    outcome: ["the operation that commits first wins"]
```

`impossible` says the event never arrives; `ignored` says it arrives and changes neither the state nor
the display (a duplicate notice, a timer that no longer applies). Declaring an event that does arrive as
impossible drops the ignoring behavior from the IR, so nothing tests it. An ignored cell is not a
transition, so it creates no race or coverage obligation, but the trace gives it a node that a test must
cover ("it arrived, and nothing changed").

`winner: first` declares that arrival order decides the race. Fixing the winner to one of the events
would state the wrong behavior for the order in which the other one arrives first; write an outcome that
holds either way.

An event's `actor` is who acts, not who reports the result. When an action can fail (the request is
rejected, the network drops), its failure is another event of the same actor — `redispatch` and
`redispatch_fails`, both by the operator — usually a transition back to the state it starts from.
Giving the failure to `system` makes the checker ask how the action races its own failure, which cannot
happen. Keep `system` for what happens with nobody acting: a timer running out, an expiry.

A state the usecase leaves and comes back to (the app in the background, another screen on top)
needs one `to` for the return event. When where the user lands depends on the state they left
from — playing resumes, an error stays an error — do not duplicate the state per origin
(`BACKGROUND_FROM_PLAYING`, …): the matrix doubles and the questions get worse, not better.
Fix the return to the state the spec talks about most, declare leaving from the other states
`impossible` with the reason that this usecase covers leaving from that state only, or declare
one assumption ("returns to the state it left from") and ask it. Either way the decision is
visible in the IR, which a duplicated state machine hides.

`races` pairs events of different actors. The same event arriving twice (a double press, two people doing
the same thing at once) is not a race between two events; write it as a rule with one case per way it can
arrive ([scenarios / rules](#scenarios--rules)), with what the user sees as `expected`.

State ids are UPPER_SNAKE_CASE and event ids lower_snake_case, both ASCII; scenario ids
start with `SC-` and rule ids with `RULE-`. An event's `actor` is required, and `to` and
`outcome` are required on every transition that is not `impossible` or `ignored`. A
terminal state may not be the `from` of any transition, and the IR must declare at least
one terminal state.

Checker checks: exhaustiveness (every cell declared) / determinism (no duplicates) /
terminals (no transition leaves a terminal state) / reachability / escapability / race
declaration obligation / path validity / transition coverage. `--suggest-paths` proposes
scenario paths that exercise uncovered transitions.

### Outcome items — plain or structured

An outcome item is either a plain string or a structured object:

```yaml
outcome:
  - '"Canceled" is shown'                       # plain string
  - surface: WEB                                # structured: which surface observes it
    ui: 'the order status changes to "Canceled"'
  - observation: orderStateObservation          # a named observation (checked against
    keys: { state: CANCELED }                   #  the registry when --definitions is given)
```

`surface` is free-form (WEB / MOBILE / API / …) — use it when one behavior is
observed differently per surface. Either form is fine; structured items become
useful once downstream generators route assertions by surface or observation name.

### Two authoring principles

1. **Tests know nothing about the implementation.** Transition outcomes are written
   only in terms of what a user can observe — displayed text and states. Never
   internal function names, endpoints, or storage details.
2. **Semantic checking happens exactly once, on the UseCase IR.** Downstream
   artifacts (target IRs, generated tests, generated code) never restate behavior;
   they hold only references to which upstream behavior they target
   (see [pipeline.md](pipeline.md)).

## inputs (input axis matrix — usable in both modes)

The mechanism that gives a universe of exhaustiveness to subjects without states
(forms). For every declared input × condition cell, an explicit stance is mandatory:
either `covers` (some scenario / rule case exercises it) or `na` (the reason it cannot
occur).

```yaml
inputs:
  - id: email
    kind: field        # default conditions for field: empty / boundary
  - id: newsletter_opt_in
    kind: option       # default conditions for option: default / set
  - id: postal_code
    kind: field
    conditions: [empty, malformed, boundary]   # the condition set can be overridden
    na: { boundary: "fixed 7 digits, so no boundary exists" }
```

The default conditions cover only edge cases: the valid-value happy path is owned by
the scenarios. `required: true` on an input is optional metadata; the checker does not
use it.

On the scenario / rule case side, declare the exercised cell as
`covers: "email×empty"`. The cell syntax is `<inputId>×<condition>` — the separator
is the character `×` (U+00D7), which is part of the format (and is therefore
forbidden inside input ids). Every `covers` reference is checked against the declared
inputs and their conditions; an unknown input or condition is an error. When a cell's
answer is still open, cover it with a rule case whose `expected` carries `TBD`, so the
question stays visible as a pending warn.

Limit: the checker cannot detect an input that was never declared, just as it cannot
detect a missing event. Finding the universe is the job of the spec and its reviewers;
the format only enforces closure over what is declared.

Which ids must be ASCII: state ids, event ids and the `UC-` / `SC-` / `RULE-` ids
follow the fixed formats above. Input ids, input conditions, and the element and
literal keys in [bindings](bindings.md) are spec-vocabulary ids (in the spec's language)
— the format allows non-ASCII there, so a team writing specs in another language can
keep its own vocabulary. Bindings event keys name IR events: in states mode they are the
ASCII event ids; in form mode, which has no IR events, they are spec vocabulary too.

## scenarios / rules

```yaml
scenarios:
  # states mode: the path; expected results come from the transitions it walks
  - id: SC-001
    name: an order progresses to delivered
    critical: true              # marks the most important paths to turn into E2E tests
    path: [pack, hand_over, complete]  # an event sequence from initial
    given: ["one paid order exists"]   # optional: the starting data
  # form mode: given / when / then
  - id: SC-002
    name: saving a valid email address
    given: ["the settings screen is open"]
    when: ['enter "a@example.com" as the email address', "save"]
    then: ['"Your email address has been updated" is shown']  # observable results only, as literals
rules:
  - id: RULE-001
    name: cancellation fee
    cases:
      - { input: "cancellation before packing", expected: "cancellation fee is $0" }
```

- **States mode: a scenario is a path.** `path` is required, and its expected results
  are the outcomes of the transitions it walks, so the scenario does not restate them.
  `given` is allowed and describes the starting data (step definitions resolve it, and
  warn when it describes a state other than the initial one). `when` / `then` belong to
  form mode: in states mode the checker neither traces nor asserts them
- **Form mode: `given`, `when` and `then` are all required** on every scenario. Write
  each field's required / optional / boundary behavior as rule cases (one case per field
  condition), constraints as error scenarios plus boundary cases, and settings options
  as rules. Restate internal behavior such as asynchrony or idempotency as something
  observable in a rule, and put postconditions in each scenario's `then`
- **Write expected / then / outcome as literals** — "shows an appropriate error" is
  forbidden. If expected stays abstract, the generated test and the implementation
  cannot share the same text, and the wording is decided implicitly during
  implementation (a blind generation trial showed exactly this). If the wording is not in
  the spec, leave a `TBD` and put it on the question list
- The checker tracks `TBD` / `TODO` / `FIXME` / `UNRESOLVED` as pending warns — in
  transition and race outcomes, transition reasons, rule case `expected` and scenario
  `then`. Zero warns = every question answered, which is the approval condition

## Assumptions and the question list

When the spec is silent on a decision, do not fill it in silently. Each open decision is
either **asked** or **assumed** (which one is decided by rule —
[pipeline.md](pipeline.md#accept-by-default)):

1. **Asked** (must-ask): carve a `TBD` (pending warn). It stays open until the owner
   answers, and blocks approval
2. **Assumed**: apply the proposed answer and declare it, so the IR is complete and
   checkable while the owner reviews the list

```yaml
assumptions:
  - id: W4 # the question id from the review
    question: What does the customer see when a late request is rejected?
    proposal: '"This request can no longer be accepted" is shown'
    basis: the existing rejection message for expired requests

transitions:
  - from: OFFERED
    on: accept_late
    to: OFFERED
    outcome: ['"This request can no longer be accepted" is shown ASSUMED(W4)']
```

- Every text that came from an assumption carries `ASSUMED(<id>)` — outcome, reason,
  rules expected, scenario given/when/then, input na reasons. It is how a reviewer finds
  everything an assumption touched, and what gets replaced when the owner disagrees
- `question`, `proposal` and `basis` are required. An assumption without a basis is a
  guess; ask it instead
- The checker (`assumptions`) rejects a marker that points at an undeclared assumption and
  warns about a declared assumption nothing uses
- When the owner answers differently, write their answer, remove the marker and the
  declaration. When they accept, nothing changes — the approval lists the accepted ids
  ([approval.md](approval.md))

Keep the invariant that **the checker's warns are the question list itself**: pending
warns are the questions still open, the `assumptions` list is the answers still awaiting
review.

## Check command

```bash
npm run check -- <ir.yaml> [--suggest-paths] [--bindings <bindings.yaml>] [--json] [--strict]
```

- Exit codes: 0 = no errors / 1 = errors (with `--strict`, warns too) / 2 = invalid input
- `--definitions <registry.yaml>`: cross-checks the `observation:` names in outcomes
  against a vocabulary registry (a YAML of the form `observations.<name>.keys.<key>`)
  (optional)
- `--questions [--profile <profile.yaml>]`: prints the IRs' open questions instead of the
  findings — markers as the text to complete, undeclared cells and races as questions in the
  profile's phrases (races that share one event against the same actor as one question), the
  other findings in the checker's words, then the assumed answers as a table. The same list the
  rendered PRD puts under its open questions ([prd.md](prd.md#the-rendered-prd)), for a review of
  a spec that has no PRD frame; a profile localizes the wording
