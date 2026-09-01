// Parsing and checking of ESDD bindings (the locator/literal contract).
// Format specification: docs/bindings.md
//
// bindings is "the single source that both the generated component and the
// generated tests read" (docs/generation.md). co-generation is self-consistent
// (a wrong binding produces a wrong implementation and a wrong test at the same
// time, and the two agree and pass), so this check is the machine half of the
// contract-review safety net.

import { parse as parseYaml } from "yaml";
import type { Finding, Model } from "./types.ts";

/** How to address an element. Has exactly one addressing form (locator priority order) */
export interface ElementBinding {
  role?: string;
  name?: string;
  label?: string;
  testid?: string;
  /** Visible text — the last resort */
  text?: string;
  /** Optional note (not checked) */
  note?: string;
}

export interface EventBinding {
  operation?: string;
  kind?: "mutation" | "query";
  called_api?: string;
}

/** Literal stance per rule id. The value type of literal_coverage */
export type LiteralCoverageEntry =
  | { literal: string; ui_text?: undefined; reason?: string }
  | { ui_text: "none"; literal?: undefined; reason?: string };

export interface BindingsDoc {
  bindings: string;
  platform: string;
  graph?: string;
  events?: Record<string, EventBinding>;
  elements: Record<string, ElementBinding>;
  literals?: Record<string, string>;
  literal_coverage?: Record<string, LiteralCoverageEntry>;
}

// platform profiles are an extension point — v0.1 ships only web (Playwright/ARIA)
const PLATFORMS = new Set(["web"]);

// Allowed set of ARIA roles used in real UIs. Grow it in sync with your project's role table.
// A role missing here is either a typo or an unregistered role — fix that first, either way.
const ALLOWED_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menuitem",
  "dialog",
  "heading",
  "tab",
  "tabpanel",
  "row",
  "rowheader",
  "gridcell",
  "columnheader",
  "table",
  "grid",
  "list",
  "listitem",
  "spinbutton",
  "switch",
  "group",
  "region",
  "alert",
  "alertdialog",
  "slider",
  "status",
]);

const ELEMENT_KEYS_BY_PLATFORM: Record<string, Set<string>> = {
  web: new Set(["role", "name", "label", "testid", "text", "note"]),
};
const CALLED_API_PATTERN = /^called[A-Z][A-Za-z0-9]*(Query|Mutation)$/;
const PENDING_MARKERS = ["TBD", "TODO", "FIXME", "UNRESOLVED"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function findPendingMarker(text: string): string | undefined {
  return PENDING_MARKERS.find((m) => text.includes(m));
}

/** Shape the YAML into a BindingsDoc. Structural errors accumulate as findings; the doc is returned best-effort */
export function parseBindings(source: string): {
  doc: BindingsDoc | undefined;
  findings: Finding[];
} {
  const findings: Finding[] = [];
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    return {
      doc: undefined,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: `cannot parse YAML: ${(e as Error).message}`,
        },
      ],
    };
  }
  if (!isRecord(raw)) {
    return {
      doc: undefined,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: "the top level must be a map",
        },
      ],
    };
  }
  for (const key of ["bindings", "platform", "elements"]) {
    if (!(key in raw)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `required key ${key} is missing`,
      });
    }
  }
  if (findings.some((f) => f.level === "error")) {
    return { doc: undefined, findings };
  }
  const doc = raw as unknown as BindingsDoc;
  if (typeof doc.bindings !== "string" || doc.bindings === "") {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "bindings must be a string holding the target usecase id",
    });
  }
  if (!PLATFORMS.has(doc.platform)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: `platform must be one of ${[...PLATFORMS].join(" | ")}: ${String(doc.platform)}`,
    });
  }
  if (doc.platform === "web" && !doc.graph) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "graph is required when platform: web",
    });
  }
  if (!isRecord(doc.elements)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "elements must be a map",
    });
    return { doc: undefined, findings };
  }
  return { doc, findings };
}

