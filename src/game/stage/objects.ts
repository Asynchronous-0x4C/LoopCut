import { Graphics, Ticker } from "pixi.js";
import { ObservableValue } from "../../common/observable";

export class Laser {
  x: number;
  y: number;
  id: string;
  active: ObservableValue<boolean> = new ObservableValue(true);

  g: Graphics;
  vertical: boolean;

  constructor(x: number, y: number, id: string) {
    this.x = x;
    this.y = y;
    this.id = id;

    this.vertical = Math.round(y) === y;

    this.g = new Graphics();
    this.initGraphics(this.g);
    this.active.addListener((p, c) => {
      if(p !== c) {
        this.initGraphics(this.g, c);
      }
    });
  }

  initGraphics(g: Graphics, active: boolean = this.active.value) {
    g.clear();
    if(this.vertical)g.rotateTransform(Math.PI * 0.5);
    if(active) {
      g.rect(-25, -2, 50, 4);
      g.fill({
        color: "#ff0000",
        alpha: 0.4
      });
      g.rect(-25, -1, 50, 2);
      g.fill({
        color: "#ff3333"
      });
    }
    g.rect(-29, -3, 8, 6);
    g.fill({
      color: "#666666"
    });
    g.rect(21, -3, 8, 6);
    g.fill({
      color: "#666666"
    });
  }

  /** 毎フレーム呼ばれる拡張フック（04-recipes.md レシピ B）。既定では何もしない。 */
  update(t: Ticker) {
  }

  key(): string {
    return `${this.x},${this.y}`;
  }
}