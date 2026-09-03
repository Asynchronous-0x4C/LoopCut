/**
 * 全ステージを検証するスクリプト。`bun run verify` で実行する。
 *
 * ここで検証するのは「データとして正しいか」まで。
 * 「実際に解けるか」の検証はフェーズ 2.5 のソルバで追加する
 * （dev-docs/07-roadmap.md）。
 *
 * 失敗時は throw して終了コードを非 0 にする。
 */
import { stages } from "../src/game/stage/stages";
import { validateStage } from "../src/game/stage/validate";
import { DEFAULT_STEPS } from "../src/game/stage/stagedata";

let failed = 0;

stages.forEach((data, i) => {
  const name = `stage${i + 1}`;
  const problems = validateStage(data);
  const size = `${Math.max(...data.tiles.map(r => r.trimEnd().length))}x${data.tiles.length}`;
  const steps = data.steps ?? DEFAULT_STEPS;
  const objects = data.objects?.length ?? 0;

  if(problems.length === 0) {
    console.log(`  OK   ${name.padEnd(8)} ${size.padEnd(7)} steps=${String(steps).padEnd(3)} objects=${objects}`);
    return;
  }
  ++failed;
  console.log(`  NG   ${name.padEnd(8)} ${size.padEnd(7)} steps=${String(steps).padEnd(3)} objects=${objects}`);
  problems.forEach(p => console.log(`         - ${p}`));
});

console.log("");
if(failed > 0) {
  throw new Error(`${failed} / ${stages.length} ステージに問題があります`);
}
console.log(`${stages.length} ステージすべて OK`);
