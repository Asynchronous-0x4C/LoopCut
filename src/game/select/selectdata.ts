import { Direction } from "../stage/direction";
import { GridPosition, StageObjectData } from "../stage/stagedata";

/**
 * ステージ選択画面のマップデータ。
 * 仕様は dev-docs/08-select-format.md。
 *
 * **選択マップ 1 枚 = 1 ワールド。** ステージのラベルは
 * `world` と `exits` の並び順から `1-1`, `1-2`, … と自動生成される。
 */
export interface SelectMapData {
  /** ワールド番号。ラベルの左側になる */
  world: number;
  /** 1 要素 = 1 行。文字の位置がそのまま x 座標 */
  tiles: Array<string>;
  /** ステージへの入口。**この配列の並び順がステージ番号になる** */
  exits: Array<SelectExitData>;
  /** レーザーなどのギミック。ステージと同じ書式 */
  objects?: Array<StageObjectData>;
  /** クリア状況で発動するイベント */
  events?: Array<SelectEventData>;
}

export interface SelectExitData {
  /**
   * `tiles` に書く 1 文字。**このマスは描画されない。**
   * 隣接する `&` タイルとの位置関係が、そのまま矢印の向きになる。
   * 数字を推奨するが、他の記法とぶつからなければ記号でもよい（10 個以上のとき用）。
   */
  mark: string;
  /** stages 配列（stage/stages/index.ts）のインデックス */
  stage: number;
}

/** イベントの発動条件。複数書いた場合はすべて満たされたときに発動する */
export interface SelectEventCondition {
  /** このラベルのステージをクリア済みであること（例 "1-1"、配列可） */
  cleared?: string|Array<string>;
  /** クリア済みステージ数がこれ以上であること */
  clearedCount?: number;
}

/**
 * イベントの効果。
 * JSON は外部データなので type は string で受け、validateSelectMap で絞り込む
 * （StageObjectData と同じ方針）。
 */
export interface SelectEventAction {
  /**
   * 実装済みは次の 2 つ。
   * - "openLaser": `id` のレーザーを恒久的に止める
   * - "revealTiles": `id`（大文字 1 文字）の隠し床を出す
   */
  type: string;
  id: string;
}

/** 実装済みの events[].action.type */
export const SELECT_ACTION_TYPES = ["openLaser", "revealTiles"] as const;

/**
 * マップ上のスイッチを押したことを進捗に記録するときの id。
 * イベントの再生記録（firedEvents）と同じ場所に保存する。
 */
export function switchEventId(world: number, id: string): string {
  return `world${world}-switch-${id}`;
}

export interface SelectEventData {
  /** 演出を二度流さないための識別子。マップ内で一意にすること */
  id: string;
  when: SelectEventCondition;
  action: SelectEventAction;
  /** カメラを寄せるグリッド座標。省略時は action の対象位置 */
  focus?: GridPosition;
}

/** マップから解決済みの入口 */
export interface SelectExit {
  /** 表示ラベル（"1-1" など） */
  label: string;
  /** stages 配列のインデックス */
  stage: number;
  /** `&` タイルの位置。プレイヤーはここに立つ */
  gate: GridPosition;
  /** `&` から見た入口の方向。この向きに動くとステージへ入る */
  dir: Direction;
  /** 矢印を描くグリッド座標（`&` と マークの中間） */
  arrow: GridPosition;
}

/**
 * 選択マップで使うタイル文字。exits の mark はこれらと重複してはいけない。
 * ほかに小文字 `a`〜`z`（スイッチ）と大文字 `A`〜`Z`（隠し床）もタイルになる。
 */
export const SELECT_TILE_CHARS = ["S", "#", "&", "@"] as const;

/** ラベルを組み立てる。exits の並び順（0 始まり）を渡す */
export function exitLabel(world: number, index: number): string {
  return `${world}-${index + 1}`;
}
