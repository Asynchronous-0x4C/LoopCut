import { Graphics, Ticker } from "pixi.js";
import { SwitchTile, Tile, TileState, TileFactory } from "../stage/tiles";
import { Direction, DIRECTIONS, offsetOf } from "../stage/direction";
import { WaveTarget } from "../stage/fieldanim";
import { Field } from "../stage/field";

/**
 * 選択画面のタイル。**踏んでも `Used` にならない**（一筆書きではない）。
 *
 * ステージ用のタイルと同じ `Tile` を継承しているので、`Field` や
 * 座標変換・入退場アニメをそのまま使い回せる。
 */
export class FreeTile extends Tile {
  onEnter(solid: boolean): void {
    // 選択画面のタイルは消費されない
  }
}

/** 通れない壁 */
export class BlockedTile extends FreeTile {
  canEnter(): boolean {
    return false;
  }

  initGraphics(g: Graphics): void {
    g.roundRect(this.z-9, this.z-9, 18, 18, 3);
    g.fill({
      color: "#333333",
      alpha: 0.1
    });
    g.roundRect(-9, -9, 18, 18, 3);
    g.fill({
      color: "#333333",
      alpha: 0.35
    });
  }
}

/**
 * ステージの入口が隣接しているタイル（`&`）。
 * ここに立つと自機の上にステージ番号が出る。
 */
export class StageTile extends FreeTile {
  /** クリア済みなら中身が塗られる */
  cleared: boolean = false;

  setCleared(cleared: boolean) {
    this.cleared = cleared;
    this.initGraphics(this.g, cleared);
  }

  initGraphics(g: Graphics, cleared: boolean = this.cleared ?? false): void {
    g.clear();
    // --- 影 ---
    g.roundRect(this.z-10, this.z-10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.rect(this.z-4, this.z-4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: cleared ? 0.2 : 0.06
    });
    // --- 本体 ---
    g.roundRect(-10, -10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.rect(-4, -4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: cleared ? 0.8 : 0.25
    });
  }
}

/**
 * 選択画面のスイッチ（`a`〜`z`）。踏むと同じ id のレーザーが恒久的に止まる。
 *
 * 見た目とレーザーへの結線（`Field.addTile()`）はステージの `SwitchTile` そのまま。
 * 違うのは**踏んでも `Used` にならない**ことだけ。
 * 押されたことは進捗に保存され、次に選択画面を開いたときも押されたまま。
 */
export class SelectSwitchTile extends SwitchTile {
  onEnter(solid: boolean): void {
    this.pushed.value = true;
  }
}

/** 隠し床が 1 マスぶん現れるのにかける遅延（フレーム）。道が伸びていくように見せる */
const REVEAL_STEP = 4;

/**
 * クリア状況で現れる隠し床（`A`〜`Z`、ただし `S` を除く）。
 * 同じ文字の床は `revealTiles` イベントでまとめて現れる。現れるまでは見えず、通れない。
 */
export class HiddenTile extends FreeTile {
  /** どの `revealTiles` で現れるか。タイルの文字そのもの */
  group: string;
  revealed: boolean = false;
  /** フェードインを始めるまでの残りフレーム */
  private delay: number = 0;

  constructor(x: number, y: number, group: string) {
    super(TileState.Unused, x, y);
    this.group = group;
    this.targetAlpha = 0;
    this.g.alpha = 0;
  }

  canEnter(): boolean {
    return this.revealed;
  }

  /**
   * 床を出す。
   * @param order 道の何マス目か。この順に少しずつ遅れて現れる。負なら演出なしで即座に出す
   */
  reveal(order: number) {
    this.revealed = true;
    this.targetAlpha = 1;
    if(order < 0) {
      this.g.alpha = 1;
      this.delay = 0;
    } else {
      this.delay = order * REVEAL_STEP;
    }
  }

  update(t: Ticker) {
    if(this.delay > 0) {
      this.delay -= t.deltaTime;
      return;
    }
    super.update(t);
  }
}

