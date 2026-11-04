# Skills

Agent skills that run parts of the ESDD method. Each directory is a portable agent skill: a
`SKILL.md` with `name` and `description` frontmatter, which an agent loads when a request matches
the description.

| Skill | Runs |
| --- | --- |
| [pdd-review](pdd-review/SKILL.md) | reading a design doc into the UseCase IRs, and asking what it leaves open or contradicts ([docs/pdd.md](../docs/pdd.md)) |
| [pdd-author](pdd-author/SKILL.md) | writing a design doc whose constraints carry their observable consequences ([docs/pdd.md](../docs/pdd.md#writing-a-design-doc)) |

The skills are kept thin on purpose. The method lives in `docs/`, and the checks live in `src/`.
A skill says only when it applies, what to collect, which steps to take in which order, and which
commands to run, and it links each step to its section in the docs. A change to the method is made
once, in the docs. A project that ports a skill copies it into its own skill directory, adapts the
inputs (where its docs, threads and edit times are read from) and the trigger wording, and links
back to the method instead of copying it.
