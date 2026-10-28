// The approval digest: the IR rendered as Markdown for the person who approves it.
// An approver shown only raw YAML and a hash approves without reading — a sentence split by a
// flow-sequence comma, or an assumption that contradicts the existing product, goes through
// unread. The digest lists the IR one item per line, so what is being approved (behavior,
// assumptions, coverage) can actually be read. It is deterministic, so diffing it against the
// previous approval's digest shows exactly what a re-approval changes (docs/approval.md).

import { inputConditions } from "./checks.ts";
import { config } from "./config.ts";
import { RACE_WINNER_FIRST, outcomeTexts } from "./text.ts";
import { type Model, type OutcomeItem, cellKey } from "./types.ts";

/** The digest's fixed words. A project whose approvers read another language overrides them (config.digest) */
export interface DigestLabels {
  none: string;
  spec: string;
  version: string;
  not_recorded: string;
  states: string;
  initial: string;
  terminal: string;
  undefined: string;
  ignored: string;
  impossible: string;
  no_reason: string;
  races: string;
  /** Placeholders: {a} {b} {winner} */
  race: string;
  winner_first: string;
  /** Placeholder: {winner} */
  winner: string;
  inputs: string;
  input_table: [string, string, string];
  not_applicable: string;
  not_covered: string;
  rules: string;
  scenarios: string;
  path: string;
  given: string;
  when: string;
  then: string;
  assumptions: string;
  assumptions_accepted: string;
  assumption_table: [string, string, string, string];
  no_assumptions: string;
}

export const DEFAULT_DIGEST_LABELS: DigestLabels = {
  none: "(none)",
  spec: "spec",
  version: "version",
  not_recorded: "(not recorded)",
  states: "States and transitions",
  initial: "initial",
  terminal: "terminal",
  undefined: "undefined",
  ignored: "ignored",
  impossible: "impossible",
  no_reason: "(no reason)",
  races: "Races",
  race: "when {a} and {b} overlap, {winner}",
  winner_first: "whichever arrives first wins",
  winner: "{winner} wins",
  inputs: "Input axes",
  input_table: ["Input", "Condition", "Covered by"],
  not_applicable: "not applicable",
  not_covered: "not covered",
  rules: "Rules",
  scenarios: "Scenarios",
  path: "path",
  given: "given",
  when: "when",
  then: "then",
  assumptions: "Assumptions",
  assumptions_accepted: "Assumptions (accepted by approving)",
  assumption_table: ["ID", "Question", "Applied answer", "Basis"],
  no_assumptions: "none",
};

const labels = (): DigestLabels => ({ ...DEFAULT_DIGEST_LABELS, ...config().digest });
const fill = (pattern: string, values: Record<string, string>) =>
  pattern.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

const asList = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** One value as one line. Never joins with a comma, so a reader cannot mistake it for a comma split */
function inline(v: unknown): string {
  if (v === null || v === undefined) return labels().none;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(inline).join(" / ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${inline(x)}`)
      .join(" / ");
  }
  return String(v);
}

/** A list value gets one line per item: a sentence that was split shows up as separate lines */
function items(v: unknown, indent: string): string[] {
  if (Array.isArray(v)) return v.map((x) => `${indent}- ${inline(x)}`);
  return [`${indent}- ${inline(v)}`];
}

function outcomeLines(outcome: OutcomeItem[] | undefined, indent: string): string[] {
  return (outcome ?? []).map((item) => {
    if (typeof item === "string") return `${indent}- ${item}`;
    const where = item.surface ? `[${item.surface}] ` : "";
    return `${indent}- ${where}${outcomeTexts([item]).filter(Boolean).join(" / ")}`;
  });
}

function stateMachine(model: Model): string[] {
  const l = labels();
  const out: string[] = [`## ${l.states}`, ""];
  for (const [id, state] of model.states) {
    const label = state.label ? ` (${state.label})` : "";
    const tag = id === model.initial ? ` — ${l.initial}` : state.terminal ? ` — ${l.terminal}` : "";
    out.push(`### ${id}${label}${tag}`, "");
    if (state.terminal) continue;
    for (const [on, ev] of model.events) {
      const cell = model.cells.get(cellKey(id, on))?.[0];
      const evLabel = `${on}${ev.label ? ` (${ev.label})` : ""} [${ev.actor}]`;
      if (!cell) {
        out.push(`- **${evLabel}**: ${l.undefined}`);
      } else if (cell.ignored) {
        out.push(`- ${evLabel}: ${l.ignored} — ${cell.reason ?? l.no_reason}`);
      } else if (cell.impossible) {
        out.push(`- ${evLabel}: ${l.impossible} — ${cell.reason ?? l.no_reason}`);
      } else {
        out.push(`- **${evLabel}** → ${cell.to}`, ...outcomeLines(cell.outcome, "  "));
      }
    }
    out.push("");
  }
  const races = model.ir.races ?? [];
  if (races.length > 0) {
    out.push(`## ${l.races}`, "");
    for (const r of races) {
      const winner = r.winner === RACE_WINNER_FIRST ? l.winner_first : fill(l.winner, { winner: r.winner });
      out.push(`- ${r.state}: ${fill(l.race, { a: r.between[0], b: r.between[1], winner })}`, ...outcomeLines(r.outcome, "  "));
    }
    out.push("");
  }
  return out;
}

