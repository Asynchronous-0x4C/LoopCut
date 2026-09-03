/**
 * 論理解像度。**ゲームコードは常にこの座標系で書く。**
 *
 * 実際のキャンバスはウィンドウに合わせて `app.stage.scale` で拡縮される
 * （[main.ts](../main.ts) の `resize()`）。
 * そのため `app.screen.width/height` は**ウィンドウ依存の実ピクセル値**であり、
 * ゲーム内の位置やアニメーションの距離に使ってはいけない。
 */
export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;
