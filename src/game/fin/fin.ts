import { Text, Ticker } from "pixi.js";
import type { Game } from "../game";
import { Scene } from "../scene";
import { key, startTime } from "../../main";
import { bodyTextStyle } from "../../common/text";

export class Fin extends Scene {
  game: Game;
  text: Text|null = null;
  /** 入った時点で押されているキー（クリアした一歩）を離すまで、入力を受け付けない */
  private waitRelease: boolean = true;

  constructor(game: Game) {
    super();
    this.game = game;
  }

  /**
   * 表示物はここで作る。コンストラクタではなく `enter()` に置くことで、
   * 再入場しても正しく作り直され、入った最初のフレームから中身が見える。
   */
  enter(): void {
    if(this.text !== null) {
      this.container.removeChild(this.text);
      this.text.destroy();
    }
    const seconds = Math.round((Date.now() - startTime) / 1000);
    this.waitRelease = true;
    this.text = new Text({
      text: `Thank you for playing!\nプレイ時間: ${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, "0")}\n\nキーを押すとマップへ戻る`,
      style: bodyTextStyle
    });
    this.text.anchor = {x: 0.5, y: 0.5};
    this.text.x = 640;
    this.text.y = 360;
    this.container.addChild(this.text);
  }

  update(t: Ticker): void {
    if(!key.pressed) {
      this.waitRelease = false;
    } else if(!this.waitRelease) {
      this.game.leaveFin();
    }
  }
}
