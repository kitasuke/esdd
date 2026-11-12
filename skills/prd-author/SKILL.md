---
name: prd-author
description: Write a PRD with ESDD - a PRD frame (problem, users, goals with metrics, non-goals) plus the UseCase IRs of its behavior, checked while it is written and rendered into the PRD document - then, by default, draft the design docs with pdd-author (one, or one per part when separate teams own the parts) and link them from the PRD. Use when asked to write or draft a PRD, or to turn a feature idea, notes or a ticket into a PRD.
---

# Writing a PRD with ESDD

The method is [docs/prd.md](../../docs/prd.md#authoring-loop). This skill only runs it. The PRD is
held as a frame and IRs, and the document is rendered from them; it is never edited by hand.

## Inputs

- the spec owner (usually product), or what they have written so far: notes, a ticket, a draft
- the product's PRD template, as a profile ([Profiles](../../docs/prd.md#profiles)), if one exists
- existing IRs of the feature, if any

## Steps

1. Ask the owner for the frame: problem, users, goals with a metric each, non-goals, and the free
   sections the profile requires ([The PRD frame](../../docs/prd.md#the-prd-frame)). An unanswered
   field gets `TBD`; do not write a plausible goal or metric for them
2. Split the behavior into usecases and draft one IR each from what the owner said. Each IR's
   `source.spec` names the frame. Cells the owner did not talk about stay undeclared
3. Ask what nobody declared: the candidate events, actors, outcomes and screens of the loop's step 4,
   each with a proposal. Write a rejected candidate down as a non-goal or an `impossible` with its
   reason, and an unanswered one in the frame's `questions` with its id and severity
4. Check, and ask the findings as questions with a proposal and a tier
   ([pipeline.md](../../docs/pipeline.md#questions-and-severity)):

   ```bash
   npm run check -- --prd <frame.prd.yaml> [--profile <profile.yaml>]
   ```

   Write each answer into the frame or the IR as the behavior itself, and repeat until no error is left
5. Draft the design docs with [pdd-author](../pdd-author/SKILL.md) against these IRs: one, or one per
   part when separate teams own the parts (each API, each client)
   ([One design doc, or one per part](../../docs/pdd.md#writing-a-design-doc)), unless the
   owner confirms the feature needs no new API, data or limits. Each design doc belongs to its
   implementation team: hand each draft to its team, and present its design choices as proposals for
   them. Only behavior questions come back to the owner, through step 4. Link each design doc from the
   PRD: in the frame's `design_docs` (the check then holds it in step with the IRs' `source.sources`),
   and where the PRD is published, the way the doc tool links documents, with a title or document type
   that marks it as a design doc, so a later review finds it
   ([Finding the design docs](../../docs/pdd.md#finding-the-design-docs)).
   When pdd-author hands back, go through steps 3 and 4 again: the rule cases, cells and open points
   it added have not been checked or asked yet, and the checker alone finds nothing it was not given,
   so ask what the design doc's refusals, limits and timing bring that nobody declared. Of the open
   points with no IR place, only the owner's go in the frame's `questions`; the implementation
   team's stay in the design doc. List the design doc in the `source.sources` of every IR it backs or
   adds to. Render only once no error is left
6. Render, and share it for review:

   ```bash
   npm run check -- --prd <frame.prd.yaml> [--profile <profile.yaml>] --render
   ```

   Comments on the rendered PRD are answers: fold them into the frame or the IRs and render again
7. Ask for approval of the IRs ([docs/approval.md](../../docs/approval.md)), then set `status: approved`

## Do not

- invent a goal, a metric or a behavior the owner did not state. Leave it `TBD` or ask
- edit the rendered PRD by hand
- decide a design choice for the implementation team, or send their questions to the spec owner
- publish the PRD or the design doc anywhere without the operator asking for it
