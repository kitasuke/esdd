// Text extraction shared by several checks. Written once so the checks cannot drift apart
// (e.g. a new outcome field showing up in pending but not in the assumption-marker scan).

import type { OutcomeItem } from "./types.ts";

/** The human-readable texts of outcome items (the string itself, or ui / observation) */
export function outcomeTexts(outcome: OutcomeItem[] | undefined): string[] {
  return (outcome ?? []).flatMap((item) =>
    typeof item === "string" ? [item] : [item.ui ?? "", item.observation ?? ""],
  );
}

/** A non-empty string. YAML does not enforce types (approved_by: 123 or {} still parse), so audit fields are type-checked */
/**
 * A special races winner: the winner is decided by arrival order (whichever arrives first wins), not by the kind of event.
 * Fixing the winner to one of the between events would record the wrong behavior for the order where the other arrives first
 */
export const RACE_WINNER_FIRST = "first";

/** Render a races winner as a phrase */
export function raceWinnerText(winner: string): string {
  return winner === RACE_WINNER_FIRST ? "whichever arrives first wins" : `${winner} wins`;
}

export function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
