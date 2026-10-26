# Behavior trace — is every behavior in the IR confirmed by a test that ran?

A checked UseCase IR holds the spec's behavior in a form a machine can enumerate
(states×events exhaustiveness, races, a stance for every input cell). The behavior trace
reuses that universe as is and cross-checks that **every node is confirmed by a test that
actually ran**, at one of four layers:

| Layer | What it is |
| --- | --- |
| `unit` | pure functions (the `rules` case tables) |
| `backend` | the real server started against a real database, driven through its API |
| `integration` | the frontend pointed at a fake server (see [generation.md](generation.md)) |
| `e2e` | the real environment |

The checker runs the trace when `--results` is passed:

```bash
npm run check -- <ir.yaml> \
  --results unit=<junit.xml | dir | go-test.json> \
  --results backend=<junit.xml | go-test.json> \
  --results integration=<junit.xml | dir> \
  --results e2e=<junit.xml | dir> \
  [--scenarios <dir of scenario files>] \
  [--trace <trace.yaml>]

# the bundled example
npm run check -- examples/order-cancel.usecase.yaml --results e2e=examples/order-cancel.e2e-results.xml
```

The IR's own `coverage` check only asks whether some scenario walks each transition (and
only as a warn). A behavior that was written as a scenario but never turned into a test —
or turned into a test that never ran — passes every IR check. The trace closes that hole
with execution results as the evidence.

## Nodes — the universe is derived from the IR

| Kind | Node ID | Taggable | Derived from (when there is no direct test) |
| --- | --- | --- | --- |
| `scenario` | `SC-001` | yes | — |
| `rule_case` | `RULE-001-c1` (cases are 1-based) | yes | — |
| `transition` | `T-<FROM>-<event>` | yes | the scenarios whose `path` walks it |
| `race` | `RACE-<STATE>-<a>-<b>` (in `between` order) | yes | — |
| `race_outcome` | `RACE-<STATE>-<a>-<b>-outcome` | yes | — |
| `outcome` | a transition's outcome item `T-<FROM>-<event>-o1` / a form-mode scenario's `then` item `SC-001-t1` (1-based) | yes (marker) | — |
| `input_cell` | `<inputId>×<condition>` (na cells excluded) | no ("×" does not fit in test names) | the nodes that `covers` it |

Derivation is used only when a node has no direct test. If every source is Red the node is
Red; with no test at all it is uncovered. Declaring a scenario `untested` leaves the
transitions only it walks without a derivation source, so they stay uncovered (each needs
its own stance).

### A race is two nodes — the winner at backend, the loser's view at integration

One `races` entry makes two claims: **who wins** (the backend's mutual exclusion — a row
lock plus a state guard) and **what the losing side sees** (the frontend showing the
error). They are confirmed at different layers, so they are separate nodes, and neither
goes to E2E — E2E cannot create the timing of two operations deterministically.

| Node | Where it goes | Layers that count |
| --- | --- | --- |
| `race` | a **sequential** backend test: a fixture builds the state after the winner won, then the loser's operation runs → assert its error and that the state is unchanged. Add a **concurrent** variant if the exclusion is a row lock | `unit` / `backend` |
| `race_outcome` | integration: the fake server returns the loser's error (the same one the backend test asserts) and the losing screen shows the IR's outcome | `unit` / `backend` / `integration` |

A race confirmed only at other layers, or declared `untested`, is a `trace-race` warn.
Existing backend tests often already cover "winner's state × loser's operation" — point at
them with `owned_by` instead of writing new ones, and pass their results.

### Outcomes — walking a path is not asserting its outcomes

When a scenario's test is Green, the transitions on its path become Green by derivation.
That does not mean each outcome item of those transitions was asserted (one surface may
have been checked and another not). So every outcome item is its own node, confirmed by a
**marker the test prints right after the assert passes**:

```
[ESDD-OUTCOME] UC-ORDER-CANCEL-001__T-PLACED-cancel-o2
```

- Print it **after** the assert: if the assert fails the line is never reached, so the
  marker's presence is the evidence (the test's later fate does not matter)
- The checker picks markers up from the body of every `--results` file: JUnit XML
  `system-out`, `go test -json` `Output`, and `.log` / `.txt` files (e.g. a device log
  filtered to marker lines — these carry no test cases)
- Markers may only name outcome nodes (other nodes are named by test-name tags).
  Outcomes need no negative control — it is asked of the test that contains them
- If an existing test asserts an outcome but cannot print markers, point at it with `owned_by`

## Tags — put `<usecase>__<node>` in the test name

**Every** generated test carries `<usecase>__<node>` in its name (title / method name /
subtest name), with a double underscore. A test that confirms several nodes may carry
several tags.

| Tool | Example |
| --- | --- |
| Playwright | `test("UC-ORDER-CANCEL-001__SC-002 cancellation before packing …", …)` |
| vitest (rules) | `it.each(cases)("UC-ORDER-CANCEL-001__RULE-001-c$caseNo $input", …)` |
| JUnit (JVM) | ``fun `UC-ORDER-CANCEL-001__SC-002_cancel_before_packing`()`` |
| Go | `t.Run("UC-ORDER-CANCEL-001__RULE-001-c2", …)` |

- Tags avoid characters method names cannot hold (`.` `/` `:` `[` `<` spaces); continue
  with a description after `_` or a space
- Nodes are read by longest match among known IDs (`SC-001` vs `SC-001-A`,
  `RULE-001-c1` vs `-c10` are not confused)
