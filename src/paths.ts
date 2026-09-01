// 遷移カバレッジを満たすためのパス提案。
// 既存シナリオが踏んでいない遷移を、initial からの実行可能なイベント列として提案する。

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

/** current から「未カバー遷移を持つ状態」までの最短イベント列 (カバー済み遷移のみ通る) */
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
 * 未カバー遷移をすべて踏むパス群を貪欲に構築する。
 * 戻り値の各要素がシナリオ候補 (イベント列)。
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
    // 1本のパスを、未カバー遷移を優先しながら伸ばす
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
      // ここに未カバーはない → 未カバーを持つ状態へ移動できるなら移動
      const route = routeToUncovered(model, current, covered);
      if (!route || route.length === 0) break;
      for (const event of route) {
        const cell = model.cells.get(cellKey(current, event))?.[0];
        if (!cell || cell.impossible) break;
        path.push(event);
        current = cell.to!;
      }
    }
    if (!progressed) break; // これ以上到達できない未カバー遷移が残っている
    if (path.length > 0) suggestions.push(path);
  }
  return suggestions;
}
