import { Ticker } from "pixi.js";
import { Scene } from "./scene";
import { Stage } from "./stage/stage";
import { app } from "../main";
import { Title } from "./title/title";
import { Fin } from "./fin/fin";

export class Game {
  scenes: Map<string,Scene> = new Map();
  current: string = "";

  constructor(){
    this.scenes.set("title",new Title(this));
    this.scenes.set("game",new Stage(this));
    this.scenes.set("fin",new Fin(this));
    this.setScene("title");
  }

  setScene(scene: string) {
    const c = this.scenes.get(this.current);
    if(c) app.stage.removeChild(c.container);
    this.current = scene;
    const n = this.scenes.get(this.current);
    if(n) app.stage.addChild(n.container);
  }

  getScene() {
    return this.scenes.get(this.current);
  }

  update(t: Ticker) {
    this.scenes.get(this.current)?.update(t);
  }
}