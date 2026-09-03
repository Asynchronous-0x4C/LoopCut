/**
 * ステージと選択マップを検証するスクリプト。`bun run verify` で実行する。
 *
 * 1. ステージ: データの妥当性（validateStage）と**実際に解けるか**（solver）
 * 2. 選択マップ: データの妥当性（validateSelectMap）と
 *    **地形ロックで詰まないか**（analyzeSelectMap）
 *
 * どちらもゲーム本体とまったく同じルール・タイル・フィールドを動かしているので、
 * ここが緑ならルールの回帰は起きていない。
 *
 * 失敗時は throw して終了コードを非 0 にする。
 */
import { stages } from "../src/game/stage/stages";
import { validateStage } from "../src/game/stage/validate";
import { formatMoves, playRoute, solve } from "../src/game/stage/solver";
import { DEFAULT_MAX_GHOSTS, DEFAULT_STEPS } from "../src/game/stage/stagedata";
import { selectMaps } from "../src/game/select/maps";
import { allStageLabels, validateSelectMap } from "../src/game/select/validate";
import { analyzeSelectMap } from "../src/game/select/reachability";

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
  7: 4,
  8: 3,
  9: 2
};

/**
 * 「この手順でクリアできること」を固定した既知の解法。
 *
 * ソルバは解の存在しか見ないので、**別解があると意図した手順が壊れても気づけない**。
 * 実際、詰み判定がレーザーを見るようになったとき（L-1）、
 * ステージ 4 の本来の解法 `SDWDSAA` が壊れたのに別解 `DSDWAA` のせいで検出できなかった。
 * ルールの意図を守りたい手順は、ここに書いておくこと。
 */
const KNOWN_ROUTES: Record<number, Array<string>> = {
  // ゴーストがスイッチを踏んでレーザーが開くのを待ってから進む手順。
  // 詰み判定をゴーストの移動より前に戻すと、これが壊れる。
  4: ["SDWDSAA", "DSDWAA"],
  // 2 体のゴーストがそれぞれスイッチを押さえ続ける手順。
  // ゴーストの巻き戻し（Ghost.rewind）が壊れると、どちらも通らなくなる。
  8: ["AADDSS", "DDAASS"],
  // 中央の `=` を 1 ループで 2 回通る手順。
  // Tile.fingerprint() が remain を含めないと、ソルバがこの解を取りこぼす。
  9: ["SDAASS"]
};

/** 何ループまで探索するか */
const MAX_LOOPS = 5;

let failed = 0;
let unrecorded = 0;

function report(ok: boolean, line: string, problems: Array<string>) {
  console.log(`  ${ok ? "OK " : "NG "} ${line}`);
  problems.forEach(p => console.log(`         - ${p}`));
  if(!ok) ++failed;
}

// --- ステージ ---
console.log("\nステージ");
stages.forEach((data, i) => {
  const no = i + 1;
  const name = `stage${no}`;
  const problems = validateStage(data);
  const width = Math.max(...data.tiles.map(r => r.trimEnd().length));
  const shape = `${width}x${data.tiles.length}`;
  const steps = data.steps ?? DEFAULT_STEPS;
  const ghosts = data.ghosts ?? DEFAULT_MAX_GHOSTS;

  let summary = "";
  if(problems.length === 0) {
    const result = solve(data, MAX_LOOPS);
    if(!result.solved) {
      problems.push(result.truncated
        ? `探索が予算内に収まりませんでした（${result.explored} 状態）。解けるかどうか不明です`
        : `${MAX_LOOPS} ループ以内に解が存在しません（${result.explored} 状態を探索）`);
    } else {
      const expected = EXPECTED_LOOPS[no];
      if(expected === undefined) {
        ++unrecorded;
        problems.push(`最小 ${result.loops} ループで解けました。EXPECTED_LOOPS に \`${no}: ${result.loops}\` を記録してください`);
      } else if(expected !== result.loops) {
        problems.push(`最小ループ数が ${expected} から ${result.loops} に変わりました（手順: ${formatMoves(result.moves)}）`);
      }
      summary = `loops=${result.loops} moves=${formatMoves(result.moves)}`;
    }

    (KNOWN_ROUTES[no] ?? []).forEach(route => {
      const r = playRoute(data, route);
      if(!r.cleared) {
        problems.push(`既知の解法 ${route} がクリアできなくなりました（${r.played} 手目で停止）`);
      }
    });
  }
  report(problems.length === 0,
    `${name.padEnd(8)} ${shape.padEnd(7)} steps=${String(steps).padEnd(3)} ghosts=${ghosts} ${summary}`,
    problems);
});

// --- 選択マップ ---
console.log("\n選択マップ");
const labels = allStageLabels(selectMaps);
const linked = new Set<number>();

selectMaps.forEach(map => {
  const name = `world${map.world}`;
  const problems = validateSelectMap(map, labels);

  let summary = "";
  if(problems.length === 0) {
    map.exits.forEach(e => linked.add(e.stage));
    const reach = analyzeSelectMap(map);
    if(reach.unreachable.length > 0) {
      problems.push(`到達できない入口があります: ${reach.unreachable.join(", ")}（地形ロックで詰んでいます）`);
    }
    summary = `exits=${map.exits.length} 開放順=[${reach.waves.map(w => w.join(" ")).join("] → [")}]`;
  }
  report(problems.length === 0, `${name.padEnd(8)} ${summary}`, problems);
});

// --- どの選択マップからも入れないステージが無いか ---
const orphans = stages.map((_, i) => i).filter(i => !linked.has(i));
if(orphans.length > 0) {
  console.log("");
  console.log(`  NG  どの選択マップからも入れないステージがあります: ${orphans.map(i => `stage${i + 1}`).join(", ")}`);
  ++failed;
}

console.log("");
if(failed > 0) {
  throw new Error(`${failed} 件の問題があります`);
}
if(unrecorded > 0) {
  throw new Error(`${unrecorded} ステージの期待ループ数が未記録です`);
}
console.log(
  `ステージ ${stages.length} 個 / 選択マップ ${selectMaps.length} 個 すべて OK` +
  `（ラベル: ${labels[0]} 〜 ${labels[labels.length - 1]}）`
);
