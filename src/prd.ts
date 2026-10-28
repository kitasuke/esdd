// The PRD frame and the PRD rendered from it (docs/prd.md).
// A UseCase IR carries the behavior of one usecase, but a PRD also says why the product is built:
// the problem, who it is for, the goals and how they are measured, and what is left out. The frame
// holds that part and links the IRs. The PRD document is rendered from frame + IRs, so the behavior a
// reader sees is exactly the behavior that was checked, and the open questions section is the
// checker's findings rather than a list someone remembered to keep.

import { parse as parseYaml } from "yaml";
import { checkRaceDeclarations, findPendingMarker, runChecks, undeclaredCells, undeclaredRaces } from "./checks.ts";
import { nonEmptyString, outcomeTexts, RACE_WINNER_FIRST } from "./text.ts";
import { type Finding, type Model, type OutcomeItem, cellKey } from "./types.ts";

const PRD_ID = /^PRD-[A-Z0-9-]+$/;
const STATUSES = ["draft", "in_review", "approved"] as const;

export interface PrdUser {
  id: string;
  /** The name the rendered PRD uses for this actor (the id when omitted) */
  label?: string;
  description: string;
}

export interface PrdGoal {
  id: string;
  statement: string;
  /** How the goal is measured. A goal without a metric cannot be judged after release */
  metric: string;
  target?: string;
}

export interface PrdFrame {
  prd: string;
  title: string;
  owner?: string;
  status: (typeof STATUSES)[number];
  summary: string;
  problem: string[];
  /** Who uses the product. The ids are the actors the IRs' events name */
  users: PrdUser[];
  goals: PrdGoal[];
  /** Required even when empty: an empty list is a decision, a missing key is an omission */
  non_goals: string[];
  /** IR files, relative to the frame file */
  usecases: string[];
  /** Free sections a profile places by id (rollout, UI, …). Markdown */
  sections?: Record<string, string>;
}

export interface ParsePrdResult {
  frame?: PrdFrame;
  findings: Finding[];
}

const asStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function parsePrd(source: string): ParsePrdResult {
  const findings: Finding[] = [];
  const err = (message: string) => findings.push({ level: "error", check: "prd-structure", message });
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    err(`cannot parse as YAML: ${(e as Error).message}`);
    return { findings };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    err("the top level must be an object");
    return { findings };
  }
  const f = raw as Record<string, unknown>;
  if (!nonEmptyString(f["prd"]) || !PRD_ID.test(f["prd"])) err("prd must be an ID starting with PRD- (e.g. PRD-ORDER-CANCEL)");
  for (const key of ["title", "summary"]) {
    if (!nonEmptyString(f[key])) err(`${key} is required`);
  }
  if (!STATUSES.includes(f["status"] as never)) err(`status must be one of ${STATUSES.join(" / ")}`);
  if (!asStrings(f["problem"]) || f["problem"].length === 0) err("problem must be a non-empty list of statements");
  if (!Array.isArray(f["users"]) || f["users"].length === 0) {
    err("users must list at least one user (id + description)");
  } else {
    f["users"].forEach((u, i) => {
      if (!nonEmptyString(u?.id) || !nonEmptyString(u?.description)) err(`users[${i}]: id and description are required`);
    });
  }
  if (!Array.isArray(f["goals"]) || f["goals"].length === 0) {
    err("goals must list at least one goal");
  } else {
    f["goals"].forEach((g, i) => {
      if (!nonEmptyString(g?.id) || !nonEmptyString(g?.statement)) err(`goals[${i}]: id and statement are required`);
      if (!nonEmptyString(g?.metric)) err(`goals[${i}]: metric is required (write TBD if it is not decided yet)`);
    });
  }
  if (!asStrings(f["non_goals"])) err("non_goals is required (write [] when nothing is left out on purpose)");
  if (!asStrings(f["usecases"]) || f["usecases"].length === 0) err("usecases must list at least one IR file");
  const sections = f["sections"];
  if (sections !== undefined && (typeof sections !== "object" || sections === null || Array.isArray(sections))) {
    err("sections must be a map of section id to Markdown");
  }
  if (findings.length > 0) return { findings };
  return { frame: raw as PrdFrame, findings };
}

