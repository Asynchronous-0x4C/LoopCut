import { Graphics, Ticker } from "pixi.js";
import { Entity } from "./entity";
import { Direction } from "./field";

export class Player extends Entity {
  size: number = 40;
  z: number = 3;
  target = {
    x: 0,
    y: 0
  };
  gap: number;

  command: Array<Direction> = new Array();

  constructor(start: {x: number, y: number}, gap: number) {
    super();
    this.interactive = true;
    this.grid = this.start = start;
    this.gap = gap;

    const g = new Graphics();
    g.roundRect(this.z-this.size*0.5, this.z-this.size*0.5, this.size, this.size, 4);
    g.fill({
      color: "#646464",
      alpha: 0.3
    });
    g.roundRect(-this.size*0.5, -this.size*0.5, this.size, this.size, 4);
    g.fill({
      color: "#646464",
      alpha: 0.9
    });

    this.addChild(g);
  }

  update(t: Ticker): void {
    this.x += (this.target.x - this.x) * 0.5;
    this.y += (this.target.y - this.y) * 0.5;
  }

  move(dir: Direction) {
    this.command.push(dir);
    switch(dir) {
      case Direction.Up: --this.grid.y; this.target.y -= this.gap; break;
      case Direction.Down: ++this.grid.y; this.target.y += this.gap; break;
      case Direction.Right: ++this.grid.x; this.target.x += this.gap; break;
      case Direction.Left:--this.grid.x; this.target.x -= this.gap; break;
    }
  }
}