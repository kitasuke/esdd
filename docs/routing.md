# Routing — which platforms a change has work on, before anything is generated

A generator writes the client of a change: its screens, its operations, its tests. Whether the
change also needs the server (a new field, a new mutation, a new check) cannot be read from the
ticket's words; it is a fact about the code. **Routing** settles it first, from the API schema and
the existing screens, and writes the result to a routing file: one work item per platform, with
its evidence, its order and who does it. "The server needs work first" is not a failure of the
run. It is one of the normal outcomes.

Routing writes no code and no tickets. It runs before the generator, again whenever the generator
finds server work it did not expect (the feedback path, below), and its file is checked
mechanically (`--routing`). The names of the platforms are the project's
([Configuration](#configuration)); the examples here use `backend`, `codegen`, `web`, `android`,
`ios` and `e2e`.

## Inputs

- The spec in any form the pipeline takes (ticket, PRD, design doc, UseCase IR)
- **A base commit** the evidence comes from (the default is the latest main branch). Read files at
  that commit, not from the working tree: uncommitted edits and branches that are not merged are
  not evidence. An open change for the same ticket is recorded as work in progress, not as
  evidence. A merged change's description is read for what it decided ("fixed in a follow-up",
  "released after X"); what it says the change is for, and how far it went, decide nothing
- **Never the agent's memory.** Notes from earlier sessions are neither evidence nor a hint where to
  look: the steps alone must reach the same work

## Steps

1. **Split each requirement into the contracts a screen needs.** The fields, arguments (filters,
   sort keys), mutations, input fields, enum values and address parameters. A requirement that
   lists alternatives ("one of the following") becomes one requirement per alternative: where each
   alternative's work lands is what decides the scope. When the spec names a component ("the
   interview card"), search for the names code, tests, fakes and screen text use for it too (each
   word on its own, the word with a state inserted, the component's name in code), not only for the
   spec's phrase, and write the patterns and hits as evidence
2. **Check each contract at the base.** In the client's schema, then in the resolver: the schema can
   declare a field whose resolver returns nothing. Each need gets a status:
   - `exists`
   - `missing`
   - `stub`: in the schema, but the implementation returns empty or an error
   - `differs`: present, but it means something else (the sort keys lack the one needed; a filter
     uses another reference date)

   `stub` and `differs` are server work, like `missing`. A per-row field that exists but is read
   once per row is server work too (batch it). So is a design that fetches a name per element with a
   second operation: add the field to the element's type instead, and say who may read it. Before
   marking a field `missing`, look for records the screen already fetches that state the same fact
   (a history written at the same moment); when they do, ask whether to assemble it on the screen
   (with what it cannot show) next to adding it to the server
3. **Find the screens that already show the same fact**, on every client (web apps, mobile apps,
   exports, other API consumers). Each is either work on its platform or listed as not routed, with
   the reason. A platform with no hit is listed as not routed with the pattern that found nothing.
   For a change to server behavior (a permission, how a missing argument is treated), find every
   caller of the changed field:
   - Search for the **field name only**. Searching `field(` misses calls without arguments
     (`field {`). Follow fragments to the operations that use them, and drop nested fields of the same
     name on other types. Search generated client documents and tests that write queries as strings,
     not type declarations. A path pattern with `*` must not end in `/`: in common version-control
     tools it then matches nothing
   - Write one evidence line per caller: how it passes the argument (a value, null, nothing), which
     page uses it, and for which role. Keep the callers you set aside, with the reason
   - A caller the change leaves empty, failing or contradicting the rest of its page is client work
     that ships before the server change
   - **A new server check gets no bypass.** When a new check (a permission, a region, a required
     argument) breaks an existing caller, neither the work nor any option lets that caller or role
     skip the check: the data the check protects leaks through the exception. Give the caller a source
     that returns only what it uses (an existing one if it suffices, or a new contract), move the
     caller to it, and order the work: new source, then the callers' move, then the check (the check's
     work depends on the move). When unsure, make a new source
