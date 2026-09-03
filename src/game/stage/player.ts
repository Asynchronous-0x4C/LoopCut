import { Graphics } from "pixi.js";
import { Entity } from "./entity";
import { Direction } from "./direction";
import { GridPosition } from "./stagedata";

export class Player extends Entity {
  /** このループでの移動履歴。次のループのゴーストの経路になる */
  command: Array<Direction> = new Array();

  constructor(start: GridPosition, gap: number) {
    super(start, gap);
    this.interactive = true;

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

  /** プレイヤーは常に実体を持つ */
  get solid(): boolean {
    return true;
  }

  move(dir: Direction) {
    this.command.push(dir);
    super.move(dir);
  }
}
