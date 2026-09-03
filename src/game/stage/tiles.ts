import { Graphics, Ticker } from "pixi.js";
import { ObservableValue } from "../../common/observable";
import { damp } from "../../common/interpolate";

export enum TileState {
  Used,
  Unused
}

/**
 * グリッド上の足場。
 *
 * ルール（`canEnter` / `onEnter` / `isGoal`）と見た目（`g`）の両方を持つ。
 * PixiJS の `Graphics` は描画コンテキストが無くても構築できるので、
 * このクラスはヘッドレス（`bun run verify` のソルバ）でもそのまま使える。
 *
 * 新しいタイルを足す手順は dev-docs/04-recipes.md レシピ A。
 */
export class Tile {
  state: ObservableValue<TileState>;
  x: number;
  y: number;
  z: number = 3;
  targetAlpha: number = 1;

  g: Graphics;

  constructor(state: TileState, x: number, y: number) {
    this.state = new ObservableValue(state);
    this.x = x;
    this.y = y;

    this.g = new Graphics();
    this.initGraphics(this.g);

    this.state.addListener((p, c) => {
      if(p === TileState.Unused && c === TileState.Used) {
        this.targetAlpha = 0.2;
      } else if(p === TileState.Used && c === TileState.Unused) {
        this.targetAlpha = 1;
      }
    });
  }

  /** このタイルに進入できるか */
  canEnter(): boolean {
    return this.state.value === TileState.Unused;
  }

  /**
   * 進入されたときに呼ばれる。
   * @param solid 実体を持つエンティティか。非実体のゴーストはタイルを消費しない
   */
  onEnter(solid: boolean): void {
    if(solid) this.state.value = TileState.Used;
  }

  /** ここに進入したらステージクリアか */
  get isGoal(): boolean {
    return false;
  }

  /**
   * ソルバが「同じ状態か」を判定するための指紋。
   *
   * **状態を持つタイルを追加したら、必ず override してその状態を混ぜること。**
   * 混ぜ忘れると、ソルバが異なる状態を同一とみなして探索を打ち切り、
   * 解けるステージを「解けない」と誤判定する。
   */
  fingerprint(): string {
    return this.state.value === TileState.Used ? "U" : "-";
  }

  initGraphics(g: Graphics) {
    g.circle(this.z, this.z, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.circle(0, 0, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
  }

  key(): string {
    return `${this.x},${this.y}`;
  }

  update(t: Ticker) {
    this.g.alpha += (this.targetAlpha - this.g.alpha) * damp(0.4, t.deltaTime);
  }
}

export class StartTile extends Tile {

  initGraphics(g: Graphics): void {
    g.roundRect(this.z-10, this.z-10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.roundRect(-10, -10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.poly([
      {x: this.z-3, y:this.z+5 },
      {x: this.z-3, y:this.z-5 },
      {x: this.z+5.5, y:this.z }
    ]);
    g.fill({
      color: "#e63333",
      alpha: 0.2
    });
    g.poly([
      {x: -3, y:5 },
      {x: -3, y:-5 },
      {x: 5.5, y:0 }
    ]);
    g.fill({
      color: "#e63333",
      alpha: 0.8
    });
  }
}

export class EndTile extends Tile {

  get isGoal(): boolean {
    return true;
  }

  initGraphics(g: Graphics): void {
    g.roundRect(this.z-10, this.z-10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.roundRect(-10, -10, 20, 20, 4);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.rect(this.z-4, this.z-4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: 0.2
    });
    g.rect(-4, -4, 8, 8);
    g.fill({
      color: "#e63333",
      alpha: 0.8
    });
  }
}

/**
 * 踏むと同じ id のレーザーを止めるタイル。
 *
 * 「どのレーザーを止めるか」はこのクラスではなく `Field.addTile()` が配線する。
 * タイルが Field を参照しないことで、tiles.ts と field.ts の循環参照を避けている。
 */
export class SwitchTile extends Tile {
  id: string;
  pushed: ObservableValue<boolean>;

  constructor(state: TileState, x: number, y: number, id: string) {
    super(state, x, y);
    this.pushed = new ObservableValue(false);
    this.id = id;
    this.pushed.addListener((p, c) => {
      if(c) this.initGraphics(this.g, c);
    });
  }

  /** 実体の有無に関係なく押せる。ステージ 2 の解法の核心（dev-docs/02-game-rules.md） */
  onEnter(solid: boolean): void {
    super.onEnter(solid);
    this.pushed.value = true;
  }

  fingerprint(): string {
    return super.fingerprint() + (this.pushed.value ? "P" : "-");
  }

  initGraphics(g: Graphics, pushed: boolean = this.pushed?.value ?? false): void {
    g.clear();
    g.circle(this.z, this.z, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    g.circle(0, 0, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    g.circle(this.z, this.z, 5);
    g.fill({
      color: pushed ? "#a4b1b2" : "#5fc3c9",
      alpha: 0.2
    });
    g.circle(0, 0, 5);
    g.fill({
      color: pushed ? "#a4b1b2" : "#5fc3c9",
      alpha: 0.8
    });
  }
}

/**
 * 2 回まで通れるタイル。一筆書きの制約を局所的にゆるめる。
 * 追加手順は dev-docs/04-recipes.md レシピ A の実例そのもの。
 */
export class DoubleTile extends Tile {
  remain: ObservableValue<number>;

  constructor(state: TileState, x: number, y: number) {
    super(state, x, y);
    this.remain = new ObservableValue(2);
    this.remain.addListener((p, c) => this.initGraphics(this.g, c));
  }

  canEnter(): boolean {
    return this.remain.value > 0;
  }

  onEnter(solid: boolean): void {
    // 実体を持たないゴーストは消費しない
    if(!solid) return;
    this.remain.value = this.remain.value - 1;
    if(this.remain.value <= 0) this.state.value = TileState.Used;
  }

  fingerprint(): string {
    return `${super.fingerprint()}${this.remain.value}`;
  }

  initGraphics(g: Graphics, remain: number = this.remain?.value ?? 2): void {
    g.clear();
    // --- 影 ---
    g.circle(this.z, this.z, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.2
    });
    if(remain > 1) {
      g.circle(this.z, this.z, 4.5);
      g.stroke({
        width: 2,
        color: "#333333",
        alpha: 0.2
      });
    }
    // --- 本体 ---
    g.circle(0, 0, 10);
    g.stroke({
      width: 3,
      color: "#333333",
      alpha: 0.8
    });
    if(remain > 1) {
      g.circle(0, 0, 4.5);
      g.stroke({
        width: 2,
        color: "#333333",
        alpha: 0.8
      });
    }
  }
}

export type TileFactory = (x: number, y: number) => Tile;

/**
 * ステージ JSON の 1 文字 → タイル。
 * **新しいタイルを足すときはここに 1 行足す。**
 * a-z は SwitchTile に予約済みなので、新しい文字は記号から選ぶこと。
 */
export const tileRegistry: Record<string, TileFactory> = {
  "S": (x, y) => new StartTile(TileState.Unused, x, y),
  "G": (x, y) => new EndTile(TileState.Unused, x, y),
  "#": (x, y) => new Tile(TileState.Unused, x, y),
  "@": (x, y) => new Tile(TileState.Used, x, y),
  "=": (x, y) => new DoubleTile(TileState.Unused, x, y)
};

/** タイルにならない文字なら null */
export function createTile(c: string, x: number, y: number): Tile|null {
  const factory = tileRegistry[c];
  if(factory !== undefined) return factory(x, y);
  if(/^[a-z]$/.test(c)) return new SwitchTile(TileState.Unused, x, y, c);
  return null;
}
