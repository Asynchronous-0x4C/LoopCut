import { key } from "../../main";
import { directionFromKey } from "./direction";
import { LogicState, StageLogic } from "./stagelogic";

/** 毎フレーム `StageLogic` に操作を与えるもの */
export interface StageInputSource {
  update(logic: StageLogic): void;
}

/**
 * キーボード入力を `StageLogic` の操作に翻訳する層。
 *
 * ルール側（`StageLogic`）がグローバルな入力状態に依存しないようにするために分けてある。
 * おかげでヘッドレスなソルバは同じ `StageLogic` を `tryMove()` で直接駆動できる。
 */
export class KeyboardInput implements StageInputSource {
  /**
   * 「キーを 1 回押すごとに 1 歩」を実現するためのフラグ。
   * キーが 1 つも押されていないフレームでのみ true に戻る。
   */
  private available: boolean = false;

  update(logic: StageLogic) {
    if(logic.state !== LogicState.Loop) return;

    // リセットは移動キーより先に、独立して判定する（移動キーを押しながらでも効くように）
    if(key.keys.has("r")) {
      logic.requestReset();
      return;
    }

    for(const k of key.keys) {
      const dir = directionFromKey(k);
      if(dir === null) continue;
      if(this.available && logic.tryMove(dir)) this.available = false;
      break;
    }

    if(!key.pressed) {
      this.available = true;
    }
  }
}