4. **Pick up what the server has to decide.** When the spec touches one of these, look for where
   the base code decides it; decided, it is recorded with the file and line; not decided, it is
   server work of kind `decision`, with a proposal:

   | The spec touches | The server decides |
   | --- | --- |
   | deleting a record | whether writes that race the delete are serialized; whether a referenced record can be deleted |
   | a reference to a record under other permissions | how much of the referenced record the reader may see, in both directions |
   | choosing among candidates | whether the candidate query has a limit or paging, and whether candidates past it drop silently |
   | attachments | accepted formats and sizes |
   | a state or count that changes with the date | whether the server computes it, and whether lists, warnings, counts and exports share the definition |
   | filtering and sorting | whether the server needs the argument (a paged list cannot be sorted on the client) |
   | a write | who may perform it, and whether a test checks that a read-only user is refused |

   The rule of a similar existing record is not this record's rule: "the same as X" is a proposal, not
   a decision. A check that exists without a test of its refusal is server work (add the test). How
   the ticket suggests implementing something (which operation, client or server) is not a decision
   either
5. **Order the work.** Server schema, then generated client code, then each client. Client work
   waits for the contract, not for the implementation: an additive contract can land first, and the
   client is written and checked against a fake. A `decision` goes into the dependencies of whatever
   it changes. When part of the client work can be built correctly on what exists today, split it
   from the part that waits, and let the generator's question about partial scope decide which ships
   first. When both server and client have work, add a **verification** item (the E2E suite against a
   shared environment once both are deployed) that depends on every server and client item: a fake
   checks only the server behavior the generator assumed
6. **Write the verdict**
7. **Check the file** (`--routing`), and fix what fails. A rerun through the feedback path checks it
   again

## The routing file

```yaml
source: { spec: <spec>, version: <its edit time, or null>, base: <commit> }
round: 1 # +1 each time feedback is folded in
verdict: server-first # client-only | server-first | no-client | blocked
requirements:
  - id: R1
    text: sortable by registration date
    needs:
      - { kind: sort, target: "Query.items(orderBy)", status: missing, evidence: "no orderBy argument (schema/items.graphql:<line>)" }
work:
  - id: W1
    platform: backend
    what: add registration date to the sort keys
    from: [R1]
    kind: contract # contract | implementation | decision | verification
    evidence: <file:line, or the pattern that found nothing>
    depends_on: []
    runner: <who does it: a generator, or the owning team>
    status: todo # todo | in-progress (<change>) | done (<commit>) | deferred (<who, why>) | pending (verification only)
decided:
  - { topic: who may delete, decided_by: "<file:line, or where the spec says it>" }
not_routed:
  - { platform: android, evidence: "no hit for itemRegisteredAt under the app's sources" }
questions:
  - id: Q1
    text: <the point of scope>
    options:
      - { id: A, text: <proposal>, verdict: client-only, adds: [] }
      - { id: B, text: <the other option>, verdict: server-first, adds: ["backend contract: <what>", "web: <what>"] }
    recommended: A
    why: <the basis in the spec>
feedback: []
```

[examples/order-cancel.routing.yaml](../examples/order-cancel.routing.yaml) is the file for the
bundled example.

### Verdicts

- `client-only`: every server item the client work depends on (through generated code too) is
  done. Server work that remains stays in `work` as a follow-up. The generator runs
- `server-first`: some client work waits for server work that is not done. Client work that does
  not wait can be generated first
- `no-client`: no client work. The generator does not run
- `blocked`: the spec does not say enough, and the answer changes the platforms or the order. The
  open points are questions; the generator does not run until they are answered

### Questions carry the routing of their proposal

`verdict`, `work` and the order are written as if each question's **recommended option** were the
answer. Work that only another option creates (server and generated-code work, and the client work
that grows with it) is not in `work`; it is in that option's `adds`, and each option names its own
verdict. Nothing is lost: the work is in the question, not deleted.

