# Runs — operating and measuring generation

[generation.md](generation.md) says what is generated from the approved contract. This document
covers how a generation run is operated: which of its steps wait for which, what runs where, and
how the generator itself is measured as its rules change.

## Running a generation — what waits for what

Once the IR is approved, most steps of a run need only the IR and the bindings, not each other.
Run those at the same time; only the parts that need the implementation wait for it:

```
approved IR + bindings
   ├─ implementation (product code, rule functions and their unit tests)
   ├─ integration tests by a separate author (optional) ── frozen, then made Green by the implementation
   └─ E2E tests, with locators from the bindings
          └─ waits for the implementation: measure locators, run against the generated UI
draft change → its CI runs the full suite
   └─ independent evaluation (a record, not a gate)
```

- **A separate test author runs alongside the implementer.** Another agent writes the
  integration tests and their fake without seeing the implementation: its inputs are the
  spec, the IR, the base code and what the backend actually does. Both start from the same
  base in separate working copies; the implementer does not read the author's tests and does
  not write integration tests for the author's scenarios. When the author is done, the
  implementer takes the author's commit as it is, freezes it, and fixes the implementation
  until the suite is Green without editing it. A scenario that stays Red is handled as in
  [acceptance-first](generation.md#acceptance-first): a different reading of the spec is a question; a
  test defect (it passes without checking the state its name claims, or its locator cannot
  tell two controls with the same name apart) goes back to the author, and the fixed suite is
  frozen again
- **Use a separate author only where co-generation would agree by construction.** The split
  roughly doubles the time and the steps of a run. Use it when the screen gets logic of its
  own (new client-side validation, or a state or branch the similar existing screen lacks),
  the IR has transitions, the screen receives three or more permission axes as different
  responses, or the backend is not available yet. Otherwise the implementer writes the
  integration tests too; a separate author would only re-check combinations the backend
  tests already check
- **E2E starts from the approved IR, not after the implementation.** The E2E generator takes
  the run's IR as it is (it does not convert the spec again) and writes the scenario files,
  helpers, test code and wiring up to the static checks, with locators from the bindings. It
  builds no scaffold: the implementation being generated takes the scaffold's place
  ([Tests before the implementation exists](generation.md#tests-before-the-implementation-exists)). Only
  two things wait for the implementation: measuring locators from the generated UI (a
  difference is absorbed in the adapter, [Semantic driver](generation.md#semantic-driver-vocabulary-isolation)),
  and running the suite against the generated UI, in a throwaway working copy of the
  implementer's head with the E2E commits applied. A run against a shared environment waits
  until the change is deployed there. The E2E tests go in a change of their own
- **Run related checks locally; leave the full suite to the change's CI.** While fixing, run
  the type checker, the unit tests and the tests related to the change. The whole project and
  the production build run in the draft change's CI; a failure far from the change shows up
  there first and is fixed before the change leaves draft. The change's verification section
  says which checks ran where. A trial that opens no change has no CI, so it runs the full
  suite once, at the end of its last stage — not after each fix, and not when it stops to
  wait for answers
- **The independent evaluation is a record, not a gate.** The
  [merge-readiness report](generation.md#the-scaffold-is-a-candidate-implementation) starts once the draft
  change is open and takes its check results from that change's CI. Nothing waits for it:
  neither fixing CI nor ending the run. In a trial that opens no change, it starts when the
  implementer finishes
- **Ask a person for what only a person can give, at the start.** A step that will need
  something only a person can provide (a sign-in to the shared environment, a saved session
  that may have expired, access to a service) is checked when the run starts, not when the step
  comes. Found expired at the step, it cannot run in that run; asked at the start, the person
  fixes it while the other steps go on. The run never signs in or types credentials itself
- **Record each step's time.** Note the start and end of every step, one row per step
  including those that ran in parallel, and put a table of minutes in the change's
  description. Without it, a faster run cannot be told from a lucky one, and the slowest
  step is a guess

## Measuring the generator

The rules here grow one trial at a time. Three practices keep that honest.

### Mark generated changes

Put a fixed line in the description of every change the generator opens, and a fixed trailer
on every commit it makes, including the CI fixes it pushes after opening. A commit after the
last marked one is a fix a person had to make, and the review comments are the feedback. Two
cheaper signals do not work: an AI tool's co-author trailer is also on the commits of people
who fix the change with the same tool, and the time the change opened is not where the
generator stopped. Collect per change: the review comments, the commits added after the
generator, the lead time (with the start written in the description, since the working files
that would date it are not committed), the result of the last head's CI, and the step times.

### Blind trials against a human implementation

Take a ticket a person already implemented and let the generator do it again without access
to the answer:

- **The spec is what the person could read when they started**: the title, the body, and the
  comments people wrote before the first change opened, oldest first, each with the writer's
  role and time. Leave out what bots and agents wrote and anything written later. A comment
  edited after the change opened is passed as it is now only if the edit came before the
  person's first commit; after that, pass the text from before the edit if a history has it,
  and leave the comment out if not. Record each such comment and what was done with it
- **The answer is out of reach**: a repository with only the base commit, no fetching, and no
  reading of other trials' notes. A refused command is reported, not worked around
- **Two stages.** First with no one to answer, as a real run without the owner would go. Only
  if it stopped on must-ask questions, a second stage where whoever runs the trial answers as
  the owner, from the person's first commit alone; a question that commit does not settle is
  answered "not decided there", with nothing more of the person's design
- **An evaluator that did not generate**, given the spec, the IR, the diffs and the questions
  but not the generator's conclusions, compares with the person's change: each feature, each
  fix the person made after their first commit (would the generated code have needed it too),
  the scope, and each stopped question (was it the person's actual decision, and was the
  proposal theirs). A question that touches something the person changed after their first
  commit (in a later commit or change) cannot be scored from that commit: it counts as neither
  a hit nor a miss, and the evaluation says so

Measure a new rule on a ticket it was not written from: on its own ticket, its example is in
the rule's text.

A generator does not give the same answers twice. In one replay of past questions, rerunning
the same arm changed two of six answers. Treat a difference of two questions or fewer between
two variants as noise, and run each variant at least twice before comparing.

### A regression set

A later rule can quietly undo an earlier fix. Keep a few past trials with their base, the
person's first commit and their pass conditions fixed, and rerun them as ordinary blind trials
after every few rule changes and before the rules are used on a real run. The set shows only
that earlier passes still pass, not that a new rule works. It holds the answers, so it is
never copied into a trial.
