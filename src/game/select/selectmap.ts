import { DIRECTIONS, offsetOf, opposite } from "../stage/direction";
import { GridPosition } from "../stage/stagedata";
import { exitLabel, SelectEventCondition, SelectExit, SelectMapData } from "./selectdata";

/**
 * 選択マップの `tiles` を読んで、入口・開始位置・マーク文字を解決する。
 *
 * **描画にも `Field` にも依存しない純粋関数。**
 * `Select`（実行時）と `validateSelectMap`（検証）の両方がこれを使うので、
 * 「マップの読み方」がひとつしか存在しない。
 */
export interface ResolvedSelectMap {
  exits: Array<SelectExit>;
  /** `S` の位置。見つからなければ null */
  start: GridPosition|null;
  /** exits が使うマーク文字。この文字のマスにはタイルを作らない */
  markChars: Set<string>;
  /** 解決できなかった点。検証にも実行時のエラー表示にも使う */
  problems: Array<string>;
}

export function resolveSelectMap(map: SelectMapData): ResolvedSelectMap {
  const problems: Array<string> = new Array();
  const markChars = new Set<string>((map.exits ?? []).map(e => e.mark));

  const charAt = (x: number, y: number): string => {
    const row = map.tiles[y];
    return row === undefined ? " " : (row[x] ?? " ");
  };

  // マーク文字の出現位置を集める
  const markAt = new Map<string, Array<GridPosition>>();
  let start: GridPosition|null = null;
  map.tiles.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      if(c === "S") start = { x: x, y: y };
      if(!markChars.has(c)) return;
      const list = markAt.get(c) ?? [];
      list.push({ x: x, y: y });
      markAt.set(c, list);
    });
  });

  const exits: Array<SelectExit> = new Array();
  const usedGates = new Set<string>();

  (map.exits ?? []).forEach((data, i) => {
    const label = exitLabel(map.world, i);
    const places = markAt.get(data.mark) ?? [];
    if(places.length === 0) {
      problems.push(`${label}: mark '${data.mark}' が tiles にありません`);
      return;
    }
    if(places.length > 1) {
      problems.push(`${label}: mark '${data.mark}' が tiles に ${places.length} 個あります (1 個にしてください)`);
    }
    const mark = places[0];

    // マークに隣接する `&` を探す。見つかった向きの逆が「入口へ進む向き」
    let found = false;
    for(const d of DIRECTIONS) {
      const o = offsetOf(d);
      const gate = { x: mark.x + o.x, y: mark.y + o.y };
      if(charAt(gate.x, gate.y) !== "&") continue;
      const key = `${gate.x},${gate.y}`;
      if(usedGates.has(key)) {
        problems.push(`${label}: '&' タイル (${key}) が他の入口と共有されています。1 つの '&' には入口 1 つにしてください`);
      }
      usedGates.add(key);
      exits.push({
        label: label,
        stage: data.stage,
        gate: gate,
        dir: opposite(d),
        arrow: { x: (gate.x + mark.x) * 0.5, y: (gate.y + mark.y) * 0.5 }
      });
      found = true;
      break;
    }
    if(!found) {
      problems.push(`${label}: mark '${data.mark}' の隣に '&' タイルがありません。矢印の向きが決まりません`);
    }
  });

  // どの入口にも使われていない `&` を報告する
  map.tiles.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      if(c !== "&") return;
      if(usedGates.has(`${x},${y}`)) return;
      problems.push(`(${x},${y}) の '&' タイルはどの入口にも使われていません`);
    });
  });

  return { exits, start, markChars, problems };
}

/**
 * イベントの発動条件を判定する。
 * 実行時（進捗から作った集合）と検証時（仮想的なクリア集合）の両方から使う。
 */
export function conditionMet(when: SelectEventCondition, cleared: ReadonlySet<string>): boolean {
  if(when.clearedCount !== undefined && cleared.size < when.clearedCount) return false;
  if(when.cleared !== undefined) {
    const labels = Array.isArray(when.cleared) ? when.cleared : [when.cleared];
    if(!labels.every(l => cleared.has(l))) return false;
  }
  return true;
}
