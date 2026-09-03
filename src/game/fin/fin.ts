import { Text, Ticker } from "pixi.js";
import { Game } from "../game";
import { Scene } from "../scene";
import { startTime } from "../../main";
import { bodyTextStyle } from "../../common/text";

export class Fin extends Scene {
  game: Game;
  time: number|null = null;
  text: Text| null = null;

  constructor(game: Game) {
    super();
    this.game = game;
  }

  update(t: Ticker): void {
    if(this.time === null) {
      this.time = Date.now();
      const t = Math.round((this.time - startTime) / 1000);
      this.text = new Text({
        text: `Thank you for playing!\nプレイ時間: ${Math.floor(t / 60)}:${`${t % 60}`.padStart(2,"0")}`,
        style: bodyTextStyle
      });
      this.text.anchor = {x: 0.5, y: 0.5};
      this.text.y = 360;
      this.text.x = 640;
      this.container.addChild(this.text);
    }
  }
  
}