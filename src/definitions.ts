// Reads observation names from an observation registry (YAML).
// Registry structure: observations.<name>.keys.<key> — both names and keys are
// treated as vocabulary (an outcome's observation: may reference either the
// name, e.g. viewObservation, or a key, e.g. cancelDuringAcceptDialog).

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export function loadObservationNames(definitionsPath: string): Set<string> {
  // Registry YAML files may contain duplicate keys, so do not enforce uniqueKeys
  const raw = parseYaml(readFileSync(definitionsPath, "utf8"), {
    uniqueKeys: false,
  }) as {
    observations?: Record<string, { keys?: Record<string, unknown> }>;
  };
  const names = new Set<string>();
  for (const [name, def] of Object.entries(raw?.observations ?? {})) {
    names.add(name);
    for (const key of Object.keys(def?.keys ?? {})) {
      names.add(key);
    }
  }
  return names;
}
