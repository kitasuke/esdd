# Design docs with ESDD

A PRD says what a feature does and leaves out how it is built ([prd.md](prd.md)). The design doc
that follows it (a technical or product design doc: APIs, data model, limits, review threads) says
how. Converting a spec into UseCase IRs, the design doc turns out to be a source of behavior too:
a unique constraint, a length limit or the meaning of an empty request is behavior the user meets,
and often the PRD never states it. This document covers reading a design doc as a spec source
(review) and writing one so that the IRs get what they need from it (authoring).

The IR stays the single source of behavior. A design doc is read in the same conversion as the PRD,
under the same input mode ([pipeline.md](pipeline.md#input-modes--who-answers-the-questions)) and the
same review rounds; nothing in this document adds a check to the checker.

## What in a design doc is spec

The test is the one every outcome already passes: **can the user observe it on the screen?**
([usecase-ir.md](usecase-ir.md#two-authoring-principles)). ESDD's scope is the UI behavior of web
and mobile apps ([pipeline.md](pipeline.md#scope)), so an API error matters by what the screen does
with it. Only where an IR declares an API surface (`surface: API` in an outcome) is a client of the
API an observer too.

| Spec: goes into the IR as its observable consequence | Implementation detail: stays out of the IR |
| --- | --- |
| limits a user can hit: lengths, counts, sizes, rates | table and column names, types, indexes |
| constraints with a visible effect: uniqueness, required fields, allowed values | which service calls which, queues, jobs |
| the meaning of a request: an empty list clears, a missing field keeps the old value | caching, retries, batching (unless the user can see stale or duplicated data) |
| order: the order items are shown in, and who can change it | migrations, backfills (except what existing items look like after them) |
| errors the API returns, as far as the screen shows them | internal error codes no screen distinguishes |
| who may do what (permissions) | where the permission is checked |
| values managed outside the feature (by an admin, by hand in the database) and what users see when they change | how they are managed |

The constraint itself never goes into an outcome. "The tag id is unique per note (DB unique
index)" is not an outcome; "a tag already on the note is not offered again" is. The constraint
is the **basis** of that statement: cite it in the assumption's `basis` or in the answer ledger's
`source`, where a reader can trace the behavior back to the design doc.

A design-doc statement that has no visible effect is not a question either; leave it out. When it is
unclear whether it has one (a cache with a five-minute lifetime: can the user see an old value
after saving?), ask.

## From constraints to IR places

| In the design doc | In the IR |
| --- | --- |
| a required field, `min_len` / `max_len`, a size or count limit | a form-mode `inputs` field; its `empty` and `boundary` cells are covered by rule cases whose `expected` is what the user sees at the limit |
| an enum or a fixed set of allowed values | an `option` input, or a rule with one case per value that shows differently |
| a unique constraint | a rule for the same thing twice (the same operation twice is a rule, not a race — [usecase-ir.md](usecase-ir.md#states-mode)): one case per way it can arrive, e.g. the choice is not offered again, or the second save is refused with a message |
| the meaning of a request (replace-all, an empty array, an omitted field) | the outcome or `then` of the scenario that sends it: "saving with no tag selected is allowed, and the note shows no tags" |
| an order (`sorted by created_at`, "in the order received") | a rule or an outcome that says what the user sees first; whether and how the user changes the order is a question if the doc does not say |
| an error response | the failure event of the actor whose action failed, with an outcome that names what is shown (text referenced to its source — [pipeline.md](pipeline.md#running-a-review-round)) |
| a status column | a candidate for `states` only as far as a screen distinguishes it; a status no screen shows is not a state, and a state a screen shows that no status backs is a question |
| a cascade or a foreign key | a candidate event in the usecase that sees the effect: what a note shows when its tag is deleted |
| a permission check | a candidate "no permission" event or rule case |
| values managed outside the feature | a candidate event: the value is disabled, renamed or removed while items use it, and what those items show |

Each row yields candidates, not answers. A constraint gives the IR its effect only as far as the
doc states that effect; the rest becomes a question with a proposal, under the rules for questions
and the accept-by-default tiers ([pipeline.md](pipeline.md#questions-and-severity)).

## Gaps: constraints that say less than they seem to

A constraint often fixes what is stored and says nothing about how the user gets there. Each such
gap is a question, or an assumption where a basis exists:

- "Attachments are stored in the order they are received" says what order is shown, not whether a
  user can reorder them. Ask, with a proposal (the order cannot be changed; to change it, remove
  and add again), or assume it when a similar feature in the product behaves that way
- "Tags are managed directly in the database" says who adds tags, not what a note shows when its
  tag is disabled. Ask what the note shows, and whether the disabled tag is still offered when
  editing; propose the behavior of the nearest existing screen after checking it
  ([pipeline.md](pipeline.md#running-a-review-round))
- A limit with no message ("max 10 attachments") gives the boundary, not what the user sees at
  it. The cell is covered by a rule case with the text referenced or `TBD`

## Comments and open threads

Design docs carry their review in comments. Read them; they are part of the doc as it stands.

- **An unresolved thread** is an open question of the doc. Raise it as a question that references
  the thread, tagged with who decides it (the spec owner for behavior, the implementation team for
  how). If it touches behavior already in the IR, the affected cell's outcome carries the `TBD`
- **A resolved thread whose decision is in the doc body** needs nothing more; the body is the source
- **A resolved thread whose decision is not in the body** is a decision outside the spec. Record it
  in the ledger under `decisions:` with the thread as its `source`, and ask the owner to write it
  into the doc. Until then it counts only if the run declares the ledger an addendum
  ([pipeline.md](pipeline.md#running-a-review-round))
- **A comment that wants behavior the body or the product does not have** ("users want to post a
  note with only an image") is a disagreement (below), not a suggestion to drop

## Disagreements

A disagreement is a contradiction: must-ask, critical, and never settled by the converter
([pipeline.md](pipeline.md#accept-by-default)). Each question quotes both sides with their locations
and carries one proposal.

| Between | Example | How it is raised |
| --- | --- | --- |
| design doc and PRD | the PRD says a note keeps up to 20 tags, the design doc caps it at 10 | must-ask to the spec owner. A design doc that only **adds** a limit the PRD is silent on is not a disagreement: take it, with the design doc as its source, and ask only if the limit changes what the PRD promises |
| design doc and itself | the database allows an empty note body, the API requires `min_len = 1` | must-ask: "can a note be saved without text?" The proposal is what the user meets today (the stricter layer at the boundary they reach), but the answer decides which layer is wrong |
| design doc and a comment on it | a thread asks for image-only notes, the body requires text | must-ask, referencing the thread |
| design doc and the existing implementation (mode B) | the shipped screen accepts text only, the design doc allows image-only notes | the mode B rule: a recorded delta and a reverse question; the code's behavior never enters the IR silently |
| design doc and a design file | the design doc returns tags sorted by name, the screen design lists them in the order added | must-ask, or a question about which source owns the order |

The design doc does not outrank the PRD, nor the other way around. Who decides is the owner of the
behavior, and each answer is written back where it belongs (the PRD or the design doc) or recorded in
the ledger.

## Versions and approval freshness

An IR converted from a PRD and design docs has several sources, and each one can change after
approval. `source.spec` holds one link: the PRD (or the PRD frame). List every source with its
edit time in `source.version`, and the design-doc links in the IR's header comment:

```yaml
# Sources: PRD https://example.com/specs/notes-tags
#          design doc https://example.com/design/notes-tags
source:
  spec: "https://example.com/specs/notes-tags"
  version: "PRD 2026-10-20T09:00Z; design doc 2026-10-22T14:10Z; mode B: commit 4f2c1a9"
```

The approval conditions in [approval.md](approval.md#binding-the-approval-to-one-exact-ir) apply to
every source: before counting an approval, re-read each source's edit time, and treat an edit to a
design doc exactly like an edit to the PRD. If any source changed after the version the IR was
converted from, the approval is void and review starts again from that change. Many doc tools do
not change a doc's edit time when a comment is added, so also look for threads opened since the
conversion; a new thread on behavior is a new question before approval.

## Reviewing a design doc

The steps a reviewer (or an agent working for one) follows. The input mode, the review rounds and
the approval are unchanged; these steps add what is specific to a design doc.

1. **Collect the sources.** The PRD, every design doc, their comment threads, and each source's
   edit time. Declare the input mode. Record all of it in `source.version` from the first draft
2. **Sort each statement** into spec or implementation detail with the table above. Keep a list of
   the statements taken, each with its location in the doc, as the basis for the questions
3. **Map** each spec statement to its IR place (constraints table). Where the IR already exists,
   add rule cases, input cells and candidate events to it, keeping its order
   ([approval.md](approval.md#updating-an-approved-ir)); otherwise draft the IRs from the PRD and
   the design doc together
4. **Raise questions** for gaps, open threads and disagreements, each with a proposal, a tier and
   who decides. Ids continue the PRD's question list, so one list covers the spec
5. **Check** the IRs (`npm run check -- <ir.yaml> ...`, or `--prd` with the frame). The findings
   join the list; send it where the run is tracked and fold answers in with `--answers`
6. **Before approval,** re-read every source's edit time and look for new threads

## Writing a design doc

The PRD procedure ([prd.md](prd.md#authoring-loop)) writes the PRD from the IRs so the checker's
questions are answered while it is written. A design doc written against the IRs does the same for
the questions above: **every constraint is written together with its observable consequence**, so
the IR takes the consequence and no reviewer has to infer it.

The design doc stays a document in the team's own template; nothing renders it. What the method
adds is one section and a few rules:

**The behavior section.** One table, one row per constraint that the user can observe:

| Constraint | Enforced at | What the user sees | IR |
| --- | --- | --- | --- |
| a tag appears once per note | DB unique, API 409 | a tag already on the note is not offered again | RULE-002 |
| an empty tag list removes all tags | API | saving with no tag selected is allowed; the note shows no tags | SC-004 |
| note text is 1 to 2000 characters | API, client | the save button stays disabled while the text is empty | `body×empty` |

1. **Start from the IRs.** Read the IRs (approved or in review) and the PRD. List each rule, input
   cell and outcome the design must enforce; each needs at least one row
2. **Write the consequence with each constraint.** For every limit, uniqueness, request meaning,
   order, error and permission in the design, add its row. A constraint with no visible effect gets
   no row. A row whose consequence is not in any IR is new behavior: it goes back to the PRD owner
   as a question, and the design doc does not decide it alone
3. **Agree the layers.** Each row names every layer that enforces it (database, API, client). Where
   the layers differ (the database allows what the API refuses), the row says which one the user
   meets and why the other differs, or the difference is an open point
4. **Cover what changes outside the feature.** Values managed by hand or by an admin, migrations of
   existing items, deletions that cascade: a row each for what users see when they happen
5. **Keep open points in one list.** Each with a proposal and who decides, in the doc rather than
   only in comment threads, and each resolved thread's decision written into the body
6. **Fold into the IRs and check.** Add the rows' consequences to the IRs, cite the design doc in
   `source.version`, and run the checker. The new rule cases and cells bring their own questions;
   answer them in the doc and the IRs, then ask for approval
