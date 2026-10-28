import { describe, expect, it } from "vitest";
import { parseIR } from "./parse.ts";
import { checkPrd, checkProfile, DEFAULT_PROFILE, mergeProfile, parsePrd, renderPrd } from "./prd.ts";
import type { Model } from "./types.ts";

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`could not parse the IR: ${JSON.stringify(findings)}`);
  return model;
}

const IR = `
usecase: UC-TEST-001
name: Order
source: { spec: "https://example.com/spec", version: "v1" }
initial: A
states:
  - { id: A, label: waiting }
  - { id: B, label: done, terminal: true }
events:
  - { id: go, label: proceed, actor: operator }
  - { id: back, actor: customer }
  - { id: undo, actor: customer }
transitions:
  - from: A
    on: go
    to: B
    outcome: ['"Done" is shown']
  - from: A
    on: [back, undo]
    impossible: true
    reason: a waiting order cannot go back
scenarios:
  - { id: SC-001, name: proceed, path: [go], critical: true, given: [an order], when: [proceed], then: ['"Done" is shown', a mail is sent] }
`;

const FRAME = `
prd: PRD-TEST
title: Test feature
status: draft
summary: one line
problem: [it is slow]
users:
  - { id: operator, description: the person who proceeds }
goals:
  - { id: G1, statement: faster, metric: median time, target: TBD }
non_goals: []
usecases: [test.usecase.yaml]
sections:
  rollout: all at once
`;

function frame(source = FRAME) {
  const { frame, findings } = parsePrd(source);
  if (!frame) throw new Error(`could not parse the frame: ${JSON.stringify(findings)}`);
  return frame;
}

describe("parsePrd", () => {
  it("accepts a complete frame", () => {
    expect(parsePrd(FRAME).findings).toEqual([]);
  });

  it("requires a metric for every goal and an explicit non_goals", () => {
    const { frame, findings } = parsePrd(FRAME.replace(", metric: median time", "").replace("non_goals: []\n", ""));
    expect(frame).toBeUndefined();
    expect(findings.map((f) => f.message)).toEqual([
      "goals[0]: metric is required (write TBD if it is not decided yet)",
      "non_goals is required (write [] when nothing is left out on purpose)",
    ]);
  });
});

describe("checkPrd", () => {
  it("turns TBD markers into warns and flags actors the users list does not name", () => {
    const messages = checkPrd(frame(), [model(IR)]).map((f) => `${f.level} ${f.check} ${f.message}`);
    expect(messages).toEqual([
      "warn prd-pending goals[G1].target: an unanswered marker (TBD) remains. Ask the PRD owner",
      'warn prd-actors UC-TEST-001: the actor "customer" of event back is not among users. Say who it is',
      'warn prd-actors UC-TEST-001: the actor "customer" of event undo is not among users. Say who it is',
    ]);
  });

  it("keeps an unanswered question of the frame open", () => {
    const asked = frame(`${FRAME}questions:\n  - { question: "Who may cancel?", proposal: the operator }\n`);
    expect(checkPrd(asked, []).filter((f) => f.check === "prd-questions").map((f) => f.message)).toEqual([
      "an open question remains: Who may cancel?. Ask the PRD owner",
    ]);
    expect(parsePrd(`${FRAME}questions:\n  - { proposal: x }\n`).findings.map((f) => f.message)).toEqual(["questions[0]: question is required"]);
  });

  it("rejects the same usecase linked twice", () => {
    const m = model(IR);
    expect(checkPrd(frame(), [m, m]).filter((f) => f.level === "error").map((f) => f.check)).toEqual(["prd-usecases"]);
  });
});

describe("checkProfile", () => {
  it("warns about sections the profile requires but the frame lacks, and frame sections it does not place", () => {
    const profile = mergeProfile({ sections: [{ id: "summary", heading: "Summary" }, { id: "ui", heading: "UI", required: true }] });
    expect(checkProfile(frame(), profile).map((f) => f.message)).toEqual([
      "sections.rollout is not placed by the profile, so the rendered PRD leaves it out",
      "sections.ui (UI) is required by the profile but missing",
    ]);
  });
});

