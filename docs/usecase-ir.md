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

## ASSUMPTION and the question list

When the spec is silent on a decision, do not fill it in on your own — two options:

1. If you must proceed with a provisional value, carve `ASSUMPTION(Q1: …)` into
   reason / expected
2. If you cannot proceed, carve a `TBD` (pending warn)

Either becomes a line on the question list for the spec owner, and disappears once
the answer is folded back into the IR. Keep the invariant that **the checker's warns
are the question list itself**.

## Check command

```bash
npm run check -- <ir.yaml> [--suggest-paths] [--bindings <bindings.yaml>] [--json] [--strict]
```

- Exit codes: 0 = no errors / 1 = errors (with `--strict`, warns too) / 2 = invalid input
- `--definitions <registry.yaml>`: cross-checks the `observation:` names in outcomes
  against a vocabulary registry (a YAML of the form `observations.<name>.keys.<key>`)
  (optional)
