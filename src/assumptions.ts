// Assumptions: proposed answers applied to the IR by default (docs/pipeline.md "Accept by
// default"). The IR stays complete and checkable while questions are open; a person reviews
// the assumptions as a list instead of answering each question, and the approval accepts them
// explicitly (approval.ts).
//
// Declared in a top-level `assumptions:` list; every IR text that came from one carries an
// `ASSUMED(<id>)` marker so it can be traced back and replaced when someone disagrees.

import type { Finding, Model, OutcomeItem } from "./types.ts";

const MARKER = /ASSUMED\(([^)\s]+)\)/g;

function outcomeTexts(outcome: OutcomeItem[] | undefined): string[] {
  return (outcome ?? []).flatMap((item) =>
    typeof item === "string" ? [item] : [item.ui ?? "", item.observation ?? ""],
  );
}

/** Every text an assumption marker may appear in, with where it sits (for messages) */
function textsOf(model: Model): { at: string; text: string }[] {
  const out: { at: string; text: string }[] = [];
  const add = (at: string, texts: (string | undefined)[]) => {
    for (const text of texts) if (typeof text === "string" && text) out.push({ at, text });
  };
  (model.ir.transitions ?? []).forEach((t, i) => add(`transitions[${i}]`, [...outcomeTexts(t.outcome), t.reason]));
  (model.ir.races ?? []).forEach((r, i) => add(`races[${i}]`, outcomeTexts(r.outcome)));
  (model.ir.rules ?? []).forEach((rule) =>
    rule.cases.forEach((c, i) =>
      add(`rules[${rule.id}].cases[${i}]`, [typeof c.expected === "string" ? c.expected : undefined]),
    ),
  );
  (model.ir.scenarios ?? []).forEach((sc) =>
    add(`scenarios[${sc.id}]`, [...(sc.given ?? []), ...(sc.when ?? []), ...(sc.then ?? [])]),
  );
  (model.ir.inputs ?? []).forEach((inp) => add(`inputs[${inp.id}].na`, Object.values(inp.na ?? {})));
  return out;
}

/** The ids of all assumptions referenced by an `ASSUMED(<id>)` marker, with where they appear */
export function referencedAssumptions(model: Model): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const { at, text } of textsOf(model)) {
    for (const m of text.matchAll(MARKER)) {
      const id = m[1]!;
      refs.set(id, [...(refs.get(id) ?? []), at]);
    }
  }
  return refs;
}

export function declaredAssumptionIds(model: Model): string[] {
  return (model.ir.assumptions ?? []).map((a) => a?.id).filter((id): id is string => typeof id === "string");
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** assumptions: each declared assumption is well formed and used; every marker points at one */
export function checkAssumptions(model: Model): Finding[] {
  const findings: Finding[] = [];
  const push = (level: "error" | "warn", message: string) => findings.push({ level, check: "assumptions", message });
  const list = model.ir.assumptions;
  if (list !== undefined && !Array.isArray(list)) {
    push("error", "assumptions must be a list");
    return findings;
  }
  const seen = new Set<string>();
  (list ?? []).forEach((a, i) => {
    const at = `assumptions[${i}]`;
    if (!nonEmptyString(a?.id)) {
      push("error", `${at}: id is required (use the question id, e.g. W4)`);
      return;
    }
    if (seen.has(a.id)) push("error", `${at}: duplicate assumption id: ${a.id}`);
    seen.add(a.id);
    for (const key of ["question", "proposal", "basis"] as const) {
      if (!nonEmptyString(a[key])) {
        push("error", `${at} (${a.id}): ${key} is required — an assumption with no ${key} cannot be reviewed`);
      }
    }
  });
  const refs = referencedAssumptions(model);
  for (const [id, places] of refs) {
    if (!seen.has(id)) push("error", `${places[0]}: ASSUMED(${id}) refers to an assumption that is not declared in assumptions`);
  }
  for (const id of seen) {
    if (!refs.has(id)) {
      push("warn", `assumptions (${id}): declared but no IR text carries ASSUMED(${id}) — apply it or remove it`);
    }
  }
  return findings;
}
