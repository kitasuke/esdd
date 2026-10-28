# Approved IRs — committing the approved spec

The pipeline has one human approval point (see [pipeline.md](pipeline.md)). This
document covers what happens to the IR at and after that point: where an approved IR
lives, what it records about its own approval, how it is checked, and how it changes
when the spec changes.

## Drafts vs approved IRs

| | Draft IR | Approved IR |
| --- | --- | --- |
| Produced by | every review round (spec → IR → checks → questions) | the human approval |
| Lives in | a scratch location outside version control | version control, one file per usecase |
| Open questions | allowed (`TBD` / `TODO` / `FIXME` / `UNRESOLVED` markers) | none |
| Used by downstream generation | only until an approved IR exists | always, once it exists |

Commit only approved IRs. Then **the file's git history is the history of approved
versions**: `git log -p <path>` shows every approved version and what changed between
them, with no separate archive. Drafts stay disposable.

## Layout

```
<usecases-dir>/<domain>/<usecase-id>.usecase.yaml
```

- The file name equals the usecase id. **Never rename a usecase id**: a rename or a
  split breaks `git log` as the history of that usecase. When a usecase must be split,
  create new ids, delete the old file, and record the mapping in the change
  description
- `<domain>` groups usecases the same way your test scenarios are grouped, so an IR
  and the tests generated from it can be found side by side

## The approval record

An approved IR carries the spec version and its approval in `source`, so that each
commit alone answers "which version of the spec, approved by whom, and when":

```yaml
source:
  spec: https://example.com/specs/order-cancel
  version: "2026-10-20T09:00:00Z" # the spec version that was approved
  approval:
    approved_by: <approver> # the spec owner; not the person who produced the IR
    approved_at: "2026-10-21"
    record: https://example.com/issues/123#comment-456 # where the approval itself lives
    assumptions_accepted: [W1, W4, W7] # the assumptions this approval accepts (if any)
```

Approval requires the same conditions as a passing review — no errors, no pending
markers (every must-ask question answered) — plus an explicit approval by the spec owner.
Assumptions may remain: approving the IR accepts them, and `assumptions_accepted` must name
exactly the assumptions the IR declares ([pipeline.md](pipeline.md#accept-by-default)).

## Checking an approved IR

```bash
node src/cli.ts <usecases-dir>/<domain>/<usecase-id>.usecase.yaml --approved
```

On top of the regular checks, `--approved`:

- requires `source.version` and `source.approval` (`approved_by`, `approved_at`,
  `record`), each a non-empty string; `approved_at` is a date or ISO 8601 timestamp,
  `record` an `https` URL
- requires the file name to equal `<usecase-id>.usecase.yaml`
- when the path contains a `usecases/` directory, requires exactly one `<domain>/` level under it
- turns `pending` findings (unanswered question markers) from warnings into errors
- requires `source.approval.assumptions_accepted` to list exactly the declared
  assumptions: one applied but not accepted, or accepted but not declared, is an error

Run it in CI over every approved IR, so a broken or half-answered IR cannot be merged.

## What the approver reads

Don't make approval possible from a hash alone. In trials, every defect in an approved IR
— a sentence split by a flow-sequence comma, assumptions that contradicted the existing
product, a screen the spec never mentioned — passed approval and was found later, and
each approval took about a minute. Ask for approval with:

1. **The digest**: `node src/cli.ts <ir.yaml> ... --digest` renders each IR as Markdown —
   states and transitions, every input cell with what covers it, rule cases and scenario
   steps one item per line, and the assumptions as a table. Keep it next to the hash
   (`digest-<hash>.md`)
2. **The diff from the last approval**: on re-approval, show `diff -u` against the
   previous approval's digest first, so the approver reads what changed rather than the
   whole IR again
3. **What to check**: three to five lines pointing at the assumptions and the cases that
   touch money, permissions or anything else that must not be wrong

Count an approval only if it was posted after the request it answers, and record how
long the approver took. Don't block a fast approval, but flag it: a fast approval
followed by a defect found downstream is the pattern to look for when reviewing runs.

## Sending an approval back

When a later step (test planning, test generation) finds a defect in an approved IR, do
not fix the frozen IR in place and carry on — that sends a version nobody approved
downstream. Void the approval (keep it, with the reason), fix the IR in review, and ask
for approval again with the diff from the voided version. Record how often this
happens and why; it measures how well the review catches problems before approval.

## Binding the approval to one exact IR

Tie the approval to a hash of the IR text, and have the approver name that hash (for
example by commenting `approve <hash>`). Two rules keep the hash meaningful:

- **Format before hashing.** If a formatter runs on commit, run it on the draft before
  taking the hash; otherwise the committed text differs from the approved text
- **Compare by parsed content when writing the approved file.** Adding the approval
  record is the only intended change. Diff the approved file against the frozen draft;
  if anything other than `source.version` and `source.approval` differs, parse both and
  compare the remaining content. Any real difference (a reordered list, a changed
  value) means you would be committing a version nobody approved — stop

Also record the spec's own version at approval time (e.g. its last-edited timestamp).
If the spec is edited after approval, the approval is void and review starts again.

## Partial approval

When some usecases of a spec are ready and others still wait on answers, approve the
ready ones on their own: hash only those IRs and record which were approved and which
were deferred (and why). The deferred ones get their own approval later. One slow
answer should not hold back a whole spec.

## Updating an approved IR

When a revised spec is approved again, regenerate and check the IR, then rewrite the
existing file **keeping its order**: existing entries in states, events, transitions,
scenarios and rules stay where they are, new entries go at the end of their list, and
only removed entries are deleted. Overwriting the file with a fresh conversion turns
unchanged parts into reordering noise, and the diff no longer shows what changed in
the spec. (This is the same stable-ID discipline as [pipeline.md](pipeline.md#editable-by-diff).)

## Downstream use

Once an approved IR exists for a usecase, test plans and test generation take it as
input as-is. Regenerating the IR from the spec at generation time would generate tests
from an unapproved conversion. When the spec changes, go back to review, not to
generation.

## Review and merge

Approved IRs look like documentation, and many repositories auto-approve and
auto-merge documentation changes. Make sure a person merges them — for example by
excluding the approved-IR directory from auto-merge — and that whoever merges checks
the diff against the approval record.
