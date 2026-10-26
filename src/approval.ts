// Checks for approved IRs (--approved). See docs/approval.md.
// An approved IR is committed one file per usecase, so its git history is the history of
// approved versions. It therefore carries "which spec version, approved by whom, when"
// itself, and is rejected when its file name drifts or when unanswered questions remain.

import { basename } from "node:path";
import type { Finding, Model } from "./types.ts";

const DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

// YAML does not enforce types (approved_by: 123 or {} still parses), so the audit fields
// are checked to be strings, not just present
function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function checkApproved(model: Model, file: string): Finding[] {
  const findings: Finding[] = [];
  const err = (message: string) => findings.push({ level: "error", check: "approval", message });
  const { source, usecase } = model.ir;

  // A fixed path per usecase is what makes `git log` the history of its approved versions
  const expected = `${usecase}.usecase.yaml`;
  if (basename(file) !== expected) {
    err(`the file name must match the usecase id: ${expected}`);
  }
  if (!nonEmptyString(source.version)) {
    err("source.version (the approved spec version, e.g. its last-edited timestamp) is required");
  }
  const approval = source.approval;
  if (typeof approval !== "object" || approval === null || Array.isArray(approval)) {
    err("source.approval (approved_by / approved_at / record) is required");
    return findings;
  }
  if (!nonEmptyString(approval.approved_by)) {
    err("source.approval.approved_by (a string naming the approver) is required");
  }
  if (!nonEmptyString(approval.approved_at) || !DATE.test(approval.approved_at)) {
    err("source.approval.approved_at is required as YYYY-MM-DD (or ISO 8601)");
  }
  if (!nonEmptyString(approval.record) || !/^https:\/\//.test(approval.record)) {
    err("source.approval.record (an https URL where the approval itself lives) is required");
  }
  return findings;
}

/** In an approved IR, unanswered question markers (pending) are errors, not warnings */
export function escalatePending(findings: Finding[]): Finding[] {
  return findings.map((f) => (f.check === "pending" ? { ...f, level: "error" } : f));
}