/** A frame text that still carries an unanswered marker. section is the id a profile places it under */
export interface FramePending {
  at: string;
  section: string;
  /** For goals: the goal id and the field (1 = statement, 2 = metric, 3 = target — the goal_table column) */
  goal?: { id: string; statement: string; column: 1 | 2 | 3 };
  text: string;
  marker: string;
}

export function framePending(frame: PrdFrame): FramePending[] {
  const texts: Omit<FramePending, "marker">[] = [
    { at: "summary", section: "summary", text: frame.summary },
    ...frame.problem.map((text, i) => ({ at: `problem[${i}]`, section: "problem", text })),
    ...frame.goals.flatMap((g) =>
      (
        [
          ["statement", g.statement, 1],
          ["metric", g.metric, 2],
          ["target", g.target ?? "", 3],
        ] as const
      ).map(([field, text, column]) => ({ at: `goals[${g.id}].${field}`, section: "goals", goal: { id: g.id, statement: g.statement, column }, text })),
    ),
    ...Object.entries(frame.sections ?? {}).map(([k, v]) => ({ at: `sections.${k}`, section: k, text: String(v) })),
  ];
  return texts.flatMap((t) => {
    const marker = findPendingMarker(t.text);
    return marker ? [{ ...t, marker }] : [];
  });
}

