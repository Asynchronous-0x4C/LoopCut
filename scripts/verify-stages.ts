/**
 * 全ステージを検証するスクリプト。`bun run verify` で実行する。
 *
 * 1. データとして正しいか（validateStage）
 * 2. **実際に解けるか**（solver）
 *
 * 2 はゲーム本体とまったく同じ StageLogic を動かしているので、
 * ルールを変えて既存ステージが解けなくなったらここで落ちる。
 *
 * 失敗時は throw して終了コードを非 0 にする。
 */
import { stages } from "../src/game/stage/stages";
import { validateStage } from "../src/game/stage/validate";
import { formatMoves, solve } from "../src/game/stage/solver";
import { DEFAULT_STEPS } from "../src/game/stage/stagedata";

/**
 * 各ステージを解くのに必要な最小ループ数。**回帰検出のための固定値。**
 * ここが変わったらルールかステージのどちらかが変わっている。
 * ステージを追加したら、verify が表示する値をここに書き足すこと。
 */
const EXPECTED_LOOPS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 4
};

/** 何ループまで探索するか */
const MAX_LOOPS = 5;

let failed = 0;
let unrecorded = 0;

console.log("");
stages.forEach((data, i) => {
  const no = i + 1;
  const name = `stage${no}`;
  const problems = validateStage(data);
  const width = Math.max(...data.tiles.map(r => r.trimEnd().length));
  const shape = `${width}x${data.tiles.length}`;
  const steps = data.steps ?? DEFAULT_STEPS;

  const lines: Array<string> = [];
  problems.forEach(p => lines.push(`データ: ${p}`));

  let summary = "";
  if(problems.length === 0) {
    const result = solve(data, MAX_LOOPS);
    if(!result.solved) {
      lines.push(result.truncated
        ? `探索が予算内に収まりませんでした（${result.explored} 状態を探索）。解けるかどうか不明です`
        : `${MAX_LOOPS} ループ以内に解が存在しません（${result.explored} 状態を探索）`);
    } else {
      const expected = EXPECTED_LOOPS[no];
      if(expected === undefined) {
        ++unrecorded;
        lines.push(`最小 ${result.loops} ループで解けました。EXPECTED_LOOPS に \`${no}: ${result.loops}\` を記録してください`);
      } else if(expected !== result.loops) {
        lines.push(`最小ループ数が ${expected} から ${result.loops} に変わりました（手順: ${formatMoves(result.moves)}）`);
      }
      summary = `loops=${result.loops} moves=${formatMoves(result.moves)}`;
    }
  }

  const status = lines.length === 0 ? "OK " : "NG ";
  if(lines.length > 0) ++failed;
  console.log(`  ${status} ${name.padEnd(8)} ${shape.padEnd(7)} steps=${String(steps).padEnd(3)} ${summary}`);
  lines.forEach(l => console.log(`         - ${l}`));
});

console.log("");
if(failed > 0) {
  throw new Error(`${failed} / ${stages.length} ステージに問題があります`);
}
if(unrecorded > 0) {
  throw new Error(`${unrecorded} ステージの期待ループ数が未記録です`);
}
console.log(`${stages.length} ステージすべて OK（データ検証 + 解の存在確認）`);
