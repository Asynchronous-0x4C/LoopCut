import { Graphics } from "pixi.js";
import { Tile, TileState, TileFactory } from "../stage/tiles";
import { Direction, offsetOf } from "../stage/direction";
import { WaveTarget } from "../stage/fieldanim";

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
 * 選択マップの 1 文字 → タイル。
 * **ステージとは別のレジストリ。** 選択画面だけの記法をここに足す。
 */
export const selectTileRegistry: Record<string, TileFactory> = {
  "S": (x, y) => new FreeTile(TileState.Unused, x, y),
  "#": (x, y) => new FreeTile(TileState.Unused, x, y),
  "&": (x, y) => new StageTile(TileState.Unused, x, y),
  "@": (x, y) => new BlockedTile(TileState.Unused, x, y)
};

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
