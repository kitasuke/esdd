---
name: pdd-author
description: Write a design doc (technical or product design doc) against the UseCase IRs of its feature with ESDD, so that each constraint (limit, uniqueness, request meaning, order, error, permission) is written with its observable consequence and an IR reference, layers agree, and open points are one list with proposals. Use when asked to write or draft a design doc for a feature that has a PRD or IRs.
---

# Writing a design doc with ESDD

The method is [docs/pdd.md](../../docs/pdd.md#writing-a-design-doc). This skill only runs it. The
design doc keeps the team's own template. The method adds one behavior section and a few rules.

## Inputs

- the PRD (or PRD frame) and the feature's IRs, approved or in review
- the design decisions the author has made so far: schema, API, limits, management of values
- the team's design-doc template, if one exists

## Steps

1. Read the IRs and list each rule, input cell, outcome, race and impossible cell this design changes
   or enforces. Name the IR items it leaves to others
2. For each constraint, write a row in the behavior section: the constraint, where it is enforced,
   what the user sees, and the IR reference. A constraint with no visible effect gets no row; list
   those below the table with the reason
3. A row whose consequence is in no IR is new behavior. Ask the PRD owner, with a proposal. Do not
   decide it in the design doc: the row says `proposed:` with the open point, and "none yet" in the
   IR column
4. Where layers differ (the database allows what the API refuses), say which one the user meets,
   or list it as an open point
5. Add rows for what changes outside the feature: values managed by hand or by an admin,
   migrations of existing items, cascading deletes
6. Keep open points in one list, each with a proposal and who decides
7. Fold the rows into the IRs, cite the design doc and its edit time in `source.version`, and check:

   ```bash
   npm run check -- <ir.yaml> ... --questions
   ```

   An open point with an IR place goes there as a `TBD`; one without goes in the PRD frame's
   `questions`. Answer what the new cells bring, in the doc and the IRs, then ask for approval
   ([docs/approval.md](../../docs/approval.md)). Folding into an approved IR needs approval again

## Do not

- invent a consequence the author did not state. Leave it as an open point
- put the constraint itself (a column, an index, a status code) into an IR outcome
