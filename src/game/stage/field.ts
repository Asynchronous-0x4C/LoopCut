import { Container, Ticker } from "pixi.js";
import { Laser } from "./objects";
import { Direction, DIRECTIONS, offsetOf } from "./direction";
import { SwitchTile, Tile } from "./tiles";

/**
 * タイルとレーザーの集合。グリッド座標 → ワールド座標の変換も担う。
 *
 * PixiJS の Container を継承しているが、描画コンテキストは必要としないので
 * ヘッドレス（`bun run verify` のソルバ）でもそのまま使える。
 */
export class Field extends Container {
  tiles: Map<string, Tile> = new Map();
  lasers: Map<string, Laser> = new Map();
  aabb = {
    min: {
      x: 9999,
      y: 9999
    },
    max: {
      x: -9999,
      y: -9999
    }
  };
  offset = {
    x: 0,
    y: 0
  };
  manhattan = {
    min: 9999,
    max: -9999
  };
  gap: number = 60;

  /** ループ開始からの経過ターン数。1 ターン = プレイヤーが 1 歩動くこと */
  turn: number = 0;

  constructor(){
    super();
  }

  update(t: Ticker) {
    this.tiles.forEach(c => {
      c.update(t);
    });
    this.lasers.forEach(l => {
      l.update(t);
    })
  }

  /**
   * 1 ターン経過を通知する。ターン数で挙動が変わるギミックはここから駆動する
   * （dev-docs/04-recipes.md レシピ B）。
   */
  nextTurn() {
    ++this.turn;
    this.lasers.forEach(l => {
      l.onTurn(this.turn);
    });
  }

  addTile(tile: Tile) {
    this.tiles.set(tile.key(), tile);
    this.aabb.min.x = Math.min(tile.x, this.aabb.min.x);
    this.aabb.max.x = Math.max(tile.x, this.aabb.max.x);
    this.aabb.min.y = Math.min(tile.y, this.aabb.min.y);
    this.aabb.max.y = Math.max(tile.y, this.aabb.max.y);
    this.manhattan.min = Math.min(tile.x + tile.y, this.manhattan.min);
    this.manhattan.max = Math.max(tile.x + tile.y, this.manhattan.max);
    // aabb.min を引かないと、左や上に空きがあるぶんフィールドが右下にずれる
    const w = (this.aabb.max.x - this.aabb.min.x + 1) * this.gap;
    const h = (this.aabb.max.y - this.aabb.min.y + 1) * this.gap;
    this.offset.x = (1280 - w + this.gap) * 0.5 - this.aabb.min.x * this.gap;
    this.offset.y = (720 - h + this.gap) * 0.5 - this.aabb.min.y * this.gap;
    this.addChild(tile.g);

    // スイッチとレーザーの結線は Field が持つ。
    // タイル側に Field への参照を持たせないことで循環参照を避けている。
    if(tile instanceof SwitchTile) {
      tile.pushed.addListener((p, c) => {
        if(c) this.deactivateLasers(tile.id);
      });
    }
  }

  addLaser(laser: Laser) {
    this.lasers.set(laser.key(), laser);
    this.addChild(laser.g);
  }

  /** 指定 id のレーザーを恒久的に止める */
  deactivateLasers(id: string) {
    this.lasers.forEach(l => {
      if(l.id === id) l.deactivate();
    });
  }

  getTile(x: number, y:number): Tile|null {
    return this.tiles.get(`${x},${y}`) ?? null;
  }

  getAdjacentTile(x: number, y:number, dir: Direction): Tile|null {
    const d = offsetOf(dir);
    return this.getTile(x + d.x, y + d.y);
  }

  hasAdjacentTile(x: number, y:number, dir: Direction): boolean {
    const d = offsetOf(dir);
    return this.tiles.has(`${x + d.x},${y + d.y}`);
  }

  /**
   * 4 方向すべてが塞がっているか（＝そのループはもう詰み）。
   * 「進入できるタイルがあり、かつその辺にアクティブなレーザーが無い」方向が
   * 1 つでもあれば詰みではない。
   */
  isJammed(x: number, y: number): boolean {
    for(const d of DIRECTIONS) {
      const t = this.getAdjacentTile(x, y, d);
      if(t !== null && t.canEnter() && !this.existsLaser(x, y, d)) return false;
    }
    return true;
  }

  /** (x,y) から dir へ動くとき、その辺にアクティブなレーザーがあるか */
  existsLaser(x: number, y:number, dir: Direction): boolean {
    const d = offsetOf(dir);
    const l = this.lasers.get(`${x + d.x * 0.5},${y + d.y * 0.5}`);
    return l != null && l.active.value;
  }

  gridToWorld(x: number, y: number) {
    return {x: this.offset.x + x * this.gap, y: this.offset.y + y * this.gap};
  }
}
