import { Container, Graphics, Text } from "pixi.js";
import { Field } from "../stage/field";
import { Player } from "../stage/player";
import { applyWave, entityAlpha } from "../stage/fieldanim";
import { damp } from "../../common/interpolate";
import { ExitArrow } from "./selecttiles";

/**
 * 選択画面の描画。フィールドの入退場アニメ、カメラ、自機の上のラベルを担当する。
 *
 * カメラは「イベント演出のときだけ動く」設計。ふだんは中央に戻っている。
 */
export class SelectView extends Container {
  /** カメラで動かす対象をまとめた入れ物 */
  readonly world: Container = new Container();

  private field: Field;
  private player: Player;
  private arrows: Array<ExitArrow>;

  private labelBox: Container = new Container();
  private labelBg: Graphics = new Graphics();
  private labelText: Text;

  /** カメラが向いているワールド座標 */
  private target = { x: 640, y: 360 };
  private current = { x: 640, y: 360 };

  constructor(field: Field, player: Player, arrows: Array<ExitArrow>) {
    super();
    this.field = field;
    this.player = player;
    this.arrows = arrows;

    field.tiles.forEach(t => {
      const w = field.gridToWorld(t.x, t.y);
      t.g.x = w.x;
      t.g.y = w.y;
    });
    field.lasers.forEach(l => {
      const w = field.gridToWorld(l.x, l.y);
      l.g.x = w.x;
      l.g.y = w.y;
    });
    arrows.forEach(a => {
      const w = field.gridToWorld(a.x, a.y);
      a.g.x = w.x;
      a.g.y = w.y;
      field.addChild(a.g);
    });

    const pw = field.gridToWorld(player.grid.x, player.grid.y);
    player.x = player.target.x = pw.x;
    player.y = player.target.y = pw.y;

    this.world.addChild(field);
    this.world.addChild(player);

    // 自機の上に出るステージ番号。半透明の黒地に白文字（影は付けない）
    this.labelText = new Text({
      text: "",
      style: {
        fontFamily: "Noto Sans JP",
        fontSize: 22,
        fill: 0xffffff
      }
    });
    this.labelText.anchor = { x: 0.5, y: 0.5 };
    this.labelBox.addChild(this.labelBg);
    this.labelBox.addChild(this.labelText);
    this.labelBox.visible = false;
    this.world.addChild(this.labelBox);

    this.addChild(this.world);
  }

  /** ラベルを出す。null で消す */
  setLabel(label: string|null) {
    if(label === null) {
      this.labelBox.visible = false;
      return;
    }
    this.labelText.text = label;
    const w = this.labelText.width;
    const h = this.labelText.height;
    this.labelBg.clear();
    this.labelBg.roundRect(-w * 0.5 - 8, -h * 0.5 - 4, w + 16, h + 8, 4);
    this.labelBg.fill({
      color: "#000000",
      alpha: 0.55
    });
    this.labelBox.visible = true;
  }

  /** カメラをグリッド座標へ寄せる。null で画面中央へ戻す */
  focus(grid: { x: number, y: number }|null) {
    if(grid === null) {
      this.target = { x: 640, y: 360 };
      return;
    }
    this.target = this.field.gridToWorld(grid.x, grid.y);
  }

  /** カメラが目標にほぼ到達したか */
  get settled(): boolean {
    return Math.abs(this.current.x - this.target.x) < 1
        && Math.abs(this.current.y - this.target.y) < 1;
  }

  update(deltaTime: number, time: number, dir: number) {
    applyWave(this.field, time, dir, this.arrows);

    const alpha = entityAlpha(time);
    this.player.alpha = alpha;
    this.labelBox.alpha = alpha;

    const k = damp(0.1, deltaTime);
    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
    this.world.x = 640 - this.current.x;
    this.world.y = 360 - this.current.y;

    this.labelBox.x = this.player.x;
    this.labelBox.y = this.player.y - 44;
  }
}
