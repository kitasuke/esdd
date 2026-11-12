---
name: prd-review
description: Review a PRD (and the design docs linked from it) with ESDD. Converts the spec into UseCase IRs, runs the checker, and turns the findings into one question list for the spec owner, with a proposal, a tier and who decides for each question; then folds the answers in and re-reviews. Owns the review round, and calls pdd-review for each linked design doc. Use when asked to review a PRD or a spec, list the questions a spec leaves open, or re-review a spec after it changed.
---

# Reviewing a PRD with ESDD

The round is [docs/pipeline.md](../../docs/pipeline.md#running-a-review-round). This skill only runs
it. It owns the whole round (one question list, one answer ledger, one report) and calls
[pdd-review](../pdd-review/SKILL.md) for the design docs, which reads them and hands back.

## Inputs

Collect these before converting. Ask for any that are missing:

- the PRD (or PRD frame) and its edit time
- the design docs linked from it ([Finding the design docs](../../docs/pdd.md#finding-the-design-docs)),
  and any the operator names
- the input mode: A (spec only, the default for a review of the spec itself) or B (spec plus
  implementation) ([Input modes](../../docs/pipeline.md#input-modes--who-answers-the-questions))
- the existing IRs, if any, and the previous report and ledger on a re-review

## Steps

1. Record the PRD in `source.spec` / `source.version`, with the input mode
2. Look for design docs ([Finding the design docs](../../docs/pdd.md#finding-the-design-docs)). Count
   a doc found in several places once.
   - None found: a PRD-only round. Skip step 4 and do not use pdd-review
   - Some found: run pdd-review once per design doc, inside this round. It is called from here, so
     it never takes its own "started directly" branch
3. Convert the spec into IRs ([docs/usecase-ir.md](../../docs/usecase-ir.md)). A spec over several
   screens: shared material first, one question list across passes
   ([Running a review round](../../docs/pipeline.md#running-a-review-round))
4. For each design doc, run pdd-review's steps against the same IRs
5. Check, and get the open questions worded for the owner:

   ```bash
   npm run check -- <ir.yaml> ... --questions
   npm run check -- --prd <frame.prd.yaml>     # when a PRD frame exists
   ```

6. Turn every finding into a question with the fixed shape and severity, scope questions first
   ([Questions and severity](../../docs/pipeline.md#questions-and-severity)). Each question gets one
   proposal and a tier ([Accept by default](../../docs/pipeline.md#accept-by-default)), and says who
   decides: the spec owner, the implementation team, or another team. Design-doc questions join the
   same list with continuing ids. Map every error and pending marker to a question
7. Report once, where the run is tracked: the sources with their versions (for each design doc, also
   the time of its newest comment), the question list with a "who decides" column, the assumptions,
   and the mapping from findings to questions. For each design doc, add what pdd-review hands back
   (the statements taken, the thread readings, the pages skipped)
8. Fold answers in with `npm run check -- <ir.yaml> ... --answers <ledger.yaml>`, then check every
   IR again. A re-review after the spec changed converts it again rather than patching the IRs,
   and sorts the questions into answered, open and new
9. Before approval, re-read the edit time of every source and look for comment threads newer than
   the ones recorded at conversion
   ([Versions](../../docs/pdd.md#versions-and-approval-freshness)). Any change voids the approval

## Do not

- invent an answer, or put a proposal for a must-ask question into the IR before the owner accepts it
- send the implementation team's questions to the spec owner
- write into the PRD or a design doc (a comment or an edit) without the operator confirming the content
