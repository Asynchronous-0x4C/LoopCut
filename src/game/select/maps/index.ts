import type { SelectMapData } from "../selectdata";

import world1 from "./world1.json";

/**
 * ワールド（＝選択マップ）の一覧。**この配列の並び順がワールド順になる。**
 * ワールドを足したら import を 1 行と、この配列に 1 要素を足すこと。
 * 詳細は dev-docs/08-select-format.md。
 */
export const selectMaps: Array<SelectMapData> = [
  world1
];
