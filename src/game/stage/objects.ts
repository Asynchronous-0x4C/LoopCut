import { Graphics, Ticker } from "pixi.js";
import { ObservableValue } from "../../common/observable";
import { StageObjectData } from "./stagedata";

/**
 * タイルとタイルの「辺」に置く障害物。
 * 座標は片方が半整数（例 `x: 7.5, y: 0` はタイル (7,0) と (8,0) の間）。
 *
 * 新しいオブジェクトを足す手順は dev-docs/04-recipes.md レシピ B。
 */
export class Laser {
  x: number;
  y: number;
  id: string;
  active: ObservableValue<boolean> = new ObservableValue(true);

  /** スイッチで恒久的に止められたか。止まったレーザーは二度と復活しない */
  disabled: boolean = false;

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

  /** 対応するスイッチが押された。恒久的に止まる */
  deactivate() {
    this.disabled = true;
    this.active.value = false;
  }

  /**
   * 1 ターン経過したときに呼ばれる拡張フック。既定では何もしない。
   * ターンで点滅するレーザーなどはここを override する。
   */
  onTurn(turn: number) {}

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

  /** 毎フレーム呼ばれる拡張フック。既定では何もしない。 */
  update(t: Ticker) {
  }

  key(): string {
    return `${this.x},${this.y}`;
  }
}

export type ObjectFactory = (data: StageObjectData) => Laser;

/**
 * ステージ JSON の `objects[].type` → インスタンス。
 * **新しいオブジェクトを足すときはここに 1 行足す。**
 * 追加したら `stagedata.ts` の `OBJECT_TYPES` にも足すこと（検証に使う）。
 */
export const objectRegistry: Record<string, ObjectFactory> = {
  laser: d => new Laser(d.position.x, d.position.y, d.id)
};

/** 未実装の type なら null */
export function createObject(data: StageObjectData): Laser|null {
  const factory = objectRegistry[data.type];
  return factory !== undefined ? factory(data) : null;
}