/** Checks that need the frame and its IRs together */
export function checkPrd(frame: PrdFrame, models: Model[]): Finding[] {
  const findings: Finding[] = [];
  const warn = (check: string, message: string) => findings.push({ level: "warn", check, message });

  for (const { at, marker } of framePending(frame)) {
    warn("prd-pending", `${at}: an unanswered marker (${marker}) remains. Ask the PRD owner`);
  }

  const users = new Set(frame.users.map((u) => u.id));
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.ir.usecase)) {
      findings.push({ level: "error", check: "prd-usecases", message: `${model.ir.usecase} is linked twice` });
    }
    seen.add(model.ir.usecase);
    for (const ev of model.events.values()) {
      if (!users.has(ev.actor)) {
        warn("prd-actors", `${model.ir.usecase}: the actor "${ev.actor}" of event ${ev.id} is not among users. Say who it is`);
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Profile: the parts of a PRD that differ between companies — section order and headings, the
// sentence patterns requirements are written in, and labels. Everything else is the method.

export interface PrdProfile {
  /** false leaves out the title line and the id/status line (when the destination shows the title itself) */
  title: boolean;
  /**
   * Rendered in this order. Built-in ids: see BUILT_IN_SECTIONS. Any other id is read from frame.sections.
   * An entry without an id is a heading only, to group the sections under it. level is the Markdown
   * heading level (default 2); a usecase inside use_cases is one level below it
   * always renders the heading with an empty body when the frame leaves it empty (for a template that keeps every heading)
   */
  sections: { id?: string; heading: string; level?: number; required?: boolean; always?: boolean }[];
  /**
   * Sentence patterns (EARS style). Placeholders: {state} {event} {actor} {to} {a} {b} {winner} {reason}.
   * Outcomes are listed under the sentence, one per line
   */
  phrases: {
    transition: string;
    /** A transition back to the state it starts from: the outcomes happen, the state does not change */
    stay: string;
    ignored: string;
    impossible: string;
    race: string;
    race_first: string;
    /** An open question for an undeclared cell. Placeholders: {state} {event} {actor} */
    undeclared: string;
    /** An open question for an undeclared race. Placeholders: {state} {a} {a_actor} {b} {b_actor} */
    unraced: string;
    /** Replaces an ASSUMED(<id>) marker in IR texts. Placeholder: {id} */
    assumed: string;
  };
  labels: {
    requirements: string;
    not_applicable: string;
    races: string;
    rules: string;
    acceptance: string;
    inputs: string;
    assumed: string;
    open_questions_none: string;
    critical: string;
    given: string;
    when: string;
    then: string;
    and: string;
    goal_table: [string, string, string, string];
    rule_table: [string, string];
    input_table: [string, string, string];
    assumed_table: [string, string, string, string];
    source: string;
  };
}

export const BUILT_IN_SECTIONS = ["summary", "problem", "users", "goals", "non_goals", "use_case_list", "use_cases", "open_questions"] as const;

export const DEFAULT_PROFILE: PrdProfile = {
  title: true,
  sections: [
    { id: "summary", heading: "Summary" },
    { id: "problem", heading: "Problem" },
    { id: "users", heading: "Users" },
    { id: "goals", heading: "Goals and metrics" },
    { id: "non_goals", heading: "Non-goals" },
    { id: "use_cases", heading: "Use cases and requirements" },
    { id: "open_questions", heading: "Open questions" },
  ],
  phrases: {
    transition: "While {state}, when {actor} does “{event}”, the system shall move to {to}.",
    stay: "While {state}, when {actor} does “{event}”, the system shall stay in {state}.",
    ignored: "While {state}, when {actor} does “{event}”, the system shall change nothing ({reason}).",
    impossible: "While {state}, “{event}” does not occur: {reason}.",
    race: "While {state}, if “{a}” and “{b}” happen at the same time, “{winner}” wins.",
    race_first: "While {state}, if “{a}” and “{b}” happen at the same time, whichever arrives first wins.",
    undeclared: "While {state}, what happens when {actor} does “{event}”?",
    unraced:
      "While {state}, if {a_actor} does “{a}” and {b_actor} does “{b}” at the same time, which one wins, and what does each side see?",
    assumed: " (assumed: {id})",
  },
  labels: {
    requirements: "Requirements",
    not_applicable: "Cases that do not occur",
    races: "Simultaneous operations",
    rules: "Rules",
    acceptance: "Acceptance criteria",
    inputs: "Input conditions",
    assumed: "Assumed answers (final when the IRs are approved)",
    open_questions_none: "None. Every check passes and no answer is waiting for review.",
    critical: "critical",
    given: "Given",
    when: "When",
    then: "Then",
    and: "And",
    goal_table: ["ID", "Goal", "Metric", "Target"],
    rule_table: ["Input", "Expected"],
    input_table: ["Input", "Condition", "Handled by"],
    assumed_table: ["ID", "Question", "Applied answer", "Basis"],
    source: "Source",
  },
};

/** A profile file overrides the default per key; sections, when given, replace the whole list */
export function mergeProfile(override: unknown): PrdProfile {
  const o = (override ?? {}) as Partial<PrdProfile>;
  return {
    title: typeof o.title === "boolean" ? o.title : DEFAULT_PROFILE.title,
    sections: Array.isArray(o.sections) ? o.sections : DEFAULT_PROFILE.sections,
    phrases: { ...DEFAULT_PROFILE.phrases, ...(o.phrases ?? {}) },
    labels: { ...DEFAULT_PROFILE.labels, ...(o.labels ?? {}) },
  };
}

/** Sections the profile requires that the frame does not provide, and frame sections the profile does not place */
export function checkProfile(frame: PrdFrame, profile: PrdProfile): Finding[] {
  const placed = new Set(profile.sections.flatMap((s) => (s.id ? [s.id] : [])));
  const unplaced = Object.keys(frame.sections ?? {})
    .filter((id) => !placed.has(id))
    .map((id) => ({
      level: "warn" as const,
      check: "prd-sections",
      message: `sections.${id} is not placed by the profile, so the rendered PRD leaves it out`,
    }));
  return [...unplaced, ...profile.sections
    .flatMap((s) => (s.id && s.required && !(BUILT_IN_SECTIONS as readonly string[]).includes(s.id) ? [{ ...s, id: s.id }] : []))
    .filter((s) => !nonEmptyString(frame.sections?.[s.id]))
    .map((s) => ({
      level: "warn" as const,
      check: "prd-sections",
      message: `sections.${s.id} (${s.heading}) is required by the profile but missing`,
    }))];
}

// ---------------------------------------------------------------------------
// Rendering

export interface LinkedUseCase {
  /** As written in the frame */
  file: string;
  model: Model;
}

const fill = (pattern: string, values: Record<string, string>) =>
  pattern.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

const cell = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("|", "\\|").replaceAll("\n", " ");

const table = (head: string[], rows: string[][]) => [
  `| ${head.join(" | ")} |`,
  `| ${head.map(() => "---").join(" | ")} |`,
  ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
];

function outcomeLines(outcome: OutcomeItem[] | undefined): string[] {
  return (outcome ?? []).map((item) => {
    const where = typeof item !== "string" && item.surface ? `[${item.surface}] ` : "";
    return `  - ${where}${outcomeTexts([item]).filter(Boolean).join(" / ")}`;
  });
}

/** The names a reader sees: state and event labels, and the users' labels for actors */
function namer(model: Model, frame: PrdFrame) {
  const actors = new Map(frame.users.map((u) => [u.id, u.label ?? u.id]));
  return {
    state: (id: string) => model.states.get(id)?.label ?? id,
    event: (id: string) => model.events.get(id)?.label ?? id,
    actor: (id: string) => actors.get(id) ?? id,
  };
}

function useCaseSection(uc: LinkedUseCase, frame: PrdFrame, p: PrdProfile, level: number): string[] {
  const name = namer(uc.model, frame);
  const h = (below: number) => "#".repeat(level + below);
  const { model, file } = uc;
  const { ir } = model;
  const stateName = (id: string) => model.states.get(id)?.label ?? id;
  const eventName = (id: string) => model.events.get(id)?.label ?? id;
  const out: string[] = [`${h(1)} ${ir.name} (${ir.usecase})`, "", `${p.labels.source}: \`${file}\``, ""];

  if (model.hasStateMachine) {
    const reqs: string[] = [];
    // an impossible declaration with from/on arrays is one decision with one reason: render it once
    const na = new Map<number, { states: Set<string>; events: Set<string>; reason: string }>();
    for (const [sid, state] of model.states) {
      if (state.terminal) continue;
      for (const [eid, ev] of model.events) {
        const c = model.cells.get(cellKey(sid, eid))?.[0];
        if (!c) continue;
        const values = { state: stateName(sid), event: eventName(eid), actor: name.actor(ev.actor), to: c.to ? stateName(c.to) : "", reason: c.reason ?? "" };
        if (c.ignored) reqs.push(`- ${fill(p.phrases.ignored, values)}`);
        else if (c.impossible) {
          const d = na.get(c.entryIndex) ?? { states: new Set(), events: new Set(), reason: c.reason ?? "" };
          d.states.add(values.state);
          d.events.add(values.event);
          na.set(c.entryIndex, d);
        }
        else reqs.push(`- ${fill(c.to === sid ? p.phrases.stay : p.phrases.transition, values)}`, ...outcomeLines(c.outcome));
      }
    }
    out.push(`${h(2)} ${p.labels.requirements}`, "", ...reqs, "");
    if (na.size > 0) {
      out.push(`${h(2)} ${p.labels.not_applicable}`, "");
      for (const d of [...na.entries()].sort(([a], [b]) => a - b).map(([, v]) => v)) {
        const values = { state: [...d.states].join(" / "), event: [...d.events].join("” / “"), reason: d.reason };
        out.push(`- ${fill(p.phrases.impossible, values)}`);
      }
      out.push("");
    }
    const races = ir.races ?? [];
    if (races.length > 0) {
      out.push(`${h(2)} ${p.labels.races}`, "");
      for (const r of races) {
        const values = { state: stateName(r.state), a: eventName(r.between[0]), b: eventName(r.between[1]), winner: eventName(r.winner) };
        out.push(`- ${fill(r.winner === RACE_WINNER_FIRST ? p.phrases.race_first : p.phrases.race, values)}`, ...outcomeLines(r.outcome));
      }
      out.push("");
    }
  }

  const rules = ir.rules ?? [];
  if (rules.length > 0) {
    out.push(`${h(2)} ${p.labels.rules}`, "");
    for (const rule of rules) {
      out.push(`**${rule.name}** (${rule.id})`, "", ...table(p.labels.rule_table, rule.cases.map((c) => [cell(c.input), cell(c.expected)])), "");
    }
  }

  const inputs = ir.inputs ?? [];
  if (inputs.length > 0) {
    const by = new Map<string, string[]>();
    const add = (k: string, v: string) => by.set(k, [...(by.get(k) ?? []), v]);
    for (const rule of rules) for (const c of rule.cases) for (const k of [c.covers ?? []].flat()) add(k, rule.id);
    for (const sc of ir.scenarios) for (const k of [sc.covers ?? []].flat()) add(k, sc.id);
    const rows = [...by.entries()].map(([k, v]) => [...k.split("×"), v.join(", ")]);
    for (const inp of inputs) for (const [cond, reason] of Object.entries(inp.na ?? {})) rows.push([inp.id, cond, `n/a: ${reason}`]);
    out.push(`${h(2)} ${p.labels.inputs}`, "", ...table(p.labels.input_table, rows), "");
  }

  out.push(`${h(2)} ${p.labels.acceptance}`, "");
  for (const sc of ir.scenarios) {
    out.push(`- **${sc.name}** (${sc.id}${sc.critical ? `, ${p.labels.critical}` : ""})`);
    for (const [kw, list] of [[p.labels.given, sc.given], [p.labels.when, sc.when], [p.labels.then, sc.then]] as const) {
      (list ?? []).forEach((line, i) => out.push(`  - ${i === 0 ? kw : p.labels.and} ${line}`));
    }
  }
  out.push("");
  return out;
}

/** IR texts that still carry an unanswered marker, labeled by where they sit in the usecase */
function irPending(model: Model): { where: string; text: string }[] {
  const stateName = (id: string) => model.states.get(id)?.label ?? id;
  const eventName = (id: string) => model.events.get(id)?.label ?? id;
  const out: { where: string; text: string }[] = [];
  const add = (where: string, texts: string[]) => {
    for (const text of texts) if (findPendingMarker(text)) out.push({ where, text });
  };
  for (const list of model.cells.values()) {
    for (const c of list) add(`${stateName(c.from)} × ${eventName(c.on)}`, [...outcomeTexts(c.outcome), c.reason ?? ""]);
  }
  for (const r of model.ir.races ?? []) {
    add(`${stateName(r.state)}: ${eventName(r.between[0])} × ${eventName(r.between[1])}`, outcomeTexts(r.outcome));
  }
  for (const rule of model.ir.rules ?? []) {
    for (const c of rule.cases) add(`${rule.name}: ${cell(c.input)}`, typeof c.expected === "string" ? [c.expected] : []);
  }
  for (const sc of model.ir.scenarios) add(sc.name, sc.then ?? []);
  return out;
}

/**
 * The IR's findings as questions to the reader. Undeclared cells and races are worded with the
 * profile's phrases from the labels; the other findings keep the checker's words, with ids replaced
 * by labels. Pending markers are shown by irPending instead
 */
function irQuestions(model: Model, frame: PrdFrame, p: PrdProfile): string[] {
  const name = namer(model, frame);
  const cells = undeclaredCells(model).map(({ state, event }) =>
    fill(p.phrases.undeclared, { state: name.state(state), event: name.event(event), actor: name.actor(model.events.get(event)!.actor) }),
  );
  const races = undeclaredRaces(model).map(({ state, a, b }) =>
    fill(p.phrases.unraced, { state: name.state(state), a: name.event(a.id), a_actor: name.actor(a.actor), b: name.event(b.id), b_actor: name.actor(b.actor) }),
  );
  // ids are ASCII words; \b keeps NO_MATCH from matching inside MATCHING and the like
  const ids = [
    ...[...model.states.keys()].map((id) => [id, name.state(id)]),
    ...[...model.events.keys()].map((id) => [id, name.event(id)]),
    ...frame.users.map((u) => [u.id, name.actor(u.id)]),
  ].sort(([a], [b]) => b!.length - a!.length);
  // a function replacement keeps $& or $1 in a label literal
  const labeled = (text: string) => ids.reduce((t, [id, label]) => t.replace(new RegExp(`\\b${id}\\b`, "g"), () => label!), text);
  const others = [
    ...runChecks(model).filter((f) => !["pending", "exhaustiveness", "races"].includes(f.check)),
    ...checkRaceDeclarations(model),
  ].map((f) => labeled(f.message));
  return [...cells, ...races, ...others];
}

function openQuestions(frame: PrdFrame, ucs: LinkedUseCase[], frameFindings: Finding[], p: PrdProfile): string[] {
  // a marker is shown as the text the owner has to complete, under the heading the reader sees it in
  const heading = (id: string) => p.sections.find((s) => s.id === id)?.heading ?? id;
  const questions = [
    ...framePending(frame).map((f) => {
      const where = f.goal ? `${heading(f.section)} ${f.goal.id} ${p.labels.goal_table[f.goal.column]}` : heading(f.section);
      // a metric or target alone ("TBD") does not say which goal it belongs to
      const of = f.goal && f.goal.column !== 1 ? ` (${f.goal.statement})` : "";
      return `- **${where}**: ${f.text}${of}`;
    }),
    ...frameFindings.filter((f) => f.check !== "prd-pending").map((f) => `- ${f.message}`),
    ...ucs.flatMap((uc) => irPending(uc.model).map((x) => `- **${uc.model.ir.name}: ${x.where}**: ${x.text}`)),
    ...ucs.flatMap((uc) => irQuestions(uc.model, frame, p).map((q) => `- **${uc.model.ir.name}**: ${q}`)),
  ];
  const assumed = ucs.flatMap((uc) => (uc.model.ir.assumptions ?? []).map((a) => [a.id, a.question, a.proposal, a.basis]));
  if (questions.length === 0 && assumed.length === 0) return [p.labels.open_questions_none, ""];
  const out = [...questions, ""];
  if (assumed.length > 0) out.push(`**${p.labels.assumed}**`, "", ...table(p.labels.assumed_table, assumed), "");
  return out;
}

/**
 * Render the PRD. Deterministic: the same frame, IRs and profile give the same document, so a
 * re-render after an answer shows exactly what changed. frameFindings are the PRD-level findings
 * (checkPrd + checkProfile); IR findings are computed here so the document can never be rendered
 * with a stale question list
 */
export function renderPrd(frame: PrdFrame, ucs: LinkedUseCase[], frameFindings: Finding[], p: PrdProfile = DEFAULT_PROFILE): string {
  const out: string[] = p.title
    ? [`# ${frame.title}`, "", `\`${frame.prd}\` · ${frame.status}${frame.owner ? ` · ${frame.owner}` : ""}`, ""]
    : [];
  const builtIn = new Set<string>(BUILT_IN_SECTIONS);
  for (const s of p.sections) {
    const level = s.level ?? 2;
    // an optional free section the frame does not fill is left out; a required one shows TBD (checkProfile warns)
    if (s.id && !builtIn.has(s.id) && !s.required && !s.always && !nonEmptyString(frame.sections?.[s.id])) continue;
    out.push(`${"#".repeat(level)} ${s.heading}`, "");
    switch (s.id) {
      case undefined:
        break;
      case "summary":
        out.push(frame.summary, "");
        break;
      case "problem":
        out.push(...frame.problem.map((x) => `- ${x}`), "");
        break;
      case "users":
        out.push(...frame.users.map((u) => `- **${u.label ?? u.id}**: ${u.description}`), "");
        break;
      case "goals":
        out.push(...table(p.labels.goal_table, frame.goals.map((g) => [g.id, g.statement, g.metric, g.target ?? ""])), "");
        break;
      case "non_goals":
        out.push(...(frame.non_goals.length > 0 ? frame.non_goals.map((x) => `- ${x}`) : ["-"]), "");
        break;
      case "use_case_list":
        // one line per usecase, with its critical scenarios (all of them when none is marked) under it
        for (const { model } of ucs) {
          const critical = model.ir.scenarios.filter((sc) => sc.critical);
          out.push(`- ${model.ir.name}`, ...(critical.length > 0 ? critical : model.ir.scenarios).map((sc) => `  - ${sc.name}`));
        }
        out.push("");
        break;
      case "use_cases":
        for (const uc of ucs) out.push(...useCaseSection(uc, frame, p, level));
        break;
      case "open_questions":
        out.push(...openQuestions(frame, ucs, frameFindings, p));
        break;
      default:
        out.push(frame.sections?.[s.id] ?? (s.required ? "TBD" : ""), "");
    }
  }
  // ASSUMED(<id>) is for tracing an assumption in the IR; the reader sees the profile's wording
  const text = out.join("\n").replace(/\s*ASSUMED\(([^)]+)\)/g, (_, id: string) => fill(p.phrases.assumed, { id }));
  return `${text.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
