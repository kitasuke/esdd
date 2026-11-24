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
   ├─ integration tests by a separate author (risky changes only) ── frozen, then made Green by the implementation
   └─ E2E tests, with locators from the bindings
          └─ waits for the implementation: measure locators, run against the generated UI
draft change → its CI runs the full suite
   └─ independent evaluation (a record, not a gate)
```

- **A separate test author runs alongside the implementer.** Another agent writes the
  integration tests and their fake without seeing the implementation: its inputs are the
  spec, the IR, the base code and what the backend actually does. Both start from the same
  base in separate working copies; the implementer does not read the author's tests and does
  not write integration tests for the author's scenarios. Decide whether to use an author as
  soon as the IR passes its checks, and start it then: none of its inputs comes from the
  implementer's steps, and it is the longest path of the run. Parts that wait for an answer
  are left out of its brief and added in a round after the answer. The brief names, for this
  change's pages (including the page the user goes back to), what a test must wait for before
  it acts or asserts: each test defect sent back to the author costs another round of
  freezing, checks and broken branches (in one trial, two rounds took about 25 minutes). It also
  says where to shim the fake and to keep one test on the fake's own shape
  ([No false greens](generation.md#no-false-greens)), and, when the change decides which of two
  values wins, which parameters the base fills in or normalizes when the page opens: the author
  does not see the implementation, so it cannot avoid an address the fill-ins rebuild by itself.
  It tells the author not to put tags in test names when the IR is not committed with the
  change. When the author is done, the implementer takes the author's commit as it is, freezes it, and fixes the implementation
  until the suite is Green without editing it. A scenario that stays Red is handled as in
  [acceptance-first](generation.md#acceptance-first): a different reading of the spec is a question; a
  test defect (it passes without checking the state its name claims, or its locator cannot
  tell two controls with the same name apart) goes back to the author, and the fixed suite is
  frozen again. Mark the freeze in the history so it can be checked, not just promised: the
  author's commits carry a fixed trailer (taking the commit as it is keeps the message), the
  frozen files are the files those commits added, and the freeze starts at the first of them.
  A check before the change opens fails when an author's commit touches anything but tests and
  fakes, or when a later commit without the trailer touches a frozen file. Files the change
  only edits are not frozen, since the implementer may have to fix existing fixtures. A
  re-freeze is another commit with the same trailer. If the step times show an author ran but
  no commit has the trailer, fail too — otherwise a forgotten trailer silently turns the check off
- **Use a separate author only for risky changes.** An author catches readings of the spec
  and assumptions the implementer got wrong (in trials, input made only of spaces, and a wrong
  premise about a transition), but adds about half an hour to a run. Use one when the change
  touches:
  - state that outlives the screen: a value the screen writes that decides what shows after
    leaving the page, reloading, going back, in another tab or at the next sign-in — writes to
    storage or cookies, and writes that fill in, normalize or replace the address before the
    user has chosen anything
  - a race: another action, another user or a poll changes the same value at the same time,
    and the order changes what the screen shows
  - money; an action the user cannot undo from the screen (delete, confirm, send — clearing a
    value that can be set again does not count); permissions (three or more axes the screen
    receives as different responses); or a write to state other users or screens read

  Decide it from one sentence, written from the spec and the base code, on what the change
  writes, where, and when it is read again — not from whether the IR has transitions or races
  (in two trials of the same spec, only how the IR was written decided whether an author ran).
  A page change one decision settles, copying the user's own choice into the address (going
  back returns to before the choice), and opening or closing a part of the screen are neither
  state that outlives the screen nor a race. Copying a similar dialog or flow on the same
  screen does not count on its own. The description names each item that applied, with the
  value written and when it is read again. Otherwise the implementer writes the tests,
  and two checks keep them honest:
  - **Every node is named by a test.** Each scenario and rule case is carried by some test's
    tag ([trace.md](trace.md#tags--put-usecase__node-in-the-test-name)), checked before the
    tests run as well as by the trace after. Breaking branches only tests the branches the
    implementer wrote; this check finds the cases nobody wrote (in one trial, "forget it on
    sign-out" was in the spec and in no test)
  - **Each added branch is broken once** and some test fails
    ([No false greens](generation.md#no-false-greens))
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
- **Run E2E against the change's own UI first; hand off only what cannot run.** A suite that
  needs the shared environment's backend but not its deployed UI runs locally: the change's UI,
  served from its working copy, pointed at the shared backend. That runs before merge, and a
  difference from the base shows as a failure of the change, not as drift against whatever is
  deployed. Bound the setup it needs (a saved sign-in that is still valid, a free port the
  shared backend accepts) to a couple of minutes, and do not ask a person to sign in for it: a
  healthy sign-in setup finishes well inside that, so waiting longer only waits on someone who
  was not asked. Tell the two kinds of failure apart by whether the test reached the changed
  screen: a failure after it got there is a real failure, fixed or reported, and is not sent
  anywhere else; a stop before it (a sign-in page, a rejected token, a port in use) means the
  suite could not run here. Only then hand it to CI, and let a separate agent or session
  dispatch it, wait for the result and write it into the change's verification section, while
  the run goes on. CI runs the deployed UI, so a suite that needs the change's own UI cannot run
  there before merge either: record it as a follow-up to run after the deploy, with the command.
  Suites that write shared data (create, link, delete) are not run against a shared environment
  at all, and stay pending
- **Run related checks locally; leave the full suite to the change's CI.** While fixing, run
  the type checker, the unit tests and the tests related to the change. Choose related tests by
  what the change renders: the tests of the pages that render a changed file, and the tests
  that open those pages by address, following changed routes and operations to their users;
  when a change cannot be traced, run the whole project and say why. A change to types only
  (the compiled code is the same as the base's) selects no tests. Selecting by imports
  misses components a test does not import, and selects nearly everything once a shared part
  changes (in one trial, about 750 tests against 9 files traced by page). The whole project and
  the production build run in the draft change's CI; a failure far from the change shows up
  there first and is fixed before the change leaves draft. The change's verification section
  says which checks ran where. A trial that opens no change has no CI, so it runs the full
  suite once, at the end of its last stage — not after each fix, and not when it stops to
  wait for answers
- **Break the address of each changed page.** Open every page the change touches once per URL
  parameter it reads, with a blank value, an unknown value and a malformed one, against the
  fakes. Fail on the error screen, an uncaught error, an API error in a response, or a blank
  sent into a variable the change touches; the fakes do not reject a blank the way the server
  does, so the sent value is the evidence. An unknown id or cursor passes, since only the server
  can judge it. A page that cannot be opened this way (it needs an id in its path) says why in
  the verification section
- **Order the local checks so the slow one runs once.** Run the tests the change added or
  changed first, until they are Green; then the related-checks suite once, with the
  screenshots taken from the same build. After a fix, rerun only the failed files and the
  fast checks, and the suite once more before the change opens; fix-and-rerun is sequential,
  always against the fixed version. A test that timed out with parallel workers against a
  development server is rerun on one worker before it counts as failed. A test the change did
  not add or touch that still fails is run once on the base first: if it fails there too, it
  is pre-existing, recorded as such and left to CI, which is cheaper than repeating it on the
  change. When the server the tests run against stops partway, only the tests that use it
  fail: restart it and rerun those tests once; if it stops again, record an environment
  failure with its log line and run nothing more against it (in one trial, repeating tests
  against a stopped server took about 50 minutes). A fix sent back to the author that changes
  only its test files — not the fake, the fixtures or the product code — after the suite
  passed on the previous version does not rerun the suite: rerun the changed files, the tag
  check, the fast checks, the changed tests' screenshots and the broken branches those tests
  name, and say in the verification section "suite passed at <commit>; since then only
  <files> changed". A changed fake reruns the suite
- **Run independent checks at the same time, as far as the machine has room.** The
  related-checks suite, the broken-branch runs and checks that each build their own copy of the
  base can run together, but only within the free cores: the core count minus the smaller of the
  one- and five-minute load averages. The five-minute figure keeps a spike from the run's own last
  check from forcing everything onto one worker; a sustained outside load raises both. Give each
  check a worker count that fits, and run what does not fit after the suite instead of beside it.
  Oversubscribing slows every check and makes servers miss their start-up timeouts (in one trial,
  a check and three working copies on a machine already at a load of 11.6 on 16 cores drove the
  load to 32). Write the plan and the figures it came from into the
  step times, so runs can be compared. The broken-branch runs share one throwaway working copy
  ([No false greens](generation.md#no-false-greens)), prepared in the background when the tests are
  started, so the check step only checks out the head
- **Don't wait idle for the author.** Between committing the implementation and receiving the
  author's suite, run what does not depend on that suite, fixing and committing what it finds:
  the fast checks (types, unit tests, lint, formatting, freshness of generated files), the
  review points other than tests, the list of E2E tests the change touches, preparing the
  broken-branch working copies, and, if the machine has room, the production build and
  screenshots of existing tests that end in a state the change made visible (none if no
  existing test reaches it; in one trial 113 tests that did not reach it took four minutes and
  competed with the author's runs). What depends on the author's suite waits until it is
  frozen: the related-checks suite, the broken branches and the tag check. In one trial the
  implementer spent 19 of the author's 24 minutes waiting
- **Write the description while the slow checks run.** Draft it during the related-checks suite
  and the broken-branch runs, and fill in only what their results decide afterwards (the
  verification table, whether manual testing is needed, the screenshots, the step times). A
  part belongs to the second group if a failing check that leads to a code fix would change
  it. After such a fix, check the parts that describe the code (what changed, what to look at,
  what it reaches) against the fixed diff. In one trial, a description started after the
  checks took one to six more minutes
- **An unanswered question holds the merge, not the writing.** A run that starts before
  every must-ask answer is in (a ticket whose owner answers later) writes the part a question
  touches on its proposed answer and tests it like the rest. The description lists, per
  question, the files and tests that change if the answer differs. The change stays a draft,
  and neither the approval nor the merge happens until the answers are in. Only what reverting
  cannot undo once merged — money, deleting data, widening permissions, sending anything
  outside — waits unwritten, and the description says so. Writing only the parts every answer
  leaves the same can drop the spec's main change: in one trial, three of the spec's four
  examples stayed unfixed and the fix meant redoing the change, while a wrong proposal costs
  only the files and tests already listed. When nothing can be written, no change opens
- **Hand mechanical work to a faster model.** Running checks and picking the table and the
  failing lines out of their output, taking screenshots, drafting the description from the
  run's facts: these go to a faster, cheaper agent that returns only the result. Judgment stays
  with the generator: the IR, the questions, the implementation, review fixes, whether a
  failing test is fixed, whether a screenshot shows a misreading
- **The independent evaluation is a record, not a gate.** The
  [merge-readiness report](generation.md#the-scaffold-is-a-candidate-implementation) starts once the draft
  change is open and takes its check results from that change's CI. Nothing waits for it:
  neither fixing CI nor ending the run. In a trial that opens no change, it starts when the
  implementer finishes
- **Ask a person for what only a person can give, at the start.** A step that will need
  something only a person can provide (a sign-in to the shared environment, a saved session
  that may have expired, access to a service) is checked when the run starts, not when the step
  comes. Found expired at the step, it cannot run in that run; asked at the start, the person
  fixes it while the other steps go on. The run never signs in or types credentials itself.
  Decisions the run will need from the person who started it (which follow-up tickets to file)
  are asked at the start too; asked at the end, that person has to watch the whole run
- **Say what was verified and what still needs a person.** The change's verification section
  lists only checks that ran in this run and left output (a check table, a failing mutation, a
  step's time), and names what did not run. It also says whether manual testing is needed,
  by rule: needed when behavior reaches a surface the tests do not drive (another device,
  hardware, a phone call), a must-ask question is unanswered, or a cross-product handoff has no
  end-to-end test; not needed for a state the test tooling can create (a second tab, an expired
  session), which gets a test instead. When unsure, needed: a wrong "not needed" skips the
  check. In one trial a change claimed a mutation check that never ran
- **Record each step's time.** Note the start and end of every step, one row per step
  including those that ran in parallel, and put a table of minutes in the change's
  description. Without it, a faster run cannot be told from a lucky one, and the slowest
  step is a guess. Steps that only a trial runs (the full suite of a trial that opens no change,
  the evaluation, sorting out their failures) are marked as trial steps and kept out of the time
  the user waits for the draft change. The description is written from the checks that ran
  before the draft and does not wait for trial steps; their results go in the trial's record, not
  in the description (in one trial, waiting for the full suite stretched writing a description
  from about one minute to seven)
- **Split a large ticket into parts.** When the work spans two or more pages, or regions of a
  page that do not read each other, and the IR's scenarios fall apart along the same line (no
  scenario of one part opens another part's screen), run the steps from the IR to the checks once
  per part, in order, with one IR per part. Write the parts, their order and dependencies down in
  the run's working directory, and stack the changes: a later part reads what an earlier part
  added and does not rewrite it. Say in one line why a ticket is not split. The time to the draft
  counts every part

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
  if it left must-ask questions waiting, a second stage where whoever runs the trial answers as
  the owner, from the person's first commit alone; a question that commit does not settle is
  answered "not decided there", with nothing more of the person's design
- **An evaluator that did not generate**, given the spec, the IR, the diffs and the questions
  but not the generator's conclusions, compares with the person's change: each feature, each
  fix the person made after their first commit (would the generated code have needed it too),
  the scope, and each must-ask question (was it the person's actual decision, was the
  proposal theirs, and did the fixes a different answer needed stay within the files and tests
  the description listed). A question that touches something the person changed after their first
  commit (in a later commit or change) cannot be scored from that commit: it counts as neither
  a hit nor a miss, and the evaluation says so

Measure a new rule on a ticket it was not written from: on its own ticket, its example is in
the rule's text.

Keep a rule's examples out of its text, so a trial can remove them. A rule cites its examples by
id ("(example: EX-12)"), and the examples live in a file beside the rules, each with its id, the
sources it came from (the ticket and the person's change), what it shows and what happened. Before
a blind trial, drop every example whose source is the trial's ticket or change, together with its
citations in the rule text; what is left cannot hand the generator the answer. A search of the
copied rules for the ticket's id and for words the person decided stays as a backstop, and
whatever it finds goes in the trial's report. Check the file mechanically: unique ids, a source on
each example, every citation pointing at an example, and no ticket id in the rule text outside
the examples.

A generator does not give the same answers twice. In one replay of past questions, rerunning
the same arm changed two of six answers. Treat a difference of two questions or fewer between
two variants as noise, and run each variant at least twice before comparing.

### A regression set

A later rule can quietly undo an earlier fix. Keep a few past trials with their base, the
person's first commit and their pass conditions fixed, and rerun them as ordinary blind trials
after every few rule changes and before the rules are used on a real run. The set shows only
that earlier passes still pass, not that a new rule works. It holds the answers, so it is
never copied into a trial. Its trials keep the examples taken from their own tickets: those
examples are part of the rules being checked.
