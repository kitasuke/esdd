---
name: pdd-review
description: Review a design doc (technical or product design doc - APIs, data model, limits, review threads) against the UseCase IRs of its feature with ESDD. Takes the observable consequences of its constraints into the IRs, and returns gaps, open threads and disagreements (with the PRD, within the doc, with the implementation) as questions for the spec owner. Use when asked to review a design doc, read a design doc into the IRs, or check a design doc against the PRD.
---

# Reviewing a design doc with ESDD

The method is [docs/pdd.md](../../docs/pdd.md). This skill only runs it. Read
[docs/pipeline.md](../../docs/pipeline.md) for review rounds, questions and the answer ledger.

## Inputs

Collect these before converting. Ask for any that are missing:

- the PRD (or PRD frame) and every design doc of the feature
- each design doc's comment threads, open and resolved
- each source's edit time
- the input mode: A (spec only) or B (spec plus implementation, the default when the feature exists)
- the existing IRs, if any

## Steps

1. Record every source and its edit time in `source.version`, and the design-doc links in the IR
   header comment ([Versions](../../docs/pdd.md#versions-and-approval-freshness))
2. Sort each statement into spec or implementation detail
   ([What in a design doc is spec](../../docs/pdd.md#what-in-a-design-doc-is-spec)). Keep the
   statements you take, with their locations
3. Map each one to its IR place
   ([From constraints to IR places](../../docs/pdd.md#from-constraints-to-ir-places)). Write the
   observable consequence. The constraint is only the basis, never the outcome text. Keep the
   existing IR order
4. Raise questions for [gaps](../../docs/pdd.md#gaps-constraints-that-say-less-than-they-seem-to),
   [threads](../../docs/pdd.md#comments-and-open-threads) and
   [disagreements](../../docs/pdd.md#disagreements). Each question gets one proposal, a tier and who
   decides. Disagreements are always must-ask. Question ids continue the PRD's list
5. Check, and turn the findings into questions too:

   ```bash
   npm run check -- <ir.yaml> ... --questions
   npm run check -- --prd <frame.prd.yaml>     # when a PRD frame exists
   ```

6. Report the question list, and how the findings map to questions, where the run is tracked.
   Fold answers in with `npm run check -- <ir.yaml> ... --answers <ledger.yaml>`, then check again
7. Before approval, re-read every source's edit time and look for threads opened since the
   conversion. Any change voids the approval

## Do not

- copy table layouts, column names or internal calls into the IR
- settle a disagreement yourself, or let code behavior into the IR without a delta and a reverse question
- write into the design doc (a comment or an edit) without the operator confirming the content