describe("renderPrd", () => {
  const ucs = [{ file: "test.usecase.yaml", model: model(IR) }];

  it("writes requirements from transitions and one line per impossible declaration", () => {
    const md = renderPrd(frame(), ucs, []);
    expect(md).toContain("- While waiting, when operator does “proceed”, the system shall move to done.\n  - \"Done\" is shown");
    expect(md).toContain("- While waiting, “back” / “undo” does not occur: a waiting order cannot go back.");
    expect(md).toContain("  - Then \"Done\" is shown\n  - And a mail is sent");
  });

  it("shows each open marker as the text to complete, under the heading the reader sees it in", () => {
    const md = renderPrd(frame(), ucs, checkPrd(frame(), [ucs[0]!.model]), DEFAULT_PROFILE);
    const open = md.slice(md.indexOf("## Open questions"));
    expect(open).toContain("- **Goals and metrics G1 Target**: TBD (faster)");
    expect(open).not.toContain("goals[G1].target");
    expect(open).toContain('- UC-TEST-001: the actor "customer" of event back is not among users');
  });

  it("puts the IR's open markers and its other findings in the open questions", () => {
    const pending = [{ file: "test.usecase.yaml", model: model(IR.replace("a mail is sent", "the mail subject is TBD")) }];
    const open = renderPrd(frame(), pending, []).split("## Open questions")[1]!;
    expect(open).toContain("- **Order: proceed**: the mail subject is TBD");
    expect(open).not.toContain("unanswered spec-question marker");
  });

  it("folds the sub-sections the profile names into <details> blocks", () => {
    const md = renderPrd(frame(), ucs, [], mergeProfile({ fold: ["not_applicable", "inputs"] }));
    expect(md).toContain("<details>\n<summary>Cases that do not occur</summary>");
    expect(md).toContain("a waiting order cannot go back");
    expect(md).not.toContain("#### Cases that do not occur");
    expect(md).toContain("#### Requirements");
  });

  it("rewrites ASSUMED(<id>) with the profile's wording", () => {
    const assumed = IR.replace("a waiting order cannot go back", "a waiting order cannot go back ASSUMED(W1)").replace(
      "scenarios:",
      "assumptions:\n  - { id: W1, question: can it go back?, proposal: no, basis: the spec says so }\nscenarios:",
    );
    const md = renderPrd(frame(), [{ file: "test.usecase.yaml", model: model(assumed) }], [], mergeProfile({ phrases: { assumed: " [W{id}]" } }));
    expect(md).toContain("a waiting order cannot go back [WW1].");
    expect(md).not.toContain("ASSUMED(");
  });

  it("lays out sections and phrases by the profile", () => {
    const profile = mergeProfile({
      sections: [{ id: "rollout", heading: "Rollout" }, { id: "use_cases", heading: "Behavior" }],
      phrases: { transition: "{state} → {to} on {event}" },
    });
    const md = renderPrd(frame(), ucs, [], profile);
    expect(md.match(/^## .*/gm)).toEqual(["## Rollout", "## Behavior"]);
    expect(md).toContain("all at once");
    expect(md).toContain("- waiting → done on proceed");
  });

  it("leaves out an optional free section the frame does not fill, and shows TBD for a required one", () => {
    const profile = mergeProfile({
      sections: [{ id: "notes", heading: "Notes" }, { id: "ui", heading: "UI", required: true }],
    });
    expect(renderPrd(frame(), ucs, [], profile)).toMatch(/\n## UI\n\nTBD\n$/);
  });

  it("follows a nested template: no title, heading-only groups, levels, and the usecase list", () => {
    const profile = mergeProfile({
      title: false,
      sections: [
        { heading: "Why", level: 1 },
        { id: "goals", heading: "Goals", level: 2 },
        { id: "use_case_list", heading: "Use cases", level: 1 },
        { id: "use_cases", heading: "Spec", level: 1 },
      ],
    });
    const md = renderPrd(frame(), ucs, [], profile);
    expect(md.match(/^#+ .*/gm)).toEqual([
      "# Why",
      "## Goals",
      "# Use cases",
      "# Spec",
      "## Order (UC-TEST-001)",
      "### Requirements",
      "### Cases that do not occur",
      "### Acceptance criteria",
    ]);
    expect(md).toContain("# Use cases\n\n- Order\n  - proceed\n");
  });

  it("keeps the heading of an empty section marked always", () => {
    const profile = mergeProfile({ sections: [{ id: "notes", heading: "Notes", always: true }, { id: "rollout", heading: "Rollout" }] });
    expect(renderPrd(frame(), ucs, [], profile)).toBe("# Test feature\n\n`PRD-TEST` · draft\n\n## Notes\n\n## Rollout\n\nall at once\n");
  });

  it("names actors by their label and words undeclared cells and races as questions with labels", () => {
    const labeled = frame(FRAME.replace("{ id: operator, description:", "{ id: operator, label: the clerk, description:"));
    const open = model(`
usecase: UC-TEST-002
name: Ticket
source: { spec: "https://example.com/spec" }
initial: OPEN
states:
  - { id: OPEN, label: open }
  - { id: OPEN_LATE, label: open late }
  - { id: CLOSED, label: closed, terminal: true }
  - { id: OPEN_LATE_ARCHIVED, label: archived, terminal: true }
events:
  - { id: close, label: close it, actor: operator }
  - { id: expire, label: let it expire, actor: system }
transitions:
  - { from: OPEN, on: close, to: CLOSED, outcome: ["closed is shown"] }
  - { from: OPEN, on: expire, to: OPEN_LATE, outcome: ["late is shown"] }
  - { from: OPEN_LATE, on: close, to: CLOSED, outcome: ["closed is shown"] }
scenarios:
  - { id: SC-001, name: close, path: [close] }
`);
    const md = renderPrd(labeled, [{ file: "t.usecase.yaml", model: open }], []);
    expect(md).toContain("- While open, when the clerk does “close it”, the system shall move to closed.");
    expect(md).toContain("- **Ticket**: While open late, what happens when system does “let it expire”?");
    expect(md).toContain(
      "- **Ticket**: While open, if the clerk does “close it” and system does “let it expire” at the same time, which one wins, and what does each side see?",
    );
    // the other findings keep the checker's words, with labels for ids
    expect(md).toContain("- **Ticket**: archived: cannot be reached from initial (open)");
    expect(md).not.toMatch(/\bOPEN_LATE\b/);
    // coverage is the author's to fill, not a question for the owner
    expect(md).not.toContain("not exercised by any scenario");
  });

  it("words a transition back to the same state as staying there", () => {
    const retry = model(`
usecase: UC-TEST-004
name: Retry
source: { spec: "https://example.com/spec" }
initial: FAILED
states:
  - { id: FAILED, label: failed }
  - { id: DONE, label: done, terminal: true }
events:
  - { id: retry_fails, label: retry and fail again, actor: operator }
  - { id: retry, label: retry, actor: operator }
transitions:
  - { from: FAILED, on: retry_fails, to: FAILED, outcome: ["an error is shown"] }
  - { from: FAILED, on: retry, to: DONE, outcome: ["done is shown"] }
scenarios:
  - { id: SC-001, name: retry, path: [retry_fails, retry] }
`);
    const md = renderPrd(frame(), [{ file: "t.usecase.yaml", model: retry }], []);
    expect(md).toContain("- While failed, when operator does “retry and fail again”, the system shall stay in failed.");
    expect(md).toContain("- While failed, when operator does “retry”, the system shall move to done.");
  });

  it("writes a transition declared from several states once, naming every state", () => {
    const abort = model(`
usecase: UC-TEST-005
name: Trip
source: { spec: "https://example.com/spec" }
initial: GOING
states:
  - { id: GOING, label: going }
  - { id: THERE, label: there }
  - { id: WAITING, label: waiting }
  - { id: DONE, label: done, terminal: true }
events:
  - { id: arrive, label: arrive, actor: operator }
  - { id: abort, label: abort, actor: operator }
  - { id: finish, label: finish, actor: operator }
transitions:
  - { from: GOING, on: arrive, to: THERE, outcome: ["there is shown"] }
  - { from: [GOING, THERE], on: abort, to: WAITING, outcome: ["waiting is shown"] }
  - { from: [THERE, WAITING], on: finish, to: DONE, outcome: ["done is shown"] }
  - { from: [THERE, WAITING], on: arrive, impossible: true, reason: "already there" }
  - { from: WAITING, on: abort, impossible: true, reason: "nothing to abort" }
scenarios:
  - { id: SC-001, name: abort, path: [abort, finish] }
`);
    const md = renderPrd(frame(), [{ file: "t.usecase.yaml", model: abort }], [], mergeProfile({ phrases: { impossible: "In {state}, 「{event}」 does not occur: {reason}." } }));
    expect(md.match(/the system shall move to waiting/g)).toHaveLength(1);
    expect(md).toContain("- While going / there, when operator does “abort”, the system shall move to waiting.");
    // events in one impossible declaration keep the quotes the profile's phrase uses
    expect(md).toContain("- In there / waiting, 「arrive」 does not occur: already there.");
  });

  it("shows only the lines that carry a marker of a long section, and the frame's open questions", () => {
    const f = frame(FRAME.replace("rollout: all at once", "ui: |\n    - a tab is added\n    - Figma: TBD\n    - the label is renamed") + "questions:\n  - { question: Who may cancel?, proposal: the operator }\n");
    const md = renderPrd(f, [{ file: "test.usecase.yaml", model: model(IR) }], checkPrd(f, [model(IR)]), mergeProfile({ sections: [{ id: "ui", heading: "UI" }, { id: "open_questions", heading: "Open questions" }] }));
    const open = md.slice(md.indexOf("## Open questions"));
    expect(open).toContain("- **UI**: Figma: TBD\n");
    expect(open).not.toContain("a tab is added");
    expect(open).toContain("- Who may cancel? (proposed: the operator)");
    expect(open.match(/Who may cancel\?/g)).toHaveLength(1);
  });

  it("asks once about races that share one event against the same actor", () => {
    const trip = model(`
usecase: UC-TEST-006
name: Trip
source: { spec: "https://example.com/spec" }
initial: GOING
states:
  - { id: GOING, label: going }
  - { id: THERE, label: there }
  - { id: DONE, label: done, terminal: true }
  - { id: CANCELED, label: canceled, terminal: true }
events:
  - { id: arrive, label: arrive, actor: driver }
  - { id: finish, label: finish, actor: driver }
  - { id: expire, label: expire, actor: system }
  - { id: cancel, label: cancel, actor: operator }
transitions:
  - { from: GOING, on: arrive, to: THERE, outcome: ["there is shown"] }
  - { from: THERE, on: finish, to: DONE, outcome: ["done is shown"] }
  - { from: GOING, on: expire, to: CANCELED, outcome: ["expired is shown"] }
  - { from: [GOING, THERE], on: cancel, to: CANCELED, outcome: ["canceled is shown"] }
  - { from: GOING, on: finish, impossible: true, reason: "not there yet" }
  - { from: THERE, on: [arrive, expire], impossible: true, reason: "already there" }
scenarios:
  - { id: SC-001, name: trip, path: [arrive, finish] }
`);
    const md = renderPrd(frame(), [{ file: "t.usecase.yaml", model: trip }], []);
    const open = md.slice(md.indexOf("## Open questions"));
    // cancel races arrive (going), finish (there) and expire (going): one question per other actor
    expect(open).toContain(
      "- **Trip**: While going / there, if operator does “cancel” and driver does “arrive” / “finish” at the same time, which one wins, and what does each side see?",
    );
    expect(open).toContain("- **Trip**: While going, if operator does “cancel” and system does “expire” at the same time");
    expect(open).toContain("- **Trip**: While going, if driver does “arrive” and system does “expire” at the same time");
    expect(open.match(/at the same time/g)).toHaveLength(3);
  });

  it("keeps a label with replacement patterns such as $& literal", () => {
    const open = model(`
usecase: UC-TEST-003
name: Fee
source: { spec: "https://example.com/spec" }
initial: OPEN
states:
  - { id: OPEN, label: "open ($& due)" }
  - { id: OPEN_LATE, label: "late ($1 fee)" }
  - { id: CLOSED, label: closed, terminal: true }
  - { id: VOID, label: "void ($& gone)", terminal: true }
events:
  - { id: close, label: close it, actor: operator }
  - { id: expire, label: let it expire, actor: system }
transitions:
  - { from: OPEN, on: close, to: CLOSED, outcome: ["closed is shown"] }
  - { from: OPEN, on: expire, to: OPEN_LATE, outcome: ["late is shown"] }
  - { from: OPEN_LATE, on: close, to: CLOSED, outcome: ["closed is shown"] }
scenarios:
  - { id: SC-001, name: close, path: [close] }
`);
    const md = renderPrd(frame(), [{ file: "t.usecase.yaml", model: open }], []);
    expect(md).toContain("- **Fee**: void ($& gone): cannot be reached from initial (open ($& due))");
  });

  it("is deterministic", () => {
    expect(renderPrd(frame(), ucs, [])).toBe(renderPrd(frame(), ucs, []));
  });
});
