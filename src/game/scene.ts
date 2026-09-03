import { Container, Ticker } from "pixi.js";
import { Game } from "./game";

export abstract class Scene {
  abstract game: Game;
  container: Container = new Container();

  /**
   * このシーンに入るたびに呼ばれる（`Game.setScene()` から）。
   * **再入場を想定した初期化はコンストラクタではなくここに書く。**
   * シーンは起動時に 1 度だけ生成され、以降は使い回されるため。
   */
  enter(): void {}

  /** このシーンから出るときに呼ばれる */
  exit(): void {}

  abstract update(t: Ticker): void;
}
