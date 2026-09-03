/**
 * ステージ JSON のスキーマ定義。
 * 書き方の仕様は dev-docs/03-stage-format.md を参照。
 */

export interface GridPosition {
  x: number;
  y: number;
}

/**
 * objects[] の 1 要素。
 * JSON は外部データなので type は string のまま受け取り、
 * Stage.reset() の分岐と validateStage() で絞り込む。
 */
export interface StageObjectData {
  type: string;
  id: string;
  position: GridPosition;
}

export interface StageData {
  /** 1 ループで動ける回数。省略時は DEFAULT_STEPS */
  steps?: number;
  /**
   * 同時に存在できるゴーストの数。省略時は DEFAULT_MAX_GHOSTS (1)。
   * 2 以上にすると、直近 N ループぶんの分身が同時に出る。
   */
  ghosts?: number;
  /** 1 要素 = 1 行。文字の位置がそのまま x 座標になる */
  tiles: string[];
  objects?: StageObjectData[];
}

/** steps を省略したときの既定値 */
export const DEFAULT_STEPS = 4;

/** ステージが `ghosts` を省略したときの、同時に存在できるゴーストの数 */
export const DEFAULT_MAX_GHOSTS = 1;

/** `ghosts` に指定できる上限。増やしすぎると盤面が読めなくなる */
export const MAX_GHOSTS_LIMIT = 4;

/** 実装済みの objects[].type */
export const OBJECT_TYPES = ["laser"] as const;

/**
 * objects[].id にこれを指定すると、どのスイッチでも消せない恒久的な壁になる。
 * SwitchTile の id は a-z の 1 文字なので、この値は決して一致しない。
 */
export const PERMANENT_WALL_ID = "-";

/** タイルを生成する文字（小文字 a-z は SwitchTile なので別扱い） */
export const TILE_CHARS = ["S", "G", "#", "@"] as const;

/** フィールドの物理的な上限。1280x720 を gap=60 で割った値 */
export const MAX_COLUMNS = 21;
export const MAX_ROWS = 12;

/** その文字がタイルを生成するか */
export function isTileChar(c: string): boolean {
  return (TILE_CHARS as readonly string[]).includes(c) || /^[a-z]$/.test(c);
}
