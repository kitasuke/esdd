# Generation principles — generating tests and implementation from the approved contract

The checker in this repository guards the quality of the contract (UseCase IR +
bindings). This document collects the principles for the **side that generates tests
and implementation** from that contract. It does not include a generator
implementation — only the principles and the structure learned from real use (2026,
first-shot Green demonstrated on several internal features).

## Acceptance-first

For a new feature, integration tests can be made to "work" with zero implementation:

1. **Review the bindings at the same time the IR is approved.** Labels, button copy,
   and error copy are fixed up front as contract (anything missing from the spec goes
   on the question list)
2. **Generate the semantic driver and the tests from the IR.** The test bodies carry
   no implementation vocabulary at all, and are landed in an initially Red state
3. **The implementer (human or generator) is done when these tests are Green.**
   An implementation that disagrees with the contract stays Red = the contract is
   enforced mechanically

Measured: 7 acceptance tests generated ahead of an unimplemented spec → implemented
toward the contract → **all Green with zero changes to the test bodies**. A
replication run — handing only the contract and the documentation to an agent in a
separate session — also reached first-shot Green (zero iterations) on both typecheck
and tests.

## Semantic driver (vocabulary isolation)

Generated tests never touch the screen directly; they go through a **driver** that is
mechanically derivable from the IR's input axes:

```ts
await form.set("email", "a@example.com");
await form.submit();
await form.expectSaved();
```

- The test body uses IR vocabulary only. Implementation vocabulary (real locators,
  widget-interaction quirks) is isolated into **a single adapter file**
- The impact of an implementation vocabulary change is confined to the adapter; the
  test body is invariant
- For new features (acceptance-first) the bindings constrain the implementation, so
  the adapter becomes an identity mapping

## Pattern registry (select → instantiate)

Components are not free-generated. Two stages: **select(pattern) →
instantiate(bindings vocabulary)**:

1. Choose a pattern from the **shape** of the IR's scenario / event / outcome (the
   registry's `selects_on` is the only basis for selection)
2. Read the pattern's **exemplar (a real file)** and follow its structure, error
   handling, and placement
3. Materialize the vocabulary from the bindings / IR literals (the no-invention rule)
4. When you meet a shape with no matching pattern, **extend the registry first**,
   then generate

The registry is a project-specific asset (not included in this repository). How to
build one: census the existing codebase and record the recurring archetypes as
"selection criteria + exemplar + structural notes". Where competing implementation
styles exist, write the winner down as a **ruling**, and explicitly mark patterns
with no real exemplar as "not registered" (to distinguish them from the unexamined).

The provenance audit that grounds this: every decision in a hand-written
implementation (~1,000 lines) could be classified into **A) contract-derived /
B) house-pattern-derived / C) free discretion (cosmetic)** — with zero left
unclassified. So the inputs needed for generation close over the contract (A) and
the registry (B), and C can follow the exemplar.

## Generation decision records

Record generation-level decisions as a **decision record**, written before the code:

```yaml
record: FE-GEN-<usecase-id>
source: { usecase: …, bindings: …, registry: … }
selections:            # which pattern was chosen for which shape (references only)
  - { target: "the save form of SC-001", pattern: mutation_form, exemplar: …, output: … }
file_plan: { new: […], modified: […] }
unprescribed:          # every decision no input prescribed (write [] explicitly if empty)
  - { decision: "placement of the warning", disposition: registry-addition } # or question-list / accepted
literal_sweep: { unmatched_rules: [] }
```

- Carries no re-description of behavior and no code fragments (decisions and
  references only)
- `unprescribed` dispositions: `registry-addition` (the machine answers next time) /
  `question-list` (a hole in the spec) / `accepted` (usable only for cosmetic free
  discretion)
- Purpose: turn "decisions nobody made" into a **reviewable artifact before
  generation**, not a self-report after it

## Handling Red

- **A generated test going Red against an existing implementation = detection of
  drift between spec and implementation.** A human adjudicates which side is right.
  Quietly fixing the test to Green destroys the detector
- Unit tests immediately after generation are expected Green (the function and the
  test come from the same case table). Red there means a generator bug
- Under co-generation (implementation and tests generated from the same contract)
  the two agree constructively, so the safety net moves to contract review
  (bindings + generation decision records). co-generation without contract review is
  self-consistently wrong
