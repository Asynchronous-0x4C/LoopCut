import { Graphics } from "pixi.js";
import { Entity } from "./entity";
import { Direction, opposite } from "./direction";
import { Player } from "./player";
import { ObservableValue } from "../../common/observable";

/**
 * 直前のループのプレイヤーの分身。
 *
 * プレイヤーの終点から出発し、その軌跡を逆再生して始点へ向かう。
 * `remainSteps`（＝プレイヤーが余らせた歩数）が残っている間だけ実体を持つ。
 * 詳細は dev-docs/02-game-rules.md。
 */
export class Ghost extends Entity {
  /** 逆再生用のコマンド列。末尾から pop して消費する */
  command: Array<Direction> = new Array();

  /** 実体でいられる残り歩数 */
  remainSteps: ObservableValue<number>;

  g: Graphics;

  constructor(player: Player, remain: number) {
    super(player.grid, player.gap);
    this.remainSteps = new ObservableValue(remain);
    player.command.forEach(c => {
      this.command.push(opposite(c));
    });

    this.g = new Graphics();
    this.initGraphics(this.g);

    this.remainSteps.addListener((p, c) => {
      this.initGraphics(this.g, c > 0);
    });

    this.addChild(this.g);
  }

  get solid(): boolean {
    return this.remainSteps.value > 0;
  }

  initGraphics(g: Graphics, remain: boolean = (this.remainSteps?.value ?? 0) > 0) {
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
}
