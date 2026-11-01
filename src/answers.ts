// Folding answers into an IR (docs/pipeline.md "Keep an answer ledger"): the ledger is a YAML
// file, one entry per answered question, and --answers applies it to the IR text mechanically:
//   - an answer to a must-ask question replaces every `TBD(<id>: …)` / `TBD(<id>)` marker with the answer
//   - an answer to an assumption replaces every IR text that carries `ASSUMED(<id>)` with the answer
//     and removes the assumption's declaration (the owner replaced the proposal)
//   - an accepted assumption changes nothing (approving the IR names it, docs/approval.md)
// The YAML document is edited in place (comments and layout kept), so the diff shows exactly
// what the answers changed. Re-run the checks afterwards: an answer that adds a state or an
// event brings undeclared cells with it.

import { isMap, isSeq, parseDocument, visit, type Document, type Scalar } from "yaml";

export interface Answer {
  /** The question id the answer is for (Q4, W7 — any id the IR's markers use) */
  id: string;
  /** The answer: the text that replaces the marker (a must-ask) or the applied proposal (an assumption) */
  answer?: string;
  /** For an assumption: the proposal stands as applied */
  accepted?: boolean;
  by?: string;
  at?: string;
}

export interface Ledger {
  answers: Answer[];
}

export interface Applied {
  id: string;
  /** what the answer did to this IR */
  kind: "replaced_pending" | "replaced_assumption" | "accepted";
  /** how many IR texts changed (or, for an accepted assumption, carry its marker) */
  places: number;
  /** the assumption's declaration was removed */
  declaration_removed?: boolean;
}

export interface ApplyResult {
  source: string;
  applied: Applied[];
  /** ledger ids no marker in this IR refers to */
  unmatched: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The ledger file: `answers:` list; each entry needs an id and either an answer or accepted: true */
export function parseLedger(source: string): { ledger?: Ledger; errors: string[] } {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = parseDocument(source, { strict: true }).toJS();
  } catch (e) {
    return { errors: [`ledger does not parse: ${(e as Error).message}`] };
  }
  const list = (data as { answers?: unknown } | null)?.answers;
  if (!Array.isArray(list)) return { errors: ["ledger: answers must be a list"] };
  const answers: Answer[] = [];
  const seen = new Set<string>();
  list.forEach((a: Partial<Answer> | null | undefined, i) => {
    const at = `answers[${i}]`;
    if (!a || typeof a.id !== "string" || a.id.length === 0) {
      errors.push(`${at}: id is required (the question id, e.g. Q4 or W7)`);
      return;
    }
    if (seen.has(a.id)) errors.push(`${at}: duplicate answer for ${a.id}`);
    seen.add(a.id);
    const hasAnswer = typeof a.answer === "string" && a.answer.trim().length > 0;
    if (!hasAnswer && a.accepted !== true) errors.push(`${at} (${a.id}): give an answer, or accepted: true for an assumption that stands`);
    if (hasAnswer && a.accepted === true) errors.push(`${at} (${a.id}): either an answer or accepted: true, not both`);
    answers.push({ id: a.id, answer: hasAnswer ? a.answer!.trim() : undefined, accepted: a.accepted === true, by: a.by, at: a.at });
  });
  return errors.length > 0 ? { errors } : { ledger: { answers }, errors };
}

/** Apply a ledger to one IR's YAML text. Pure: returns the new text and what changed */
export function applyAnswers(source: string, ledger: Ledger): ApplyResult {
  const doc: Document = parseDocument(source);
  const applied: Applied[] = [];
  const unmatched: string[] = [];
  for (const a of ledger.answers) {
    const pending = new RegExp(`TBD\\(${escape(a.id)}(?::[^)]*)?\\)`, "g");
    const assumed = new RegExp(`\\s*ASSUMED\\(${escape(a.id)}\\)`);
    let places = 0;
    visit(doc, {
      Scalar(_key, node: Scalar) {
        if (typeof node.value !== "string") return;
        const text = node.value;
        if (pending.test(text)) {
          pending.lastIndex = 0;
          if (a.answer !== undefined) node.value = text.replace(pending, a.answer).trim();
          places += 1;
          pending.lastIndex = 0;
          return;
        }
        if (assumed.test(text)) {
          if (a.answer !== undefined) node.value = a.answer;
          places += 1;
        }
      },
    });
    if (places === 0) {
      unmatched.push(a.id);
      continue;
    }
    if (a.accepted) {
      applied.push({ id: a.id, kind: "accepted", places });
      continue;
    }
    const removed = removeAssumption(doc, a.id);
    applied.push(removed ? { id: a.id, kind: "replaced_assumption", places, declaration_removed: true } : { id: a.id, kind: "replaced_pending", places });
  }
  // no line wrapping, so a long answer stays on its line; flow collections and comment spacing are normalized by the library
  return { source: doc.toString({ lineWidth: 0 }), applied, unmatched };
}

/** Drops the declaration of an assumption whose proposal was replaced; true when one was there */
function removeAssumption(doc: Document, id: string): boolean {
  const list = doc.get("assumptions", true);
  if (!isSeq(list)) return false;
  const index = list.items.findIndex((item) => isMap(item) && item.get("id") === id);
  if (index < 0) return false;
  list.items.splice(index, 1);
  if (list.items.length === 0) doc.delete("assumptions");
  return true;
}

/** One line per answer, for the CLI */
export function describeApplied(file: string, result: ApplyResult): string[] {
  const lines = result.applied.map((a) => {
    const where = `${a.places} place${a.places === 1 ? "" : "s"}`;
    if (a.kind === "accepted") return `  ${a.id}: accepted (kept; the approval names it) — ${where}`;
    if (a.kind === "replaced_assumption") return `  ${a.id}: proposal replaced by the answer — ${where}, declaration removed`;
    return `  ${a.id}: TBD replaced by the answer — ${where}`;
  });
  return [`${file}:`, ...(lines.length > 0 ? lines : ["  (no marker of the ledger's ids)"])];
}
