import { stages } from "../stage/stages";
import { MAX_COLUMNS, MAX_ROWS, OBJECT_TYPES, PERMANENT_WALL_ID } from "../stage/stagedata";
import { exitLabel, SELECT_ACTION_TYPES, SELECT_TILE_CHARS, SelectMapData } from "./selectdata";
import { resolveSelectMap } from "./selectmap";

const TILE_CHARS = new Set<string>(SELECT_TILE_CHARS);

/** すべてのワールドのラベル一覧 */
export function allStageLabels(maps: Array<SelectMapData>): Array<string> {
  const labels: Array<string> = new Array();
  maps.forEach(map => map.exits.forEach((_, i) => labels.push(exitLabel(map.world, i))));
  return labels;
}

/**
 * 選択マップを検証して、問題点のリストを返す。
 * ルールは dev-docs/08-select-format.md。
 */
export function validateSelectMap(map: SelectMapData, allLabels: Array<string>): Array<string> {
  const problems: Array<string> = new Array();

  if(!Number.isInteger(map.world) || map.world < 1) {
    problems.push(`world は 1 以上の整数にしてください (現在: ${map.world})`);
  }
  if(!Array.isArray(map.tiles) || map.tiles.length === 0) {
    problems.push("tiles が空です");
    return problems;
  }
  if(!Array.isArray(map.exits) || map.exits.length === 0) {
    problems.push("exits が空です。ステージへの入口が 1 つもありません");
  }

  const markChars = new Set<string>();
  (map.exits ?? []).forEach((e, i) => {
    const label = exitLabel(map.world, i);
    if(typeof e.mark !== "string" || e.mark.length !== 1) {
      problems.push(`${label}: mark は 1 文字にしてください (現在: '${e.mark}')`);
      return;
    }
    if(TILE_CHARS.has(e.mark)) {
      problems.push(`${label}: mark '${e.mark}' はタイル記法と重複しています (${[...TILE_CHARS].join(" ")} は使えません)`);
    }
    if(/^[a-z]$/.test(e.mark)) {
      problems.push(`${label}: mark '${e.mark}' は小文字（スイッチタイル）と重複しています。数字か記号にしてください`);
    }
    if(e.mark === " ") problems.push(`${label}: mark に空白は使えません`);
    if(markChars.has(e.mark)) problems.push(`${label}: mark '${e.mark}' が他の exit と重複しています`);
    markChars.add(e.mark);

    if(!Number.isInteger(e.stage) || e.stage < 0 || e.stage >= stages.length) {
      problems.push(`${label}: stage が範囲外です (${e.stage}。0〜${stages.length - 1})`);
    }
  });

  // --- タイルの走査 ---
  const resolved = resolveSelectMap(map);
  resolved.problems.forEach(p => problems.push(p));
  if(resolved.start === null) problems.push("スタート 'S' がありません");

  let starts = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const switches = new Set<string>();
  const unknown = new Set<string>();

  map.tiles.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      if(c === " ") return;
      if(resolved.markChars.has(c)) return;
      if(!TILE_CHARS.has(c) && !/^[a-z]$/.test(c)) {
        unknown.add(c);
        return;
      }
      if(c === "S") ++starts;
      if(/^[a-z]$/.test(c)) switches.add(c);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if(starts > 1) problems.push(`スタート 'S' はちょうど 1 個必要です (現在: ${starts} 個)`);
  if(unknown.size > 0) {
    problems.push(`タイルにならない文字が含まれています: ${[...unknown].map(c => `'${c}'`).join(", ")}`);
  }
  if(Number.isFinite(minX)) {
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if(width > MAX_COLUMNS) problems.push(`幅が ${width} 列あります (上限 ${MAX_COLUMNS} 列)`);
    if(height > MAX_ROWS) problems.push(`高さが ${height} 行あります (上限 ${MAX_ROWS} 行)`);
  }

  // --- objects ---
  const eventLaserIds = new Set(
    (map.events ?? []).filter(e => e.action?.type === "openLaser").map(e => e.action.id)
  );
  (map.objects ?? []).forEach((o, i) => {
    const where = `objects[${i}]`;
    if(!(OBJECT_TYPES as readonly string[]).includes(o.type)) {
      problems.push(`${where}: 未実装の type '${o.type}' です`);
    }
    if(o.position == null || typeof o.position.x !== "number" || typeof o.position.y !== "number") {
      problems.push(`${where}: position が不正です`);
      return;
    }
    const isInt = (v: number) => Number.isInteger(v);
    const isHalf = (v: number) => !isInt(v) && Number.isInteger(v * 2);
    const { x, y } = o.position;
    if(!((isInt(x) && isHalf(y)) || (isHalf(x) && isInt(y)))) {
      problems.push(`${where}: position は片方が整数・もう片方が .5 の半整数にしてください (現在: x=${x}, y=${y})`);
    }
    if(o.id !== PERMANENT_WALL_ID && !switches.has(o.id) && !eventLaserIds.has(o.id)) {
      problems.push(
        `${where}: id '${o.id}' を開ける手段がありません。` +
        `同じ id のスイッチタイルを置くか、events で openLaser するか、id を "${PERMANENT_WALL_ID}" にしてください`
      );
    }
  });

  // --- events ---
  const eventIds = new Set<string>();
  (map.events ?? []).forEach((e, i) => {
    const where = `events[${i}]`;
    if(typeof e.id !== "string" || e.id.length === 0) {
      problems.push(`${where}: id は必須です（演出を二度流さないために使います）`);
    } else if(eventIds.has(e.id)) {
      problems.push(`${where}: id '${e.id}' が重複しています`);
    }
    eventIds.add(e.id);

    if(e.when == null || (e.when.cleared === undefined && e.when.clearedCount === undefined)) {
      problems.push(`${where}: when に cleared か clearedCount のどちらかが必要です`);
    }
    if(e.when?.cleared !== undefined) {
      const labels = Array.isArray(e.when.cleared) ? e.when.cleared : [e.when.cleared];
      labels.forEach(l => {
        if(!allLabels.includes(l)) problems.push(`${where}: when.cleared の '${l}' はどのワールドにも存在しないラベルです`);
      });
    }
    if(e.when?.clearedCount !== undefined && (!Number.isInteger(e.when.clearedCount) || e.when.clearedCount < 1)) {
      problems.push(`${where}: when.clearedCount は 1 以上の整数にしてください`);
    }
    if(e.action == null || !(SELECT_ACTION_TYPES as readonly string[]).includes(e.action.type)) {
      problems.push(`${where}: 未実装の action.type です (実装済み: ${SELECT_ACTION_TYPES.join(", ")})`);
      return;
    }
    const targeted = (map.objects ?? []).some(o => o.id === e.action.id);
    if(!targeted) problems.push(`${where}: action.id '${e.action.id}' のレーザーが objects にありません`);
  });

  return problems;
}

/** 全ワールドを検証して console に出す。開発ビルドでのみ呼ぶこと */
export function validateAllSelectMaps(maps: Array<SelectMapData>): void {
  const labels = allStageLabels(maps);
  maps.forEach((map, i) => {
    const problems = validateSelectMap(map, labels);
    if(problems.length === 0) return;
    console.warn(
      `[LoopCut] 選択マップ ${i + 1} (world ${map.world}) に問題があります:\n` +
      problems.map(p => `  - ${p}`).join("\n")
    );
  });
}
