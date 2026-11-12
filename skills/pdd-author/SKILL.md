---
name: pdd-author
description: Write a design doc (technical or product design doc) against the UseCase IRs of its feature with ESDD, so that each constraint (limit, uniqueness, request meaning, order, error, permission) is written with its observable consequence and an IR reference, layers agree, and open points are one list with proposals. Use when asked to write or draft a design doc for a feature that has a PRD or IRs; prd-author also calls it, by default, after the PRD's IRs are checked.
---

# Writing a design doc with ESDD

The method is [docs/pdd.md](../../docs/pdd.md#writing-a-design-doc). This skill only runs it. The
design doc keeps the team's own template. The method adds one behavior section and a few rules.

The design doc belongs to the implementation team (engineering); the PRD belongs to the spec owner.
When [prd-author](../prd-author/SKILL.md) calls this skill, the result is a draft for that team: its
design choices are proposals for them, and only behavior questions go back to the spec owner, through
the PRD's loop. Link the finished doc from the PRD (prd-author's step 5).

## Inputs

- the PRD (or PRD frame) and the feature's IRs, approved or in review
- the design decisions the author has made so far: schema, API, limits, management of values
- the team's design-doc template, if one exists

## Steps

1. Read the IRs and list each rule, input cell, outcome, race and impossible cell this design changes
   or enforces. Name the IR items it leaves to others. An item nothing in the design backs is a
   design gap: fill it before review, do not ask the owner. A fill that reuses an existing type or
   API: check whether the client reads it as one item or a list
   ([docs/pdd.md](../../docs/pdd.md#writing-a-design-doc), step 1)
2. For each constraint, write a row in the behavior section: the constraint, where it is enforced,
   what the user sees, and the IR reference. A constraint with no visible effect gets no row; list
   those below the table with the reason. When the design is read from the existing implementation,
   a consequence it supplies is a proposal until the owner states it: a question, or an assumption
   with the code as its basis ([docs/pdd.md](../../docs/pdd.md#writing-a-design-doc), step 2)
3. A row whose consequence is in no IR is new behavior. Ask the PRD owner, with a proposal. Do not
   decide it in the design doc: the row says `proposed:` with the open point, and "none yet" in the
   IR column. When the design cannot back an IR item, change the design; ask the owner only if
   backing it is not worth the cost, with the behavior the design can back as the proposal
4. Where layers differ (the database allows what the API refuses), say which one the user meets,
   or list it as an open point
5. Add rows for what changes outside the feature: values managed by hand or by an admin,
   migrations of existing items, cascading deletes
6. Keep open points in one list, each with a proposal and who decides
7. Fold the rows into the IRs, list the design doc and its edit time in the `source.sources` of every
   IR it backs or adds to, and check:

   ```bash
   npm run check -- <ir.yaml> ... --questions
   ```

   An open point with an IR place goes there as a `TBD`. One without stays in this doc's open-point
   list when the implementation team decides it, and goes in the PRD frame's `questions` (with its id
   and severity) when the spec owner does. Answer what the new cells bring, in the doc and the IRs,
   then ask for approval ([docs/approval.md](../../docs/approval.md)). Folding into an approved IR
   needs approval again. When prd-author called this skill, skip the checks and the approval here:
   hand the IR changes and the open points back, and the PRD's loop checks them with the PRD and
   approves once

## Do not

- invent a consequence the author did not state. Leave it as an open point
- put the constraint itself (a column, an index, a status code) into an IR outcome
- present a proposal for a point the implementation team decides as a decision. The checks stop at
  observable behavior, so API shape, data size and performance are left for that team to review
  ([docs/pdd.md](../../docs/pdd.md#writing-a-design-doc), "What the checks do not see")
