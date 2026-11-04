// Folding answers into an IR (docs/pipeline.md "Keep an answer ledger"): the ledger is a YAML
// file, one entry per answered question, and --answers applies it to the IR text mechanically:
//   - an answer to a must-ask question replaces every `TBD(<id>: …)` / `TBD(<id>)` marker with the answer
//     (any unanswered-question marker counts: the defaults and the project's pendingMarkers)
//   - an answer to an assumption replaces every IR text that carries `ASSUMED(<id>)` with the answer
//     and removes the assumption's declaration (the owner replaced the proposal)
//   - an accepted assumption changes nothing (approving the IR names it, docs/approval.md)
// The YAML document is edited in place (comments and layout kept), so the diff shows exactly
// what the answers changed. Re-run the checks afterwards: an answer that adds a state or an
// event brings undeclared cells with it.

import { pendingMarkers } from "./text.ts";
import { isMap, isPair, isScalar, isSeq, parseDocument, visit, type Document, type Scalar } from "yaml";

export interface Answer {
  /** The question id the answer is for (Q4, W7 — any id the IR's markers use) */
  id: string;
  /** The answer: the text that replaces the marker (a must-ask) or the applied proposal (an assumption) */
  answer?: string | undefined;
  /** For an assumption: the proposal stands as applied */
  accepted?: boolean;
  by?: string | undefined;
  at?: string | undefined;
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
  /** each text the answer replaced, before and after, so a reader can see that the one answer fits every place */
  replaced: { at: string; before: string; after: string }[];
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
  const markers = pendingMarkers().map(escape).join("|");
  for (const a of ledger.answers) {
    const pending = new RegExp(`(?:${markers})\\(${escape(a.id)}(?::[^)]*)?\\)`, "g");
    const assumed = new RegExp(`\\s*ASSUMED\\(${escape(a.id)}\\)`);
    let places = 0;
    const replaced: Applied["replaced"] = [];
    visit(doc, {
      Scalar(_key, node: Scalar, path) {
        if (typeof node.value !== "string") return;
        const text = node.value;
        if (pending.test(text)) {
          pending.lastIndex = 0;
          if (a.answer !== undefined) {
            const after = text.replace(pending, a.answer).trim();
            node.value = after;
            replaced.push({ at: where(path, node), before: text, after });
          }
          places += 1;
          pending.lastIndex = 0;
          return;
        }
        if (assumed.test(text)) {
          if (a.answer !== undefined) {
            node.value = a.answer;
            replaced.push({ at: where(path, node), before: text, after: a.answer });
          }
          places += 1;
        }
      },
    });
    if (places === 0) {
      unmatched.push(a.id);
      continue;
    }
    if (a.accepted) {
      applied.push({ id: a.id, kind: "accepted", places, replaced });
      continue;
    }
    const removed = removeAssumption(doc, a.id);
    applied.push(
      removed
        ? { id: a.id, kind: "replaced_assumption", places, declaration_removed: true, replaced }
        : { id: a.id, kind: "replaced_pending", places, replaced },
    );
  }
  // no line wrapping, so a long answer stays on its line; flow collections and comment spacing are normalized by the library
  return { source: doc.toString({ lineWidth: 0 }), applied, unmatched };
}

/** Where a scalar sits, as the checker names places: transitions[0].outcome[1], rules[RULE-001].cases[0].expected */
function where(path: readonly unknown[], leaf: unknown): string {
  let out = "";
  for (let i = 0; i < path.length; i++) {
    const el = path[i];
    const next = i + 1 < path.length ? path[i + 1] : leaf;
    if (isPair(el) && isScalar(el.key)) {
      out += out ? `.${String(el.key.value)}` : String(el.key.value);
    } else if (isSeq(el)) {
      const index = el.items.indexOf(next);
      const id = isMap(next) ? next.get("id") : undefined;
      out += typeof id === "string" ? `[${id}]` : `[${index}]`;
    }
  }
  return out;
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

/**
 * One line per answer, for the CLI, and under a replaced assumption each place with the text it had:
 * one answer goes into every place that carried the marker, and those places may have said different
 * things (one "stops", another "resumes"), so the reader checks that the answer holds in each
 */
export function describeApplied(file: string, result: ApplyResult): string[] {
  const lines = result.applied.flatMap((a) => {
    const where = `${a.places} place${a.places === 1 ? "" : "s"}`;
    if (a.kind === "accepted") return [`  ${a.id}: accepted (kept; the approval names it) — ${where}`];
    if (a.kind === "replaced_pending") return [`  ${a.id}: marker replaced by the answer — ${where}`];
    const head = `  ${a.id}: proposal replaced by the answer — ${where}, declaration removed`;
    if (a.replaced.length < 2) return [head];
    return [`${head}; the same answer went into each — check it holds in every place:`, ...a.replaced.map((r) => `    ${r.at}: was "${r.before}"`)];
  });
  return [`${file}:`, ...(lines.length > 0 ? lines : ["  (no marker of the ledger's ids)"])];
}
