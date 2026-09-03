import { Ticker } from "pixi.js";
import { Scene } from "./scene";
import { Stage } from "./stage/stage";
import { app } from "../main";
import { Title } from "./title/title";
import { Fin } from "./fin/fin";
import { Select } from "./select/select";
import { selectMaps } from "./select/maps";
import { allStageLabels } from "./select/validate";
import { isCleared } from "../common/progress";

export class Game {
  scenes: Map<string,Scene> = new Map();
  current: string = "";

  constructor(){
    this.scenes.set("title",new Title(this));
    this.scenes.set("select",new Select(this));
    this.scenes.set("game",new Stage(this));
    this.scenes.set("fin",new Fin(this));
    this.setScene("title");
  }

  setScene(scene: string) {
    const c = this.scenes.get(this.current);
    if(c) {
      c.exit();
      app.stage.removeChild(c.container);
    }
    this.current = scene;
    const n = this.scenes.get(this.current);
    if(n) {
      app.stage.addChild(n.container);
      n.enter();
    }
  }

  getScene() {
    return this.scenes.get(this.current);
  }

  /**
   * ステージ選択画面を開く。
   * シーン同士が互いを import しないよう、遷移はすべて Game が仲介する。
   */
  openSelect(worldIndex: number = 0) {
    const select = this.scenes.get("select");
    if(select instanceof Select) select.prepare(worldIndex);
    this.setScene("select");
  }

  /** 選択画面からステージへ入る */
  playStage(index: number, label: string) {
    const stage = this.scenes.get("game");
    this.setScene("game");
    if(stage instanceof Stage) stage.load(index, label);
  }

  /** ステージをクリアして選択画面へ戻る。全ステージ制覇していたらクリア画面へ */
  returnToSelect(clearedLabel: string) {
    if(allStageLabels(selectMaps).every(isCleared)) {
      this.setScene("fin");
      return;
    }
    const select = this.scenes.get("select");
    if(select instanceof Select) select.prepareReturn(clearedLabel);
    this.setScene("select");
  }

  update(t: Ticker) {
    this.scenes.get(this.current)?.update(t);
  }
}
