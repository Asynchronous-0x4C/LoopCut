import { Graphics, Text, Ticker } from "pixi.js";
import { Scene } from "../scene";
import { Game } from "../game";
import { key } from "../../main";
import { bodyTextStyle } from "../../common/text";
import { damp } from "../../common/interpolate";// @ts-ignore
import loopcut from "../../assets/loopcut.svg?raw";
import { Stage } from "../stage/stage";

export class Title extends Scene {
  game: Game;
  text: Text;
  logo: Graphics;

  time: number = 30;
  keypressed: boolean = false;

  constructor(game: Game) {
    super();
    this.game = game;
    this.text = new Text({
      text: "> キーを押してスタート <",
      style: bodyTextStyle
    });
    this.text.anchor = {x: 0.5, y: 0.5};
    this.text.y = 680;
    this.text.x = 640;
    this.container.addChild(this.text);
    this.logo = new Graphics();
    this.logo.svg(loopcut);
    this.logo.scale.set(2);
    this.logo.pivot.set(this.logo.width * 0.25, this.logo.height * 0.25);
    this.logo.x = 640;
    this.logo.y = 200;
    this.logo.tint = "#888888";
    const g = new Graphics();
    g.svg(loopcut);
    g.x = 2;
    g.y = 2;
    g.tint = "#888888";
    g.alpha = 0.25;
    this.logo.alpha = 0.8;
    this.logo.addChild(g);
    this.container.addChild(this.logo);
  }

  update(t: Ticker): void {
    if(key.pressed) {
      this.keypressed = true;
    }
    if(this.keypressed) {
      this.time -= t.deltaTime;
      this.text.alpha += -this.text.alpha * damp(0.5, t.deltaTime);
      const x = Math.min(5, Math.max(0, this.time - 10));
      this.logo.alpha = Math.ceil(Math.sin(x * Math.PI * 0.5)) * Math.ceil(x / 3) * 0.8;
    }
    if(this.time <= 0) {
      this.game.setScene("game");
      const s = this.game.getScene();
      if(s instanceof Stage) {
        s.load(0);
      }
    }
  }
}