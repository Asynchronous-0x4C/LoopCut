import { Ticker } from "pixi.js";
import { Scene } from "./scene";
import { Stage } from "./stage/stage";
import { app } from "../main";
import { Title } from "./title/title";
import { Fin } from "./fin/fin";
import { Select } from "./select/select";
import { selectMaps } from "./select/maps";
import { allStageLabels } from "./select/validate";
import { isCleared, markCleared } from "../common/progress";

export class Game {
  scenes: Map<string,Scene> = new Map();
  current: string = "";
  /** 最後にクリアしたステージのラベル。クリア画面からマップへ戻るときにその入口へ立たせる */
  private lastCleared: string = "";

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

  /**
   * ステージをクリアして選択画面へ戻る。
   * **このクリアで初めて全ステージが揃ったときだけ**クリア画面へ行く。
   * 「全部クリア済みか」だけで判定すると、全クリア後に遊び直したステージを
   * クリアするたびにクリア画面へ飛んでしまう。
   */
  returnToSelect(clearedLabel: string) {
    const labels = allStageLabels(selectMaps);
    const wasComplete = labels.every(isCleared);
    if(clearedLabel !== "") markCleared(clearedLabel);
    this.lastCleared = clearedLabel;
    if(!wasComplete && labels.every(isCleared)) {
      this.setScene("fin");
      return;
    }
    this.showSelectAt(clearedLabel);
  }

  /** クリア画面から選択画面へ戻る */
  leaveFin() {
    this.showSelectAt(this.lastCleared);
  }

  private showSelectAt(label: string) {
    const select = this.scenes.get("select");
    if(select instanceof Select) select.prepareReturn(label);
    this.setScene("select");
  }

  update(t: Ticker) {
    this.scenes.get(this.current)?.update(t);
  }
}