- A tag naming a node missing from the IR is a `trace-tag` error (a typo, or a node
  removed from the IR)

## Results (JUnit XML)

Most runners emit JUnit XML (vitest `--reporter=junit`, Playwright `--reporter=junit`,
Gradle `build/test-results/`, gotestsum). A directory is scanned recursively for `.xml`.
`go test -json` output is read from `.json` / `.jsonl` files.

`failure` / `error` is Red, `skipped` is Skip, anything else is Green. **A test that does
not appear in the results does not exist** — a test that was written but not run counts
for nothing.

## trace.yaml — stances (optional)

```yaml
trace: UC-ORDER-CANCEL-001 # target usecase (an error if it does not match the IR)
untested: # node → why it has no test
  SC-003: the fee notice depends on a third-party rate service with no test double yet
owned_by: # node → existing untagged tests (`<classname>#<name>`, as shown in the trace table)
  RULE-001-c1: "billing.FeeTest#free before packing"
```

- An `untested` reason cannot be empty. A leftover `TBD` / `TODO` / `FIXME` / `UNRESOLVED`
  is a pending warn
- `untested` on a node that does have a test is a warn (a stale declaration)
- An `owned_by` test missing from `--results` is an error — "an existing test covers it"
  passes only when an execution result backs it

## Negative control — is the Green oracle real?

Green only says the test passed. A vacuous oracle passes too (a "not empty" check that
existing data always satisfies, a row-count check that also passes at zero). So every node
**Green through a direct test** must carry a record that breaking its oracle (making the
expectation false, withholding the fixture) made the test fail. No record is a `trace-nc`
error.

Each node takes the same shape wherever it is recorded:

```yaml
status: verified          # verified | pending | not-applicable
controls:                 # verified: at least one
  - oracle: "the order status shows Canceled"
    breakage: "expect the status Packed instead"
    observed_failure: "order-cancel.e2e.ts:41 expected Packed, received Canceled"
    verified: "2026-10-14 local"   # must start with YYYY-MM-DD
reason: "…"               # pending / not-applicable: required
```

Records live in one of two places:

- **Scenario / test files** (`--scenarios <dir>`, every `.yaml` / `.yml` under it): a
  file with a top-level `negative_control` whose `controls[]` entries list the IR nodes
  they prove under `nodes`, as tags. Only `status: verified` counts. Validating the rest
  of the file is left to the project's own tooling

  ```yaml
  negative_control:
    status: verified
    controls:
      - oracle: "the order status shows Canceled"
        breakage: "expect the status Packed instead"
        observed_failure: "order-cancel.e2e.ts:41 expected Packed, received Canceled"
        verified: "2026-10-14 local"
        nodes: [UC-ORDER-CANCEL-001__SC-002]
  ```

- **`trace.yaml` `negative_controls`** — for layers whose test code does not stay in the
  repository (e.g. acceptance tests generated against a throwaway scaffold) or that have
  no scenario file. `layer` is optional. A rule ID key applies to every case of the rule
  (a table-driven test shares one oracle across all rows)

  ```yaml
  negative_controls:
    SC-003:
      status: verified
      controls:
        - { layer: integration, oracle: "the fee notice is shown", breakage: "assert a different notice", observed_failure: "…", verified: "2026-10-14 scaffold" }
    RULE-001: # applies to RULE-001-c1, -c2, …
      status: verified
      controls:
        - { layer: unit, oracle: "fee calculation", breakage: "invert the expected value", observed_failure: "…", verified: "2026-10-14 local" }
    RACE-PLACED-pack-cancel: { status: pending, reason: "waiting for a fixture that builds the winner's state" }
  ```

`pending` is a warn (no grounds yet to trust the Green); `not-applicable` passes with its
reason. Derived rows (`via SC-xxx`), Red, and untested rows are out of scope — the
question is asked of the source node. The trace table's NC column shows `verified` /
`pending` / `not-applicable` / **missing**.

## Checks

| check | level | what it reports |
| --- | --- | --- |
| trace-uncovered | error | a node no test (direct or derived) confirms and no `untested` declares |
| trace-tag | error | a tag / marker naming a node missing from the IR; a marker naming a non-outcome node |
| trace-owned-by | error | `owned_by` naming a missing node, or a test not in the results |
| trace-untested | error | `untested` naming a missing node or with an empty reason (warn if the node has a test) |
| trace-usecase | error | trace.yaml's target differs from the IR, or its IR is not among the inputs |
| trace-schema | error | malformed trace.yaml (unknown keys, malformed `negative_controls`) |
| trace-failing | warn | tests exist but none is Green (Red / Skip) — expected while acceptance-first tests wait for the implementation |
| trace-critical | warn | a `critical` scenario has no E2E result |
| trace-nc | error | a node Green through a direct test has no negative control, or a record names a missing node (pending is a warn) |
| trace-race | warn | a race winner confirmed outside unit / backend, a loser's view confirmed only at E2E, or an untested race |

When a node has both Green and Red, the verdict is Red (Green does not hide a failing
layer). The text output ends with a trace table (node × layer × verdict) ready to paste
into a report; with `--json`, each IR entry carries the same rows under `trace`.

## Limits

The trace guarantees that a test carrying the node's tag ran with that result, and that a
negative control **record exists**. It does not guarantee the record was actually
measured, or that the broken oracle was the outcome's claim itself — reading
`observed_failure` and the evidence remains a human job.
