import { Container, Ticker } from "pixi.js";
import { Stage } from "./stage";
import { app } from "../../main";
import { LogicState } from "./stagelogic";

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
  }

  update(t: Ticker) {
    const time = Math.max(0, Math.min(this.stage.logic.time, 50));
    // タイルが 1 枚だけだと max === min になるので 0 除算を避ける
    const m = Math.max(1, this.stage.field.manhattan.max - this.stage.field.manhattan.min);
    let s = 1;
    switch(this.stage.logic.state) {
      case LogicState.Start: s = 1; break;
      case LogicState.Loop: break;
      case LogicState.End: s = -1; break;
    }
    this.stage.field.tiles.forEach((v, k) => {
      const _m = v.x + v.y - this.stage.field.manhattan.min;
      const x = Math.max(0, 10 + (20 / m * _m) - time) / 10;
      v.g.pivot.y = app.screen.height * x * x * x * x * s;
    });
    this.stage.field.lasers.forEach((v, k) => {
      const _m = v.x + v.y - this.stage.field.manhattan.min;
      const x = Math.max(0, 10 + (20 / m * _m) - time) / 10;
      v.g.pivot.y = app.screen.height * x * x * x * x * s;
    });
    const x = Math.max(0, time - 45);
    this.stage.player.alpha = Math.ceil(Math.sin(x * Math.PI * 0.5)) * Math.ceil(x / 3);
    this.stage.ghosts.forEach(g => {
      g.alpha = this.stage.player.alpha;
    });
    this.stage.ui.alpha = this.stage.player.alpha;
  }
}