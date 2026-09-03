import type { StageData } from "../stagedata";

import stage1 from "./stage1.json";
import stage2 from "./stage2.json";
import stage3 from "./stage3.json";
import stage4 from "./stage4.json";
import stage5 from "./stage5.json";
import stage6 from "./stage6.json";
import stage7 from "./stage7.json";

/**
 * プレイ順のステージ一覧。**この配列の順序がそのままステージ順になる。**
 *
 * かつては import.meta.glob で読んでいたため、ファイル名の辞書順に依存していた
 * （stage10.json がステージ 2 の位置に割り込む / 10KB を超えると壊れる）。
 * ステージを追加したら import を 1 行と、この配列に 1 要素を足すこと。
 * 詳細は dev-docs/03-stage-format.md。
 */
export const stages: Array<StageData> = [
  stage1,
  stage2,
  stage3,
  stage4,
  stage5,
  stage6,
  stage7
];
