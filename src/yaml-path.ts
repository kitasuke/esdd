// Where a node sits in a YAML document, named the way the checker names places:
// transitions[0].outcome[1], rules[RULE-001].cases[0].expected (an item with an id is named by it).

import { isMap, isPair, isScalar, isSeq } from "yaml";

/** The place of `leaf`, given the ancestry `path` a yaml `visit` callback receives */
export function yamlPath(path: readonly unknown[], leaf: unknown): string {
  let out = "";
  for (let i = 0; i < path.length; i++) {
    const el = path[i];
    const next = i + 1 < path.length ? path[i + 1] : leaf;
    if (isPair(el) && isScalar(el.key)) {
      out += out ? `.${String(el.key.value)}` : String(el.key.value);
    } else if (isSeq(el)) {
      const index = el.items.indexOf(next);
      const id = isMap(next) ? next.get("id") : undefined;
      out += typeof id === "string" ? `[${id}]` : `[${index}]`;
    }
  }
  return out;
}
