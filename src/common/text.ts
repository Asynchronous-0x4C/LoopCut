import type { TextStyleOptions } from "pixi.js";

/**
 * 本文テキストの共通スタイル。`new Text({ text, style: bodyTextStyle })` のように渡す。
 * 影の付け方・色の根拠は dev-docs/05-visual-style.md。
 *
 * TextStyle のインスタンスではなくプレーンなオプションを export しているのは、
 * Text ごとに独立した TextStyle が作られるようにするため（共有インスタンスを
 * どこかで書き換えると全テキストに波及してしまう）。
 */
export const bodyTextStyle: TextStyleOptions = {
  fontFamily: "Noto Sans JP",
  fontSize: 25,
  fill: 0x646464,
  dropShadow: {
    color: "#646464",
    blur: 0,
    distance: 3,
    alpha: 0.25
  }
};
