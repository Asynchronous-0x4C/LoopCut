import { FillGradient, Graphics } from "pixi.js";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen";

/**
 * ステージと選択画面で共通の背景。左上から右下への薄いグラデーション。
 * 色の根拠は dev-docs/05-visual-style.md。
 */
export function createBackground(): Graphics {
  const g = new Graphics();
  const gradient = new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: SCREEN_WIDTH, y: SCREEN_HEIGHT }
  });
  gradient.addColorStop(0, "#f0f0f0");
  gradient.addColorStop(1, "#e0e0e0");
  g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  g.fill(gradient);
  return g;
}
