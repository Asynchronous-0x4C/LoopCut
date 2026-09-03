import { DIRECTIONS, offsetOf } from "../stage/direction";
import { Field } from "../stage/field";
import { createObject } from "../stage/objects";
import { GridPosition } from "../stage/stagedata";
import { SelectMapData } from "./selectdata";
import { conditionMet, resolveSelectMap } from "./selectmap";
import { selectTileRegistry } from "./selecttiles";

export interface SelectReachability {
  /** 到達できた順（ウェーブごと）のラベル */
  waves: Array<Array<string>>;
  /** どうやっても到達できなかったラベル */
  unreachable: Array<string>;
}

/**
 * 選択マップが最後まで進めるかを調べる。
 *
 * 「行ける入口をすべてクリアする → クリア状況でイベントが発動して道が開く →
 * また行ける入口が増える」を、増えなくなるまで繰り返す。
 * 最後まで到達できない入口が残ったら、その世界は**詰んでいる**。
 *
 * ゲーム本体と同じ `Field` / タイル / レーザーを使うので、判定がずれることはない。
 */
export function analyzeSelectMap(map: SelectMapData): SelectReachability {
  const resolved = resolveSelectMap(map);

  const field = new Field();
  map.tiles.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      if(resolved.markChars.has(c)) return;
      const factory = selectTileRegistry[c];
      if(factory !== undefined) field.addTile(factory(x, y));
    });
  });
  (map.objects ?? []).forEach(v => {
    const object = createObject(v);
    if(object !== null) field.addLaser(object);
  });

  const cleared = new Set<string>();
  const waves: Array<Array<string>> = new Array();
  const start = resolved.start ?? { x: 0, y: 0 };

  for(;;) {
    // 今のクリア状況で開くイベントを適用する
    (map.events ?? []).forEach(e => {
      if(!conditionMet(e.when, cleared)) return;
      if(e.action.type === "openLaser") field.deactivateLasers(e.action.id);
    });

    const reachable = flood(field, start);
    const wave = resolved.exits
      .filter(e => !cleared.has(e.label) && reachable.has(`${e.gate.x},${e.gate.y}`))
      .map(e => e.label);
    if(wave.length === 0) break;
    wave.forEach(l => cleared.add(l));
    waves.push(wave);
  }

  return {
    waves,
    unreachable: resolved.exits.filter(e => !cleared.has(e.label)).map(e => e.label)
  };
}

/** start から歩いて行けるタイルの集合 */
function flood(field: Field, start: GridPosition): Set<string> {
  const seen = new Set<string>();
  const from = field.getTile(start.x, start.y);
  if(from === null || !from.canEnter()) return seen;

  const queue: Array<GridPosition> = [start];
  seen.add(`${start.x},${start.y}`);
  while(queue.length > 0) {
    const p = queue.shift()!;
    for(const d of DIRECTIONS) {
      const o = offsetOf(d);
      const q = { x: p.x + o.x, y: p.y + o.y };
      const key = `${q.x},${q.y}`;
      if(seen.has(key)) continue;
      const t = field.getTile(q.x, q.y);
      if(t === null || !t.canEnter()) continue;
      if(field.existsLaser(p.x, p.y, d)) continue;
      seen.add(key);
      queue.push(q);
    }
  }
  return seen;
}
