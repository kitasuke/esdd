---
name: pdd-review
description: Read a design doc (technical or product design doc - APIs, data model, limits, review threads) into the UseCase IRs of its feature with ESDD. Takes the observable consequences of its constraints into the IRs, and raises gaps, open threads and disagreements (with the PRD, within the doc, with the implementation, with an assumption) as questions. Runs inside prd-review's round, which owns the checks, the report and the answers. Use when asked to review a design doc, read a design doc into the IRs, or check a design doc against the PRD.
---

# Reading a design doc with ESDD

The method is [docs/pdd.md](../../docs/pdd.md#reviewing-a-design-doc). This skill only runs it. It
reads one design doc into the IRs and hands back; the round (checks, question list, report, answers,
approval) belongs to [prd-review](../prd-review/SKILL.md).

## Started directly

When the operator gives only a design doc, find its PRD: the doc's link or relation to its parent
document, or the operator. Start prd-review on that PRD, passing the design doc's link as one the
operator gave, and stop: prd-review calls this skill back once for the doc, inside its round. A
design doc with no PRD runs through prd-review with the design doc as `source.spec`.

When prd-review calls this skill, skip this section and run the steps below.

## Inputs

prd-review passes these. Ask for any that are missing:

- the design doc, its edit time, and its comment threads, open and resolved
- the PRD (or PRD frame), the IRs of the round so far, and the question ids used so far
- the input mode of the round

## Steps

1. Record the design doc in `source.sources` with its edit time, in each IR that takes something from
   it, and note the time of its newest comment
   ([Versions](../../docs/pdd.md#versions-and-approval-freshness))
2. Sort each statement into spec or implementation detail
   ([What in a design doc is spec](../../docs/pdd.md#what-in-a-design-doc-is-spec)). Keep the
   statements you take, with their locations
3. Map each one to its IR place
   ([From constraints to IR places](../../docs/pdd.md#from-constraints-to-ir-places)). Write the
   observable consequence. The constraint is only the basis, never the outcome text. Keep the
   existing IR order
4. Read each thread by its content, not its resolved flag: a thread whose last comment says the
   change was made, and the body shows it, is settled; a thread about naming or internals is not a
   question; a change that landed in some layers only is a disagreement
   ([Comments](../../docs/pdd.md#comments-and-open-threads))
5. Raise questions for [gaps](../../docs/pdd.md#gaps-constraints-that-say-less-than-they-seem-to),
   [threads](../../docs/pdd.md#comments-and-open-threads) and
   [disagreements](../../docs/pdd.md#disagreements), including an assumption whose basis the design
   doc contradicts. Each question gets one proposal, a tier and who decides. Disagreements are always
   must-ask. Ids continue the round's list. A question with an IR place carries its `TBD` there. A
   question with no IR place goes in the report so it is not lost; the spec owner's also go in the
   PRD frame's `questions` when there is a frame, with their id and severity, and the implementation
   team's do not
6. Hand back to prd-review: the questions, the statements taken with their locations, how each
   thread was read, the design doc's version and the time of its newest comment

## Do not

- run the checks, write a report or collect answers yourself; the round does that once for the spec
- copy table layouts, column names or internal calls into the IR
- settle a disagreement yourself, or let code behavior into the IR without a delta and a reverse question
- write into the design doc (a comment or an edit) without the operator confirming the content
