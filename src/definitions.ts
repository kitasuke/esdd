// observation レジストリ (YAML) から observation 名を読み取る。
// レジストリ構造: observations.<name>.keys.<key> — name と key の両方を語彙として扱う
// (outcomeの observation: には name(例: viewObservation)でも
//  key(例: cancelDuringAcceptDialog)でも参照できる)。

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export function loadObservationNames(definitionsPath: string): Set<string> {
  // レジストリ YAML は重複キーを含むことがあるため、uniqueKeys は強制しない
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
