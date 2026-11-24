// Text extraction shared by several checks. Written once so the checks cannot drift apart
// (e.g. a new outcome field showing up in pending but not in the assumption-marker scan).

import { config } from "./config.ts";
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

const PENDING_MARKERS = ["TBD", "TODO", "FIXME", "UNRESOLVED"];

/** The unanswered-question markers: the defaults plus the project's pendingMarkers */
export function pendingMarkers(): string[] {
  return [...PENDING_MARKERS, ...(config().pendingMarkers ?? [])];
}

/** The unanswered-question marker in a text, if any */
export function findPendingMarker(text: string): string | undefined {
  return pendingMarkers().find((m) => text.includes(m));
}

/** The ids of the markers that carry one in a text: TBD(Q3), TBD(Q3: what to show) */
export function pendingMarkerIds(text: string): string[] {
  const markers = pendingMarkers()
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return [...text.matchAll(new RegExp(`(?:${markers})\\(([^):]+)`, "g"))].map((m) => m[1]!.trim());
}

/**
 * Each marker that carries an id in a text, with its own words: in "TBD(Q1: what shows) TBD(Q2: a toast?)"
 * the parts are TBD(Q1: what shows) and TBD(Q2: a toast?). Parentheses inside a marker's words are kept.
 */
export function pendingMarkerParts(text: string): { id: string; marker: string; text: string }[] {
  const names = pendingMarkers()
    .map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts: { id: string; marker: string; text: string }[] = [];
  for (const m of text.matchAll(new RegExp(`(${names})\\(([^):]+)`, "g"))) {
    // find the parenthesis that closes this marker, counting the ones opened inside its words
    let depth = 0;
    let end = text.length;
    for (let i = m.index! + m[1]!.length; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    parts.push({ id: m[2]!.trim(), marker: m[1]!, text: text.slice(m.index!, end) });
  }
  return parts;
}
