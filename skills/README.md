# Skills

Agent skills that run parts of the ESDD method. Each directory is a portable agent skill: a
`SKILL.md` with `name` and `description` frontmatter, which an agent loads when a request matches
the description.

| Skill | Runs |
| --- | --- |
| [prd-review](prd-review/SKILL.md) | the review round for a spec: convert, check, one question list, the answers, re-review, freshness before approval ([docs/pipeline.md](../docs/pipeline.md#running-a-review-round)) |
| [pdd-review](pdd-review/SKILL.md) | reading a design doc into the UseCase IRs, and asking what it leaves open or contradicts, inside prd-review's round ([docs/pdd.md](../docs/pdd.md#reviewing-a-design-doc)) |
| [prd-author](prd-author/SKILL.md) | writing a PRD as a frame and IRs, checked while it is written and rendered ([docs/prd.md](../docs/prd.md#authoring-loop)) |
| [pdd-author](pdd-author/SKILL.md) | writing a design doc whose constraints carry their observable consequences ([docs/pdd.md](../docs/pdd.md#writing-a-design-doc)) |

How they fit together:

| | Review | Write |
| --- | --- | --- |
| PRD (the spec owner's) | **prd-review** owns the round: one question list, one answer ledger and one report for the spec | **prd-author** writes the PRD, then by default drafts the design doc with pdd-author and links it |
| Design doc (the implementation team's) | **pdd-review** reads one design doc into the IRs and hands its questions back to prd-review. Started on a design doc alone, it starts prd-review on the PRD and stops | **pdd-author** writes the design doc against the IRs, on its own or when prd-author calls it |

A PRD with no design doc runs prd-review alone. A PRD with design docs runs one prd-review round that
calls pdd-review once per design doc ([Finding the design docs](../docs/pdd.md#finding-the-design-docs)).

The skills are kept thin on purpose. The method lives in `docs/`, and the checks live in `src/`.
A skill says only when it applies, what to collect, which steps to take in which order, and which
commands to run, and it links each step to its section in the docs. A change to the method is made
once, in the docs. A project that ports a skill copies it into its own skill directory, adapts the
inputs (where its docs, threads and edit times are read from) and the trigger wording, and links
back to the method instead of copying it.