/**
 * 選択マップの 1 文字 → タイル。
 * **ステージとは別のレジストリ。** 選択画面だけの記法をここに足す。
 * 小文字（スイッチ）と大文字（隠し床）は `createSelectTile()` が扱う。
 */
export const selectTileRegistry: Record<string, TileFactory> = {
  "S": (x, y) => new FreeTile(TileState.Unused, x, y),
  "#": (x, y) => new FreeTile(TileState.Unused, x, y),
  "&": (x, y) => new StageTile(TileState.Unused, x, y),
  "@": (x, y) => new BlockedTile(TileState.Unused, x, y)
};

/** 隠し床の文字か（`S` はスタートなので除く） */
export function isHiddenTileChar(c: string): boolean {
  return /^[A-Z]$/.test(c) && c !== "S";
}

/** タイルにならない文字なら null。選択画面と検証の両方がこれを使う */
export function createSelectTile(c: string, x: number, y: number): Tile|null {
  const factory = selectTileRegistry[c];
  if(factory !== undefined) return factory(x, y);
  if(/^[a-z]$/.test(c)) return new SelectSwitchTile(TileState.Unused, x, y, c);
  if(isHiddenTileChar(c)) return new HiddenTile(x, y, c);
  return null;
}

/**
 * 隠し床の現れる順番を決める。すでに歩ける床に隣接するマスから 0, 1, 2, … と数える。
 * 歩ける床に接していないグループ（飛び地）は全部 0 にする。
 */
export function revealOrder(field: Field, group: string): Map<HiddenTile, number> {
  const tiles = [...field.tiles.values()]
    .filter((t): t is HiddenTile => t instanceof HiddenTile && t.group === group);
  const order = new Map<HiddenTile, number>();
  const queue: Array<HiddenTile> = [];
  tiles.forEach(t => {
    const touches = DIRECTIONS.some(d => {
      const n = field.getAdjacentTile(t.x, t.y, d);
      return n !== null && !(n instanceof HiddenTile && n.group === group) && n.canEnter();
    });
    if(touches) {
      order.set(t, 0);
      queue.push(t);
    }
  });
  while(queue.length > 0) {
    const t = queue.shift()!;
    DIRECTIONS.forEach(d => {
      const n = field.getAdjacentTile(t.x, t.y, d);
      if(!(n instanceof HiddenTile) || n.group !== group || order.has(n)) return;
      order.set(n, order.get(t)! + 1);
      queue.push(n);
    });
  }
  tiles.forEach(t => {
    if(!order.has(t)) order.set(t, 0);
  });
  return order;
}

/**
 * `&` からステージへ向かう赤い三角の矢印。
 * `&` と（描画されない）マークのマスの中間に置かれる。
 */
export class ExitArrow implements WaveTarget {
  x: number;
  y: number;
  dir: Direction;
  z: number = 3;
  g: Graphics;

  constructor(x: number, y: number, dir: Direction) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.g = new Graphics();
    this.initGraphics(this.g);
  }

  initGraphics(g: Graphics) {
    g.clear();
    const d = offsetOf(this.dir);
    // 進行方向に尖った三角形。長さ 9、幅 14
    const tip = { x: d.x * 7, y: d.y * 7 };
    const back = { x: -d.x * 4, y: -d.y * 4 };
    const side = { x: d.y * 7, y: d.x * 7 };
    const poly = (ox: number, oy: number) => [
      { x: ox + tip.x, y: oy + tip.y },
      { x: ox + back.x + side.x, y: oy + back.y + side.y },
      { x: ox + back.x - side.x, y: oy + back.y - side.y }
    ];
    g.poly(poly(this.z, this.z));
    g.fill({
      color: "#e63333",
      alpha: 0.2
    });
    g.poly(poly(0, 0));
    g.fill({
      color: "#e63333",
      alpha: 0.8
    });
  }
}
