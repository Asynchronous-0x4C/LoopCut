import { Container, Ticker } from "pixi.js";
import { Stage } from "./stage";
import { app } from "../../main";
import { LogicState } from "./stagelogic";

export class StageView extends Container {
  stage: Stage;

  constructor(stage: Stage) {
    super();
    this.stage = stage;

    stage.player.x = stage.player.target.x = stage.field.offset.x + stage.player.grid.x * stage.field.gap;
    stage.player.y = stage.player.target.y = stage.field.offset.y + stage.player.grid.y * stage.field.gap;
    this.addChild(stage.player);

    stage.ghosts.forEach(g => {
      g.x = g.target.x = stage.field.offset.x + g.grid.x * stage.field.gap;
      g.y = g.target.y = stage.field.offset.y + g.grid.y * stage.field.gap;
    });
    if(stage.ghosts.length > 0)this.addChild(...stage.ghosts);

    const f = this.stage.field;
    if(f.tiles.size > 0) {
      f.tiles.forEach(t => {
        t.g.x = f.offset.x + t.x * f.gap;
        t.g.y = f.offset.y + t.y * f.gap;
      });
      f.lasers.forEach(l => {
        l.g.x = f.offset.x + l.x * f.gap;
        l.g.y = f.offset.y + l.y * f.gap;
      });
    }
  }

  update(t: Ticker) {
    const time = Math.max(0, Math.min(this.stage.logic.time, 50));
    const m = this.stage.field.manhattan.max - this.stage.field.manhattan.min;
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