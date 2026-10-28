// Project configuration: the parts of the checker a project narrows or extends without forking it.
// The CLI loads it from a TypeScript module (--config <file>, default export) before any check runs.
// Every field is optional; an empty config is the method as documented.

import type { BindingsPlatform } from "./bindings.ts";
import type { DigestLabels } from "./digest.ts";

export interface EsddConfig {
  /** A closed actor vocabulary. Omitted, actor is an open vocabulary */
  actors?: string[];
  /** Markers that also count as an unanswered question, besides TBD / TODO / FIXME / UNRESOLVED */
  pendingMarkers?: string[];
  /** Bindings platforms besides the built-in web, by platform name */
  platforms?: Record<string, BindingsPlatform>;
  /** Labels of the approval digest (--digest), for approvers who read another language */
  digest?: Partial<DigestLabels>;
}

let current: EsddConfig = {};

/** Sets the configuration for this process. Tests reset it with configure({}) */
export function configure(config: EsddConfig): void {
  current = config;
}

export function config(): EsddConfig {
  return current;
}
