import { Container, Ticker } from "pixi.js";
import { Direction, offsetOf } from "./direction";
import { GridPosition } from "./stagedata";
import { damp } from "../../common/interpolate";

/**
 * グリッド上を 1 マスずつ動くもの（プレイヤーとゴースト）。
 * 移動・補間・レーザーへの突っ込み演出はここに集約してある。
 */
export abstract class Entity extends Container {
  /** グリッド座標。ワールド座標は Field.gridToWorld() で得る */
  grid: GridPosition;
  gap: number;
  size: number = 40;
  z: number = 3;

  /** 補間の目標ワールド座標 */
  target = {
    x: 0,
    y: 0
  };

  constructor(grid: GridPosition, gap: number) {
    super();
    // 呼び出し元のオブジェクトを共有しないようコピーする
    this.grid = { x: grid.x, y: grid.y };
    this.gap = gap;
  }

  /**
   * 実体を持つか。
   * 実体があるときだけタイルを消費し、レーザーに阻まれる。
   */
  abstract get solid(): boolean;

  update(t: Ticker): void {
    const k = damp(0.5, t.deltaTime);
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
  }

  move(dir: Direction) {
    const d = offsetOf(dir);
    this.grid.x += d.x;
    this.grid.y += d.y;
    this.target.x += d.x * this.gap;
    this.target.y += d.y * this.gap;
  }

  /** レーザーに阻まれたときの「半歩突っ込んで止まる」演出 */
  bump(dir: Direction) {
    const d = offsetOf(dir);
    const dist = 0.5 * this.gap - this.size * 0.5;
    this.target.x += d.x * dist;
    this.target.y += d.y * dist;
  }
}