function inputsSection(model: Model): string[] {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  // cell -> the rule cases and scenarios that cover it
  const coveredBy = new Map<string, string[]>();
  const add = (cell: string, by: string) => coveredBy.set(cell, [...(coveredBy.get(cell) ?? []), by]);
  for (const rule of model.ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const cell of asList(c.covers)) add(cell, `${rule.id}.cases[${i}]`);
    });
  }
  for (const sc of model.ir.scenarios ?? []) {
    for (const cell of asList(sc.covers)) add(cell, sc.id);
  }
  const conds = inputConditions(model);
  const l = labels();
  const out: string[] = [`## ${l.inputs}`, "", `| ${l.input_table.join(" | ")} |`, "| --- | --- | --- |"];
  for (const inp of inputs) {
    for (const cond of conds.get(inp.id) ?? []) {
      const na = inp.na?.[cond];
      const by = coveredBy.get(`${inp.id}×${cond}`);
      const how = na !== undefined ? `${l.not_applicable} — ${na}` : by ? by.join(" / ") : `**${l.not_covered}**`;
      out.push(`| ${inp.id} | ${cond} | ${how.replaceAll("|", "\\|")} |`);
    }
  }
  out.push("");
  return out;
}

function rulesSection(model: Model): string[] {
  const rules = model.ir.rules ?? [];
  if (rules.length === 0) return [];
  const out: string[] = [`## ${labels().rules}`, ""];
  for (const rule of rules) {
    out.push(`### ${rule.id} ${rule.name}`, "");
    rule.cases.forEach((c, i) => {
      out.push(`- cases[${i}] ${inline(c.input)}`, ...items(c.expected, "  "));
    });
    out.push("");
  }
  return out;
}

function scenariosSection(model: Model): string[] {
  const l = labels();
  const out: string[] = [`## ${l.scenarios}`, ""];
  for (const sc of model.ir.scenarios ?? []) {
    out.push(`### ${sc.id} ${sc.name}${sc.critical ? " (critical)" : ""}`, "");
    if (sc.path) out.push(`- ${l.path}: ${sc.path.join(" → ")}`);
    for (const [label, list] of [
      [l.given, sc.given],
      [l.when, sc.when],
      [l.then, sc.then],
    ] as const) {
      if (list && list.length > 0) out.push(`- ${label}`, ...items(list, "  "));
    }
    out.push("");
  }
  return out;
}

function assumptionsSection(model: Model): string[] {
  const list = Array.isArray(model.ir.assumptions) ? model.ir.assumptions : [];
  const l = labels();
  if (list.length === 0) return [`## ${l.assumptions}`, "", l.no_assumptions, ""];
  const cell = (s: unknown) => inline(s).replaceAll("|", "\\|");
  const out: string[] = [
    `## ${l.assumptions_accepted}`,
    "",
    `| ${l.assumption_table.join(" | ")} |`,
    "| --- | --- | --- | --- |",
  ];
  for (const a of list) {
    out.push(`| ${cell(a?.id)} | ${cell(a?.question)} | ${cell(a?.proposal)} | ${cell(a?.basis)} |`);
  }
  out.push("");
  return out;
}

/** Render an IR as the approval digest. Deterministic, so it can be diffed against the previous one */
export function renderDigest(model: Model): string {
  const { ir } = model;
  const out: string[] = [
    `# ${ir.usecase} ${ir.name}`,
    "",
    `- ${labels().spec}: ${ir.source.spec}`,
    `- ${labels().version}: ${ir.source.version ?? labels().not_recorded}`,
    "",
  ];
  if (model.hasStateMachine) out.push(...stateMachine(model));
  out.push(...inputsSection(model), ...rulesSection(model), ...scenariosSection(model), ...assumptionsSection(model));
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
