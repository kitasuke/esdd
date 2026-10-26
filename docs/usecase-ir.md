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
races:
  - state: PLACED
    between: [pack, cancel]         # a pair of events with different actors
    winner: cancel
    outcome: ["the operation that commits first wins"]
```

Checker checks: exhaustiveness (every cell declared) / determinism (no duplicates) /
reachability / escapability / race declaration obligation / path validity / transition
coverage. `--suggest-paths` proposes scenario paths that exercise uncovered transitions.

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

On the scenario / rule case side, declare the exercised cell as
`covers: "email×empty"`. The cell syntax is `<inputId>×<condition>` — the separator
is the character `×` (U+00D7), which is part of the format (and is therefore
forbidden inside input ids).

Note that ids throughout the IR (inputs, elements, event vocabulary) are
spec-vocabulary ids (in the spec's language) — the format allows non-ASCII ids, so a
team writing specs in another language can keep its own vocabulary.

## scenarios / rules

```yaml
scenarios:
  - id: SC-001
    name: an order progresses to delivered
    critical: true              # marks the most important paths to turn into E2E tests
    path: [pack, hand_over, complete]  # states mode: an event sequence from initial
    given: ["one paid order exists"]
    when: ["…"]
    then: ["…"]                 # observable results only. Write them as literals
rules:
  - id: RULE-001
    name: cancellation fee
    cases:
      - { input: "cancellation before packing", expected: "cancellation fee is $0" }
```

- **Write expected / then / outcome as literals** — "shows an appropriate error" is
  forbidden. If the wording is not in the spec, leave a `TBD` and put it on the
  question list
- The checker tracks `TBD` / `TODO` / `FIXME` / `UNRESOLVED` as pending warns.
  Zero warns = every question answered, which is the approval condition

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
