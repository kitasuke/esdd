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
  - { id: customer, description: "the person who placed the order" }
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
| prd-sections | a section the profile marks `required` is missing, or a frame section the profile does not place (warn) |
| the IR checks | everything in [usecase-ir.md](usecase-ir.md), per linked IR |

With `status: approved`, every warn becomes an error: an approved PRD has no open question left.

## The rendered PRD

```bash
npm run check -- --prd <frame.prd.yaml> [--profile <profile.yaml>] --render
```

- **Requirements** are written one per transition, in the EARS style
  (*While \<state\>, when \<actor\> does \<event\>, the system shall …*), with the transition's
  outcomes listed under it. EARS is chosen because every part of its sentence maps to one field
  of a transition, so the sentence can be produced without inventing words
- **Cases that do not occur** list the `impossible` declarations with their reasons. They are
  decisions too, and a reader who disagrees with one has found a gap in the spec
- **Simultaneous operations** come from `races`, **Rules** from `rules` (one table per rule),
  **Input conditions** from `inputs`, and **Acceptance criteria** from `scenarios` as
  Given / When / Then
- **Open questions** are computed at render time, so the list cannot go stale. A `TBD` left in the
  frame or an IR is shown as the text to complete, under the heading or usecase the reader finds it
  in, not as the checker's location. The other findings follow as the checker words them (they are
  already questions), and then the assumed answers, which become final when the IRs are approved
  ([usecase-ir.md](usecase-ir.md#assumptions-and-the-question-list))
- `ASSUMED(<id>)` markers stay in the IR for tracing; the rendered text shows the profile's
  `assumed` phrase in their place

## Profiles

What differs between companies is the layout and the wording, not the method. A profile file holds
that part; keys it leaves out keep the default.

```yaml
sections:              # the order and headings; replaces the default list when given
  - { id: summary, heading: TL;DR }
  - { id: use_cases, heading: What it does }
  - { id: rollout, heading: Rollout, required: true }   # any id other than the built-ins is read from frame.sections
  - { id: open_questions, heading: Decisions still needed }
phrases:               # sentence patterns; placeholders {state} {event} {actor} {to} {a} {b} {winner} {reason}
  transition: "In “{state}”, when {actor} chooses “{event}”, the order becomes “{to}”."
  assumed: " (assumed: {id})"   # replaces ASSUMED(<id>) in the rendered text
labels:                # sub-headings and table headers
  acceptance: Acceptance tests
```

Built-in section ids: `summary`, `problem`, `users`, `goals`, `non_goals`, `use_cases`,
`open_questions`. Phrase keys: `transition`, `ignored`, `impossible`, `race`, `race_first`, `assumed`.
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
4. **Check** with `--prd`. The findings are the question list. Ask them, or apply a proposed answer
   as an assumption where [pipeline.md](pipeline.md#accept-by-default) allows it. Repeat until no
   error is left
5. **Render** and share the document for review. Comments on it are answers: fold them into the
   frame or the IRs and render again — never edit the rendered document by hand
6. **Approve** the IRs ([approval.md](approval.md)) and set `status: approved`; the `--prd` check
   then refuses any open question
