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

  it("is deterministic", () => {
    expect(renderPrd(frame(), ucs, [])).toBe(renderPrd(frame(), ucs, []));
  });
});
