// Type definitions for the ESDD UseCase IR.
// Format specification: docs/usecase-ir.md

/** actor is an open vocabulary (e.g. customer / staff / system) */
export type Actor = string;

export type OutcomeItem =
  | string
  | {
      surface?: string;
      ui?: string;
      observation?: string;
      keys?: Record<string, unknown>;
    };

export interface StateDef {
  id: string;
  label?: string;
  terminal?: boolean;
}

export interface EventDef {
  id: string;
  label?: string;
  actor: Actor;
}

export interface TransitionEntry {
  from: string | string[];
  on: string | string[];
  to?: string;
  outcome?: OutcomeItem[];
  impossible?: true;
  /** The event can arrive but changes nothing and is ignored (a duplicate notice, a timer that no longer applies). Requires a reason */
  ignored?: true;
  reason?: string;
}

/**
 * One race: in state, the two events between happen at almost the same time. After parsing, every
 * race in the model is in this form; a declaration that names several states, or one event against
 * every event of another actor, is expanded into one RaceDef per state and pair (see RaceDecl)
 */
export interface RaceDef {
  state: string;
  between: [string, string];
  winner: string;
  outcome: OutcomeItem[];
  /** Index of the races declaration this race was expanded from (for messages and rendering) */
  declaration?: number;
}

/**
 * A races declaration as written. state may list several states; between may name one event, which
 * then races every event of another actor (only of against, when given) possible in each state
 */
export interface RaceDecl {
  state: string | string[];
  between: [string] | [string, string];
  against?: string;
  winner: string;
  outcome: OutcomeItem[];
}

export interface ScenarioDef {
  id: string;
  name: string;
  path?: string[];
  critical?: boolean;
  given?: string[];
  when?: string[];
  then?: string[];
  /** Coverage claims for input-axis cells ("<inputId>×<condition>"). Verified by checkInputs */
  covers?: string | string[];
}

/**
 * What a rule promises, beyond a decision table: something never happens, something always ends up
 * happening, a bound, no two of something, an order, or who may do something (docs/usecase-ir.md "Rule kinds")
 */
export const RULE_KINDS = ["never", "eventually", "limit", "unique", "order", "permission"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export interface RuleDef {
  id: string;
  name: string;
  /** Optional: what kind of promise the rule makes. Requires property */
  kind?: RuleKind;
  /** One sentence that holds for every case: the promise the cases are examples of */
  property?: string;
  cases: { input: unknown; expected: unknown; covers?: string | string[] }[];
}

/**
 * Declaration of an input axis (the stateless-mode counterpart of states×events).
 * Every declared input × condition cell must take an explicit stance: covers or na.
 */
export interface InputDef {
  id: string;
  kind: "field" | "option";
  /** Optional metadata (not used by the checks; for downstream consumers) */
  required?: boolean;
  /** Overrides the condition set. When omitted, the kind-specific defaults apply (checks.ts INPUT_DEFAULT_CONDITIONS) */
  conditions?: string[];
  /** condition → "why this cell cannot occur / is meaningless" (the input-axis counterpart of impossible) */
  na?: Record<string, string>;
  /** What a reader calls the input (the input-axis counterpart of a state's or event's label). Rendered text uses it; checks and covers use the id */
  label?: string;
  /** condition → what a reader calls it. Rendered text uses it; checks and covers use the condition */
  condition_labels?: Record<string, string>;
}

/** The approval record an approved IR carries (docs/approval.md). Checked by approval.ts */
export interface ApprovalRecord {
  approved_by?: string;
  approved_at?: string;
  /** URL of the place where the approval itself lives (an issue comment, a review, …) */
  record?: string;
  /** The ids of the assumptions this approval accepts (must equal the IR's declared assumptions) */
  assumptions_accepted?: string[];
}

/** A proposed answer applied to the IR by default (docs/pipeline.md "Accept by default"). Checked by assumptions.ts */
export interface AssumptionDef {
  /** The question id from the review (e.g. W4) — referenced as ASSUMED(<id>) in IR texts */
  id: string;
  question: string;
  /** The answer that was applied */
  proposal: string;
  /** Why this answer: the spec passage, the existing feature or text it follows */
  basis: string;
}

/**
 * A further spec source the IR was converted from, besides source.spec (a design doc, a design file, the
 * implementation in mode B). Each has its own version, so an edit to any of them is visible (docs/approval.md)
 */
export interface SourceRef {
  /** Link to the source */
  spec: string;
  /** Its version at conversion (e.g. its last-edited timestamp, or a commit). Required in an approved IR */
  version?: string;
  /** What the source is, as the digest names it (e.g. "design doc") */
  label?: string;
}

/**
 * The existing screen region a change adds to or alters (mode B). The region's current states are an input
 * axis read from the implementation, so every new element × existing state cell needs a stance (docs/usecase-ir.md)
 */
export interface RegionDef {
  name: string;
  /** The id of the input whose conditions are the region's existing states */
  axis: string;
}

export type ExistingRefKind = "state" | "identifier" | "comment" | "test-title" | "assertion";

/** One existing line bound to a concept the change touches */
export interface ExistingRef {
  kind: ExistingRefKind;
  /** <file>:<line> at the base revision */
  at: string;
  /** Text found on that line (or within two lines of it) at the base revision */
  text: string;
  /** update: the change edits it; keep: it stays, for the reason given */
  decision: "update" | "keep";
  reason: string;
}

/**
 * A concept whose meaning the change alters, with every existing identifier, comment, test title and
 * assertion bound to it (docs/usecase-ir.md "existing"). Read from the implementation in mode B
 */
export interface ExistingDef {
  id: string;
  concept: string;
  /** Search terms that find further lines bound to the concept */
  terms: string[];
  refs: ExistingRef[];
}

export interface UseCaseIR {
  usecase: string;
  name: string;
  source: { spec: string; version?: string; sources?: SourceRef[]; approval?: ApprovalRecord };
  initial?: string;
  states?: StateDef[];
  events?: EventDef[];
  transitions?: TransitionEntry[];
  races?: RaceDef[];
  inputs?: InputDef[];
  scenarios: ScenarioDef[];
  rules?: RuleDef[];
  /** kind → why this usecase needs no rule of that kind (the rule-kinds counterpart of an input's na) */
  rule_kinds_na?: Partial<Record<RuleKind, string>>;
  assumptions?: AssumptionDef[];
  region?: RegionDef;
  existing?: ExistingDef[];
}

// One cell of the transition matrix, after expanding array-form from/on declarations.
export interface Cell {
  from: string;
  on: string;
  to?: string | undefined;
  outcome?: OutcomeItem[] | undefined;
  /** No transition in this cell (it cannot happen, or it is ignored). Such cells are skipped by paths, races and coverage */
  impossible: boolean;
  /** The event can happen but is ignored (impossible is also true). Unlike a plain impossible cell, the trace asks for a test of it */
  ignored: boolean;
  reason?: string | undefined;
  /** Index of the originating entry in the transitions array (for error reporting) */
  entryIndex: number;
}

export type FindingLevel = "error" | "warn";

export interface Finding {
  level: FindingLevel;
  check: string;
  message: string;
}

export interface Model {
  ir: UseCaseIR;
  hasStateMachine: boolean;
  states: Map<string, StateDef>;
  events: Map<string, EventDef>;
  initial?: string | undefined;
  /** key: `${from} ${on}` */
  cells: Map<string, Cell[]>;
}

export function cellKey(from: string, on: string): string {
  return `${from} ${on}`;
}