The proposal follows the spec's text (its body and the owner's written answers). **An element that
appears only in a mockup or an image, and that the text does not name, is out of scope by
default**: the proposal is to leave it out (or to a ticket of its own), and its work goes into the
other option. When text and image disagree, the text wins; when the text cannot decide, the
proposal is to leave it out.

Other rules for questions:

- A question that does not change where work goes, its order or who does it is not a routing
  question. It goes into the work item's description as a point the generator decides in its IR,
  without a proposal. The release order (does the client ship before a data fix) is one of these
- Which existing screen or component the change belongs to, when every candidate is a screen of the
  same client and the spec names no new fact, is not `blocked` either: put the work on the most
  likely candidate, say so in its description with every candidate's file and line, and let the
  generator settle it
- Each option is one routing outcome. Several ways to do without server work are one option ("no
  server work"), and which one is the generator's to decide
- A question that splits no routing (which example and account can tell the change apart in the
  verification run) has no options; its proposal is written in `recommended` as text

### Status

`deferred` is only for work a person took out of scope, and says who. Work is never dropped from
the list silently. `done`, `in-progress` and `deferred` carry their commit, change or decider in
parentheses. `pending` is only for verification work no existing account can reach.

## The feedback path

Server needs are often found while the client is being built. A generator that finds one stops
that part and appends to `feedback`:
`{ from: <generator>, found: <what is missing>, evidence: <file:line or pattern>, stopped: [<client work ids>] }`,
then reruns routing. The rerun runs steps 2–5 for each entry, adds the server work (or, when the base
has no evidence for it, writes why and adds nothing), adds it to the stopped work's dependencies,
marks the entry `resolved_as: <work id>` and raises `round`. An answer to a question that contradicts
a decision or removes server work is folded the same way. The generator then rereads the file and
continues only the client work with nothing left to wait for.

Never fill a server gap with a temporary schema, hand-written generated files, or a field that only
the fake has: that deletes the server work without anyone deciding to.

## Checks (`--routing`)

```
node src/cli.ts --routing <routing.yaml> [<routing.yaml> ...] [--config <config.ts>] [--json]
```

| check | fails when |
| --- | --- |
| routing-shape | the file is not a mapping; `source`, `verdict`, `requirements` or `work` is missing; a section is not a list of mappings |
| routing-enum | a verdict, platform, kind, need status or work status outside the vocabulary; `pending` on work that is not verification |
| routing-ids | an item without an id, or an id used twice within requirements, work or questions |
| routing-refs | `from` that is not a requirement; `depends_on`, `stopped` or `resolved_as` that is not a work id (`resolved_as: not_routed` is allowed) |
| routing-cycle | `depends_on` has a cycle |
| routing-status | `done`, `in-progress` or `deferred` without its note in parentheses |
| routing-recommended | `recommended` is not one of the question's options, or a question has neither options nor a proposal |
| routing-verdict | `client-only` while client work waits (through any chain) on server work that is not done; `server-first` while none does; `no-client` with client work; `blocked` without questions. Deferred work is not counted |
| routing-verification | server and client both have work, and no verification item depends (through any chain) on all of it |

The checks are structural. Whether the evidence is right is for the reviewer of the file; what
the checks guarantee is that the file is complete and agrees with itself. In one backtest over 50
past routing files, 45 passed and 5 failed for real drift: questions without ids, a misspelled
`recommended`, and a file that was not valid YAML.

## Configuration

The platform names come from the configuration (`--config`, [README](../README.md#configuration)):

```ts
export default {
  routing: {
    platforms: ["backend", "codegen", "web", "android", "ios", "e2e"], // every platform work may name
    server: ["backend"], // what client work waits for
    client: ["web"], // what the generator writes; the verdict is about these
    verification: "e2e", // the platform of the verification item
  },
};
```

Omitted fields keep these defaults.
