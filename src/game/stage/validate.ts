import {
  isTileChar,
  MAX_COLUMNS,
  MAX_ROWS,
  OBJECT_TYPES,
  PERMANENT_WALL_ID,
  StageData
} from "./stagedata";

/**
 * ステージデータを検証して、問題点のリストを返す（問題が無ければ空配列）。
 * ルールの根拠は dev-docs/03-stage-format.md。
 *
 * 実行時に落とさず「警告を出す」方針にしてあるのは、
 * ステージを 1 つ壊しただけでゲーム全体が起動しなくなるのを避けるため。
 */
export function validateStage(data: StageData): string[] {
  const problems: Array<string> = [];

  if(!Array.isArray(data.tiles) || data.tiles.length === 0) {
    problems.push("tiles が空です");
    return problems;
  }

  if(data.steps !== undefined && (!Number.isInteger(data.steps) || data.steps < 1)) {
    problems.push(`steps は 1 以上の整数にしてください (現在: ${data.steps})`);
  }

  // --- タイルの走査 ---
  let starts = 0;
  let goals = 0;
  let tileCount = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const switches = new Set<string>();
  const unknown = new Set<string>();

  data.tiles.forEach((row, y) => {
    row.split("").forEach((c, x) => {
      if(c === " ") return;
      if(!isTileChar(c)) {
        unknown.add(c);
        return;
      }
      if(c === "S") ++starts;
      if(c === "G") ++goals;
      if(/^[a-z]$/.test(c)) switches.add(c);
      ++tileCount;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  if(starts !== 1) problems.push(`スタート 'S' はちょうど 1 個必要です (現在: ${starts} 個)`);
  if(goals < 1) problems.push("ゴール 'G' がありません");
  if(tileCount < 2) problems.push(`タイルが ${tileCount} 個しかありません (2 個以上必要)`);
  if(unknown.size > 0) {
    problems.push(`タイルにならない文字が含まれています: ${[...unknown].map(c => `'${c}'`).join(", ")}`);
  }

  if(tileCount > 0) {
    // フィールドは中央に寄せられるので、左や上に空きがあっても構わない。
    // 効くのは実際に使っている幅と高さだけ。
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if(width > MAX_COLUMNS) problems.push(`幅が ${width} 列あります (上限 ${MAX_COLUMNS} 列)`);
    if(height > MAX_ROWS) problems.push(`高さが ${height} 行あります (上限 ${MAX_ROWS} 行)`);
  }

  // --- objects の走査 ---
  (data.objects ?? []).forEach((o, i) => {
    const where = `objects[${i}]`;
    if(!(OBJECT_TYPES as readonly string[]).includes(o.type)) {
      problems.push(`${where}: 未実装の type '${o.type}' です (実装済み: ${OBJECT_TYPES.join(", ")})`);
    }
    if(o.position == null || typeof o.position.x !== "number" || typeof o.position.y !== "number") {
      problems.push(`${where}: position が不正です`);
      return;
    }
    const isInt = (v: number) => Number.isInteger(v);
    const isHalf = (v: number) => !isInt(v) && Number.isInteger(v * 2);
    const { x, y } = o.position;
    if(!((isInt(x) && isHalf(y)) || (isHalf(x) && isInt(y)))) {
      problems.push(
        `${where}: position は片方が整数・もう片方が .5 の半整数にしてください (現在: x=${x}, y=${y})`
      );
    }
    if(o.id === PERMANENT_WALL_ID) {
      // 意図的に消せない壁。スイッチが無くて当然なので何も言わない
    } else if(typeof o.id !== "string" || !/^[a-z]$/.test(o.id)) {
      problems.push(`${where}: id は a-z の 1 文字か "${PERMANENT_WALL_ID}" にしてください (現在: '${o.id}')`);
    } else if(!switches.has(o.id)) {
      problems.push(
        `${where}: id '${o.id}' に対応するスイッチタイルが tiles にありません。` +
        `意図的に消せない壁にするなら id を "${PERMANENT_WALL_ID}" にしてください`
      );
    }
  });

  return problems;
}

/**
 * 全ステージを検証して console に出す。開発ビルドでのみ呼ぶこと。
 * 問題があっても throw しない。
 */
export function validateAllStages(stages: Array<StageData>): void {
  stages.forEach((data, i) => {
    const problems = validateStage(data);
    if(problems.length === 0) return;
    console.warn(
      `[LoopCut] ステージ ${i + 1} (stage${i + 1}.json) に問題があります:\n` +
      problems.map(p => `  - ${p}`).join("\n")
    );
  });
}
