# Writing a PRD with ESDD

The usual order is: write the PRD in prose, then convert it into UseCase IRs and let the checker
find what the prose left out. Writing the PRD *from* the IRs reverses that order: the questions
the checker would ask after the fact get answered while the PRD is written, and the behavior in
the PRD is the behavior that was checked, by construction.

A PRD has two parts, and they are held in two places:

| Part | Held in | Checked by |
| --- | --- | --- |
| Why: the problem, who it is for, goals and how they are measured, what is left out | the **PRD frame** (`*.prd.yaml`) | the frame checks below |
| What: the behavior of each usecase | the **UseCase IRs** the frame links ([usecase-ir.md](usecase-ir.md)) | the IR checker |

The PRD document is **rendered** from frame + IRs + a profile. It is a view: changes go to the frame
or the IRs, and the document is rendered again. Rendering is deterministic, so a re-render after an
answer shows exactly what the answer changed.

Out of scope for the PRD: how it is built (APIs, data model, architecture). That belongs to the
design doc that follows the PRD.

## The PRD frame

```yaml
prd: PRD-ORDER-CANCEL          # an ID starting with PRD-
title: Self-service order cancellation
owner: "@product-owner"        # optional
status: draft                  # draft / in_review / approved
summary: one sentence a reader can repeat

problem:                       # what is wrong today, as observed facts
  - "Customers can only cancel by contacting support"
users:                         # the ids are the actors the IRs' events name
  - { id: customer, label: the customer, description: "the person who placed the order" }  # label: the name the PRD uses (the id when omitted)
goals:
  - id: G1
    statement: Customers cancel without contacting support
    metric: share of cancellations done in the app   # required — TBD while undecided
    target: "80% within three months"                # optional
non_goals:                     # required; [] says "nothing is left out", a missing key says nothing
  - "Partial cancellation"
usecases:                      # IR files, relative to this file
  - order-cancel.usecase.yaml
sections:                      # free sections a profile places by id (Markdown)
  rollout: "Released to everyone at once"
questions:                     # asked, not answered yet, and not a field of the frame or an IR
  - { question: "Can a customer cancel a gift order?", proposal: "Only the buyer can" }
```

[examples/order-cancel.prd.yaml](../examples/order-cancel.prd.yaml) is a complete frame.

## What is checked

```bash
npm run check -- --prd <frame.prd.yaml> [--profile <profile.yaml>] [--strict]
```

The frame and every IR it links are checked together:

| Check | What it enforces |
| --- | --- |
| prd-structure | the fields above; every goal has a metric; `non_goals` is written |
| prd-pending | `TBD` / `TODO` / `FIXME` / `UNRESOLVED` left in the frame (warn) |
| prd-actors | every actor in the IRs' events is one of `users` (warn): a PRD that never says who an actor is leaves the reader guessing |
| prd-usecases | no usecase linked twice |
| prd-questions | a question in `questions` is still open (warn) |
| prd-sections | a section the profile marks `required` is missing, or a frame section the profile does not place (warn) |
| the IR checks | everything in [usecase-ir.md](usecase-ir.md), per linked IR |

With `status: approved`, every warn becomes an error: an approved PRD has no open question left.
`--approved` additionally requires `status: approved`, for frames committed as approved (in CI, say).

## The rendered PRD

```bash
npm run check -- --prd <frame.prd.yaml> [--profile <profile.yaml>] --render
```

- **Requirements** are written one per transition declaration, in the EARS style
  (*While \<state\>, when \<actor\> does \<event\>, the system shall …*), with the transition's
  outcomes listed under it. EARS is chosen because every part of its sentence maps to one field
  of a transition, so the sentence can be produced without inventing words. A declaration with
  several `from` states is one sentence naming them all, as it is one decision; a transition back
  to its own state uses the `stay` phrase
- **Cases that do not occur** list the `impossible` declarations with their reasons. They are
  decisions too, and a reader who disagrees with one has found a gap in the spec
- **Simultaneous operations** come from `races`, **Rules** from `rules` (one table per rule),
  **Input conditions** from `inputs`, and **Acceptance criteria** from `scenarios` as
  Given / When / Then
