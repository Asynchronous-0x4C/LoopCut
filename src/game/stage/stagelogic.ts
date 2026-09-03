import { Ticker } from "pixi.js";
import { Stage } from "./stage";
import { key } from "../../main";
import { Direction, EndTile, SwitchTile, Tile, TileState } from "./field";
import { Ghost } from "./ghost";
import { Player } from "./player";

export enum LogicState {
  Start,
  Loop,
  Next,
  End
}

export class StageLogic {
  stage: Stage;
  state: LogicState = LogicState.Start;
  time: number = -20;

  inputAvailable = false;
  remainSteps: number;
  selfReset = false;

  constructor(stage: Stage) {
    this.stage = stage;
    this.remainSteps = stage.steps;
    const pt = stage.field.getTile(stage.player.grid.x, stage.player.grid.y);
    pt!.state.value = TileState.Used;
    if(pt instanceof SwitchTile) {
      pt.pushed.value = true;
    }
    stage.ghosts.forEach(g => {
      const t = stage.field.getTile(g.grid.x, g.grid.y);
      if(g.remainSteps.value > 0){
        t!.state.value = TileState.Used;
        --g.remainSteps.value;
      }
      if(t instanceof SwitchTile) {
        t.pushed.value = true;
      }
    });
  }

  update(t: Ticker) {
    switch(this.state) {
      case LogicState.Start:
        this.time += t.deltaTime;
        if(this.time >= 50) {
          this.time = 50;
          this.state = LogicState.Loop;
        }
        break;
      case LogicState.Loop: this.loop(); break;
      case LogicState.Next:
        this.time -= t.deltaTime;
        if(this.time <= 0) {
          this.time = 0;
          this.stage.reset(this.selfReset);
        }
        break;
      case LogicState.End:
        this.time -= t.deltaTime;
        if(this.time <= 0) {
          this.time = 0;
          this.stage.load(this.stage.currentIndex + 1);
        }
        break;
    }
  }

  loop() {
    // リセットは移動キーより先に、独立して判定する（移動キーを押しながらでも効くように）
    if(key.keys.has('r')) {
      this.state = LogicState.Next;
      this.time = 70;
      this.selfReset = true;
      return;
    }
    for(let k of key.keys) {
      if(k === 'w' || k === 'a' || k === 's' || k === 'd') {
        if(!this.inputAvailable) break;
        let p = this.stage.player.grid;
        let dir;
        switch(k) {
          case "w": dir = Direction.Up; break;
          case "a": dir = Direction.Left; break;
          case "s": dir = Direction.Down; break;
          case "d": dir = Direction.Right; break;
        }
        const t = this.stage.field.getAdjacentTile(p.x, p.y, dir);
        if(t !== null && t.state.value === TileState.Unused) {
          if(this.next(this.stage.player, t, dir))break;
          this.stage.ghosts.forEach(g => {
            const dir = g.command.pop();
            if(dir == null) return;
            const t = this.stage.field.getAdjacentTile(g.grid.x, g.grid.y, dir);
            this.next(g, t, dir);
          });
          p = this.stage.player.grid;
          if(this.stage.field.isJammed(p.x, p.y)) {
            this.state = LogicState.Next;
            this.time = 70;
            break;
          }
        }
        break;
      }
    }
    if(!key.pressed) {
      this.inputAvailable = true;
    }
  }

  next(e: Player|Ghost, t: Tile|null, dir: Direction): boolean {
    let p = e.grid;
    if((e instanceof Player || (e instanceof Ghost && e.remainSteps.value > 0)) && this.stage.field.existsLaser(p.x, p.y, dir)) {
      const dist = 0.5 * this.stage.field.gap - e.size * 0.5;
      switch(dir) {
        case Direction.Up: e.target.y -= dist; break;
        case Direction.Down: e.target.y += dist; break;
        case Direction.Right: e.target.x += dist; break;
        case Direction.Left: e.target.x -= dist; break;
      }
      this.state = LogicState.Next;
      this.time = 70;
      return true;
    }
    e.move(dir);
    p = e.grid;
    if(e instanceof Player || (e instanceof Ghost && e.remainSteps.value > 0))this.stage.field.getTile(p.x, p.y)!.state.value = TileState.Used;
    if(e instanceof Player){
      --this.remainSteps;
    } else if(e instanceof Ghost && e.remainSteps.value > 0) {
      --e.remainSteps.value;
    }
    this.inputAvailable = false;
    if(t instanceof EndTile) {
      this.state = LogicState.End;
      this.time = 70;
      return true;
    } else if(t instanceof SwitchTile) {
      t.pushed.value = true;
    }
    if(e instanceof Player && (this.remainSteps === 0 || this.stage.field.isJammed(p.x, p.y))) {
      this.state = LogicState.Next;
      this.time = 70;
      return true;
    }
    return false;
  }
}