/** Addressing-form check for element entries (allowed forms differ per platform) */
function checkElements(doc: BindingsDoc, findings: Finding[]): void {
  const allowedKeys =
    ELEMENT_KEYS_BY_PLATFORM[doc.platform] ?? ELEMENT_KEYS_BY_PLATFORM["web"]!;
  const formKeys = [...allowedKeys].filter((k) => k !== "note" && k !== "name");
  const seenIdentity = new Map<string, string>();
  for (const [id, entry] of Object.entries(doc.elements)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: must be a map`,
      });
      continue;
    }
    const unknown = Object.keys(entry).filter((k) => !allowedKeys.has(k));
    if (unknown.length > 0) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: unknown keys ${unknown.join(", ")} (allowed for platform ${doc.platform}: ${[...allowedKeys].join(", ")})`,
      });
    }
    const e = entry as ElementBinding;
    const forms = formKeys.filter(
      (k) => (entry as Record<string, unknown>)[k] !== undefined,
    );
    if (forms.length !== 1) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: exactly one addressing form (${formKeys.join("/")}) is required (currently: ${forms.length === 0 ? "none" : forms.join("+")})`,
      });
      continue;
    }
    if (e.name !== undefined && e.role === undefined) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: name can only be used together with role`,
      });
    }
    if (e.role !== undefined) {
      if (!ALLOWED_ROLES.has(e.role)) {
        findings.push({
          level: "error",
          check: "bindings-schema",
          message: `elements.${id}: unknown role ${e.role} (check the allowed role set in src/bindings.ts)`,
        });
      }
      if (e.name === undefined) {
        findings.push({
          level: "warn",
          check: "bindings-schema",
          message: `elements.${id}: role has no name (unnamed roles are fragile under strict mode)`,
        });
      }
    }
    if (e.testid !== undefined && !/^[a-z][a-z0-9-]*$/.test(e.testid)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: testid must be static kebab-case: ${e.testid}`,
      });
    }
    // Duplicate accessible identity = a strict mode violation waiting to happen
    const formKey = forms[0]!;
    const identity =
      formKey === "role"
        ? `role:${e.role}:${e.name ?? ""}`
        : `${formKey}:${String((entry as Record<string, unknown>)[formKey])}`;
    const prev = seenIdentity.get(identity);
    if (prev !== undefined) {
      findings.push({
        level: "warn",
        check: "bindings-unique",
        message: `elements.${id} and elements.${prev} share the same addressing (${identity}) — a strict mode violation waiting to happen`,
      });
    } else {
      seenIdentity.set(identity, id);
    }
  }
}

/** Naming check for events' operation / called_api (fake-client naming pattern) */
function checkEvents(doc: BindingsDoc, findings: Finding[]): void {
  if (!doc.events) return;
  if (!isRecord(doc.events)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "events must be a map",
    });
    return;
  }
  for (const [id, entry] of Object.entries(doc.events)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `events.${id}: must be a map`,
      });
      continue;
    }
    const e = entry as unknown as EventBinding;
    if (typeof e.operation !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(e.operation)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: operation must be a PascalCase operation name: ${String(e.operation)}`,
      });
      continue;
    }
    if (e.kind !== "mutation" && e.kind !== "query") {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: kind must be mutation | query: ${String(e.kind)}`,
      });
      continue;
    }
    if (typeof e.called_api !== "string" || !CALLED_API_PATTERN.test(e.called_api)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api must follow the called<Operation><Query|Mutation> form: ${String(e.called_api)}`,
      });
      continue;
    }
    const expected = `called${e.operation}${e.kind === "mutation" ? "Mutation" : "Query"}`;
    if (e.called_api !== expected) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api should be ${expected} (mechanically derived from operation/kind): ${e.called_api}`,
      });
    }
  }
}

/** Pending-marker check for literals */
function checkLiterals(doc: BindingsDoc, findings: Finding[]): void {
  if (!doc.literals) return;
  if (!isRecord(doc.literals)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literals must be a map (key → text)",
    });
    return;
  }
  for (const [key, value] of Object.entries(doc.literals)) {
    if (typeof value !== "string") {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `literals.${key}: must be a string`,
      });
      continue;
    }
    const m = findPendingMarker(value);
    if (m) {
      findings.push({
        level: "warn",
        check: "pending",
        message: `literals.${key}: a "${m}" marker remains (resolve before approval)`,
      });
    }
  }
}

/**
 * Full-population check of literal_coverage (cross-check against the IR).
 * Universe = all rule ids in the IR (machine-known). Closure = the human stance
 * (a literal | ui_text: none | literal: TBD). Same philosophy as states×events exhaustiveness.
 */
function checkLiteralCoverage(
  doc: BindingsDoc,
  model: Model,
  findings: Finding[],
): void {
  const ruleIds = new Set((model.ir.rules ?? []).map((r) => r.id));
  const coverage = doc.literal_coverage ?? {};
  if (ruleIds.size === 0) return;
  for (const id of ruleIds) {
    if (!(id in coverage)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `rule ${id} has no literal stance (literal: <key> | literal: TBD | ui_text: none)`,
      });
    }
  }
  for (const [id, entry] of Object.entries(coverage)) {
    if (!ruleIds.has(id)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: rule id does not exist in the IR (a typo, or the rule was removed from the IR)`,
      });
      continue;
    }
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: must be a map`,
      });
      continue;
    }
    const hasLiteral = typeof entry.literal === "string";
    const isNone = entry.ui_text === "none";
    if (hasLiteral === isNone) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: write exactly one of literal: <key> or ui_text: none`,
      });
      continue;
    }
    if (hasLiteral) {
      const key = entry.literal as string;
      if (key === "TBD") {
        findings.push({
          level: "warn",
          check: "pending",
          message: `literal_coverage.${id}: literal undecided (TBD) — resolve via the question list`,
        });
      } else if (!(doc.literals && key in doc.literals)) {
        findings.push({
          level: "error",
          check: "literal-coverage",
          message: `literal_coverage.${id}: literals.${key} does not exist`,
        });
      }
    }
  }
}

export interface BindingsCheckOptions {
  /** The IR model to cross-check against (when omitted, only standalone bindings checks run) */
  model?: Model;
}

export function runBindingsChecks(
  doc: BindingsDoc,
  options: BindingsCheckOptions = {},
): Finding[] {
  const findings: Finding[] = [];
  checkElements(doc, findings);
  checkEvents(doc, findings);
  checkLiterals(doc, findings);
  // Check the shape of literal_coverage regardless of whether a model is present
  // (standalone checks without an IR must not hide this kind of breakage either)
  const coverageShapeOk =
    doc.literal_coverage === undefined || isRecord(doc.literal_coverage);
  if (!coverageShapeOk) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literal_coverage must be a map (rule id → stance)",
    });
  }
  if (options.model) {
    if (doc.bindings !== options.model.ir.usecase) {
      findings.push({
        level: "error",
        check: "bindings-usecase",
        message: `the bindings target (${doc.bindings}) does not match the IR usecase (${options.model.ir.usecase})`,
      });
    } else if (coverageShapeOk) {
      checkLiteralCoverage(doc, options.model, findings);
    }
  }
  return findings;
}
