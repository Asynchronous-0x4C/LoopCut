import { Graphics, Ticker } from "pixi.js";
import { Entity } from "./entity";
import { Direction } from "./field";
import { Player } from "./player";
import { ObservableValue } from "../../common/observable";

export class Ghost extends Entity {
  command: Array<Direction> = new Array();

  z: number = 3;
  size: number = 40;
  target = {
    x: 0,
    y: 0
  };
  gap: number;

  g: Graphics;

  remainSteps: ObservableValue<number> = new ObservableValue(0);

  constructor(player: Player, remain: number) {
    super();
    this.grid = player.grid;
    this.gap = player.gap;
    this.remainSteps = new ObservableValue(remain);
    player.command.forEach(c => {
      switch(c) {
        case Direction.Up: this.command.push(Direction.Down); break;
        case Direction.Down: this.command.push(Direction.Up); break;
        case Direction.Right: this.command.push(Direction.Left); break;
        case Direction.Left: this.command.push(Direction.Right); break;
      }
    });
    
    this.g = new Graphics();
    this.initGraphics(this.g);

    this.remainSteps.addListener((p, c) => {
      this.initGraphics(this.g, c > 0);
    });

    this.addChild(this.g);
  }

  initGraphics(g: Graphics, remain: boolean = this.remainSteps.value > 0) {
    g.clear();
    if(remain) {
      g.roundRect(this.z-this.size*0.5 + 1.25, this.z-this.size*0.5 + 1.25, this.size - 2.5, this.size - 2.5, 4);
      g.stroke({
        width: 5,
        color: "#646464",
        alpha: 0.2
      });
      g.roundRect(this.z-this.size*0.35, this.z-this.size*0.35, this.size*0.7, this.size*0.7, 2);
      g.fill({
        color: "#646464",
        alpha: 0.2
      });
      g.roundRect(-this.size*0.5 + 1.25, -this.size*0.5 + 1.25, this.size - 2.5, this.size - 2.5, 4);
      g.stroke({
        width: 5,
        color: "#646464",
        alpha: 0.9
      });
      g.roundRect(-this.size*0.35, -this.size*0.35, this.size*0.7, this.size*0.7, 2);
      g.fill({
        color: "#646464",
        alpha: 0.9
      });
    } else {
      g.roundRect(-this.size*0.5 + 1.25, -this.size*0.5 + 1.25, this.size - 2.5, this.size - 2.5, 4);
      g.stroke({
        width: 5,
        color: "#646464",
        alpha: 0.5
      });
      g.roundRect(-this.size*0.35, -this.size*0.35, this.size*0.7, this.size*0.7, 2);
      g.fill({
        color: "#646464",
        alpha: 0.5
      });
    }
  }

  update(t: Ticker): void {
    this.x += (this.target.x - this.x) * 0.5;
    this.y += (this.target.y - this.y) * 0.5;
  }

  move(dir: Direction) {
    switch(dir) {
      case Direction.Up: --this.grid.y; this.target.y -= this.gap; break;
      case Direction.Down: ++this.grid.y; this.target.y += this.gap; break;
      case Direction.Right: ++this.grid.x; this.target.x += this.gap; break;
      case Direction.Left:--this.grid.x; this.target.x -= this.gap; break;
    }
  }
}