- **Open questions** are computed at render time, so the list cannot go stale. A `TBD` left in the
  frame or an IR is shown as the text to complete, under the heading or usecase the reader finds it
  in, not as the checker's location; a long section is shown by its lines that carry the marker.
  The frame's `questions` come next, with their proposals. The other findings follow as the checker words them (they are
  already questions; ids in them are replaced by labels). An undeclared cell or race is worded with
  the profile's `undeclared` / `unraced` phrase instead; races that share one event against the same
  actor (the operator's cancel against whatever the driver does, in any state) are one question. Coverage is left out: filling it is the
  author's job (`--suggest-paths`), not a decision for the owner. Then come the assumed answers, which become final when the IRs are approved
  ([usecase-ir.md](usecase-ir.md#assumptions-and-the-question-list))
- `ASSUMED(<id>)` markers stay in the IR for tracing; the rendered text shows the profile's
  `assumed` phrase in their place

## Profiles

What differs between companies is the layout and the wording, not the method. A profile file holds
that part; keys it leaves out keep the default.

```yaml
title: false           # leave out the title line when the destination shows the title itself
sections:              # the order and headings; replaces the default list when given
  - { id: summary, heading: TL;DR }
  - { heading: Background, level: 1 }                  # no id: a heading only, grouping what follows
  - { id: problem, heading: Problem, level: 2 }        # level: the Markdown heading level (default 2)
  - { id: use_cases, heading: What it does }
  - { id: rollout, heading: Rollout, required: true }   # any id other than the built-ins is read from frame.sections
  - { id: notes, heading: Notes, always: true }        # kept as an empty heading when the frame leaves it empty
  - { id: open_questions, heading: Decisions still needed }
fold: [not_applicable, inputs]   # sub-sections rendered as a folded <details> block (see below)
phrases:               # sentence patterns; placeholders {state} {event} {actor} {to} {a} {b} {winner} {reason}
  transition: "In “{state}”, when {actor} chooses “{event}”, the order becomes “{to}”."
  assumed: " (assumed: {id})"   # replaces ASSUMED(<id>) in the rendered text
labels:                # sub-headings and table headers
  acceptance: Acceptance tests
```

Built-in section ids: `summary`, `problem`, `users`, `goals`, `non_goals`, `use_case_list` (one line
per usecase with its critical scenarios), `use_cases` (each usecase one heading level below the section),
`open_questions`.
To follow a template a team already uses, copy its headings, order and levels into the profile and add
only the sections the checks need that the template lacks (goals with metrics, users). Phrase keys: `transition`, `stay` (a transition back to the same state), `ignored`, `impossible`, `race`, `race_first`, `undeclared`, `unraced`, `assumed`.
`fold` names the usecase sub-sections a reader opens only when checking the machine's work —
the impossible declarations and the input matrix are the usual ones; `requirements`, `races`,
`rules` and `acceptance` can be folded too. A folded sub-section is rendered as an HTML
`<details>` block with the label as its summary, which Markdown renderers and wiki importers
show collapsed. Folding changes nothing about what is checked.
A profile for a team that writes specs in another language translates `phrases` and `labels`;
the IR texts stay in the language they were written in.
[examples/prd-profile.yaml](../examples/prd-profile.yaml) is a complete profile.

Where the rendered Markdown goes (a docs tool, a wiki, the repository) is the project's choice and
not part of the method.

## Authoring loop

The loop an author (or an agent working for one) follows. The same rules as everywhere in ESDD
apply: nothing is invented, and an undecided point is carved in as `TBD` or declared as an
assumption — never filled in silently.

1. **Frame first.** Ask the owner for the problem, the users, the goals with a metric each, and
   what is left out. Write what they say; a goal without a metric gets `metric: TBD`, not a
   plausible-sounding metric
2. **Split into usecases.** One IR per thing that has its own lifecycle (states mode) or its own
   form (form mode). Name the actors with the `users` ids
3. **Draft each IR** from what the owner described ([pipeline.md](pipeline.md) input modes). The
   frame is the spec these IRs are converted from, so each IR's `source.spec` names the frame file;
   there is no separate PRD document until it is rendered. Cells the owner did not talk about stay
   undeclared — the checker will ask about them
4. **Ask what nobody declared.** The checker only closes over what is declared: an event, an
   input or an actor the owner never mentioned produces no finding
   ([usecase-ir.md](usecase-ir.md#inputs-input-axis-matrix--usable-in-both-modes), Limit).
   A review has the prose spec to read for these; an author has only the owner, so ask for them:
   - events similar features usually have: cancel, timeout, network failure, no permission,
     the same operation twice, empty input. A failure of an action belongs to the actor of that
     action, and the same operation twice is a rule
     ([usecase-ir.md](usecase-ir.md#states-mode))
   - a user in `users` who acts in no usecase, and for each actor, what it can do in each state
   - outcomes the owner gave as internal behavior ("it is saved"): what does the user see?
   - displayed text left abstract ("an error is shown"): the text itself
   - a `non_goals` entry that a usecase's behavior contradicts
   - races across usecases (a cancel against the other side's progress), which an IR cannot
     express: ask anyway and note the limit

   These are candidates, asked with a proposal like any question
   ([pipeline.md](pipeline.md#questions-and-severity)). A candidate the owner keeps is declared,
   and the checker then asks for its cells. A candidate the owner rejects is written down too: as
   a `non_goals` entry when it is out of scope, or as an `impossible` declaration with the reason
   when it cannot occur. That way the rendered PRD records the decision, and the next reader does
   not ask again. A candidate the owner has not answered yet goes into the frame's `questions`, so
   it stays on the open questions instead of being lost
5. **Check** with `--prd`. The findings are the question list. Ask them, or apply a proposed answer
   as an assumption where [pipeline.md](pipeline.md#accept-by-default) allows it. Repeat until no
   error is left; an answer that adds an event or a state brings its own candidates and cells
6. **Render** and share the document for review. Comments on it are answers: fold them into the
   frame or the IRs and render again — never edit the rendered document by hand
7. **Approve** the IRs ([approval.md](approval.md)) and set `status: approved`; the `--prd` check
   then refuses any open question
