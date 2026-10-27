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
export function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
