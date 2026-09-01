// Path suggestions for satisfying transition coverage.
// Proposes event sequences, executable from initial, that exercise transitions
// no existing scenario has stepped on yet.

import { coveredCells } from "./checks.ts";
import { cellKey, type Cell, type Model } from "./types.ts";

function transitionCellsFrom(model: Model, state: string): Cell[] {
  const out: Cell[] = [];
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (!c.impossible && c.from === state) out.push(c);
    }
  }
  return out;
}

/** Shortest event sequence from current to a state with an uncovered transition (walking covered transitions only) */
function routeToUncovered(
  model: Model,
  current: string,
  covered: Set<string>,
): string[] | undefined {
  const queue: { state: string; events: string[] }[] = [{ state: current, events: [] }];
  const visited = new Set<string>([current]);
  while (queue.length > 0) {
    const { state, events } = queue.shift()!;
    const hasUncovered = transitionCellsFrom(model, state).some(
      (c) => !covered.has(cellKey(c.from, c.on)),
    );
    if (hasUncovered) return events;
    for (const c of transitionCellsFrom(model, state)) {
      if (c.to && !visited.has(c.to)) {
        visited.add(c.to);
        queue.push({ state: c.to, events: [...events, c.on] });
      }
    }
  }
  return undefined;
}

/**
 * Greedily builds a set of paths that together exercise every uncovered transition.
 * Each element of the return value is a scenario candidate (an event sequence).
 */
export function suggestPaths(model: Model): string[][] {
  if (!model.initial) return [];
  const covered = coveredCells(model);
  const uncoveredCount = () => {
    let n = 0;
    for (const list of model.cells.values()) {
      for (const c of list) {
        if (!c.impossible && !covered.has(cellKey(c.from, c.on))) n++;
      }
    }
    return n;
  };

  const suggestions: string[][] = [];
  let guard = 0;
  while (uncoveredCount() > 0 && guard++ < 100) {
    const path: string[] = [];
    let current: string = model.initial;
    let progressed = false;
    // Grow one path, preferring uncovered transitions
    for (let steps = 0; steps < 200; steps++) {
      const outgoing = transitionCellsFrom(model, current);
      if (outgoing.length === 0) break; // terminal
      const uncoveredHere = outgoing.find((c) => !covered.has(cellKey(c.from, c.on)));
      if (uncoveredHere) {
        covered.add(cellKey(uncoveredHere.from, uncoveredHere.on));
        path.push(uncoveredHere.on);
        current = uncoveredHere.to!;
        progressed = true;
        continue;
      }
      // No uncovered transition here → move toward a state that has one, if reachable
      const route = routeToUncovered(model, current, covered);
      if (!route || route.length === 0) break;
      for (const event of route) {
        const cell = model.cells.get(cellKey(current, event))?.[0];
        if (!cell || cell.impossible) break;
        path.push(event);
        current = cell.to!;
      }
    }
    if (!progressed) break; // the remaining uncovered transitions are unreachable
    if (path.length > 0) suggestions.push(path);
  }
  return suggestions;
}
