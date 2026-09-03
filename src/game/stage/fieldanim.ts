import { Container } from "pixi.js";
import { SCREEN_HEIGHT } from "../../common/screen";
import { Field } from "./field";

/** 入退場アニメの対象。グリッド座標と、動かす表示オブジェクトを持つもの */
export interface WaveTarget {
  x: number;
  y: number;
  g: Container;
}

/**
 * 「マンハッタン距離の波」でフィールドをせり上げ／沈める。
 * 左上のタイルから順に画面外から降ってくる（dir = 1）／画面外へ抜ける（dir = -1）。
 *
 * 描画規約は dev-docs/05-visual-style.md。ステージと選択画面で共有している。
 *
 * @param time 0〜50 にクランプされる進行度
 * @param dir  1 で下から、-1 で上へ
 * @param extra タイルとレーザー以外に一緒に動かすもの（矢印など）
 */
export function applyWave(
  field: Field,
  time: number,
  dir: number,
  extra?: Iterable<WaveTarget>
) {
  const t = Math.max(0, Math.min(time, 50));
  // タイルが 1 枚だけだと max === min になるので 0 除算を避ける
  const m = Math.max(1, field.manhattan.max - field.manhattan.min);

  const apply = (v: WaveTarget) => {
    const _m = v.x + v.y - field.manhattan.min;
    const x = Math.max(0, 10 + (20 / m * _m) - t) / 10;
    // 飛距離は論理高さで固定する。app.screen.height（ウィンドウ依存の実ピクセル）を
    // 使うと、ウィンドウが小さいときにタイルが画面外まで飛びきらず見えてしまう
    v.g.pivot.y = SCREEN_HEIGHT * x * x * x * x * dir;
  };

  field.tiles.forEach(apply);
  field.lasers.forEach(apply);
  if(extra !== undefined) {
    for(const v of extra) apply(v);
  }
}

/**
 * プレイヤーなど「実体」の点滅フェードイン。
 * time が 45 を超えてから数フレーム明滅して現れる。
 */
export function entityAlpha(time: number): number {
  const x = Math.max(0, Math.min(time, 50) - 45);
  // この式は -1 や 2 も返す。明滅のパターンは保ったまま 0..1 に収める
  const v = Math.ceil(Math.sin(x * Math.PI * 0.5)) * Math.ceil(x / 3);
  return Math.max(0, Math.min(1, v));
}
