import { Container, Ticker } from "pixi.js";
import { Stage } from "./stage";
import { LogicState } from "./stagelogic";
import { applyWave, entityAlpha } from "./fieldanim";

export class StageView extends Container {
  stage: Stage;

  constructor(stage: Stage) {
    super();
    this.stage = stage;

    const f = this.stage.field;

    const pw = f.gridToWorld(stage.player.grid.x, stage.player.grid.y);
    stage.player.x = stage.player.target.x = pw.x;
    stage.player.y = stage.player.target.y = pw.y;
    this.addChild(stage.player);

    stage.ghosts.forEach(g => {
      const w = f.gridToWorld(g.grid.x, g.grid.y);
      g.x = g.target.x = w.x;
      g.y = g.target.y = w.y;
    });
    if(stage.ghosts.length > 0)this.addChild(...stage.ghosts);

    if(f.tiles.size > 0) {
      f.tiles.forEach(t => {
        const w = f.gridToWorld(t.x, t.y);
        t.g.x = w.x;
        t.g.y = w.y;
      });
      f.lasers.forEach(l => {
        const w = f.gridToWorld(l.x, l.y);
        l.g.x = w.x;
        l.g.y = w.y;
      });
    }

    // 構築した直後のフレームは update() が回らないまま描画される。
    // ここで初期状態を適用しておかないと、完成形が 1 フレームだけ見えてしまう。
    this.apply();
  }

  update(t: Ticker) {
    this.apply();
  }

  private apply() {
    const dir = this.stage.logic.state === LogicState.End ? -1 : 1;
    applyWave(this.stage.field, this.stage.logic.time, dir);

    const alpha = entityAlpha(this.stage.logic.time);
    this.stage.player.alpha = alpha;
    this.stage.ghosts.forEach(g => {
      g.alpha = alpha;
    });
    this.stage.ui.alpha = alpha;
  }
}
