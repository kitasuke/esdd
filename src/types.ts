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
  reason?: string;
}

export interface RaceDef {
  state: string;
  between: [string, string];
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

export interface RuleDef {
  id: string;
  name: string;
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
}

/** The approval record an approved IR carries (docs/approval.md). Checked by approval.ts */
export interface ApprovalRecord {
  approved_by?: string;
  approved_at?: string;
  /** URL of the place where the approval itself lives (an issue comment, a review, …) */
  record?: string;
}

export interface UseCaseIR {
  usecase: string;
  name: string;
  source: { spec: string; version?: string; approval?: ApprovalRecord };
  initial?: string;
  states?: StateDef[];
  events?: EventDef[];
  transitions?: TransitionEntry[];
  races?: RaceDef[];
  inputs?: InputDef[];
  scenarios: ScenarioDef[];
  rules?: RuleDef[];
}

// One cell of the transition matrix, after expanding array-form from/on declarations.
export interface Cell {
  from: string;
  on: string;
  to?: string;
  outcome?: OutcomeItem[];
  impossible: boolean;
  reason?: string;
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
  initial?: string;
  /** key: `${from} ${on}` */
  cells: Map<string, Cell[]>;
}

export function cellKey(from: string, on: string): string {
  return `${from} ${on}`;
}
