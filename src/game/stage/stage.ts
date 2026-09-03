import { Container, FillGradient, Graphics, Ticker } from "pixi.js";
import { Scene } from "../scene";
import { StageContext, StageLogic } from "./stagelogic";
import { StageInputSource, KeyboardInput } from "./stageinput";
import { StageView } from "./stageview";
import { Field } from "./field";
import { createTile } from "./tiles";
import { Player } from "./player";
import { app } from "../../main";
import { createObject } from "./objects";
import { Ghost } from "./ghost";
import { UI } from "../ui/ui";
import type { Game } from "../game";
import { stages } from "./stages";
import { DEFAULT_STEPS, GridPosition, MAX_GHOSTS, StageData } from "./stagedata";
import { validateAllStages } from "./validate";
import { markCleared } from "../../common/progress";

if(import.meta.env.DEV) validateAllStages(stages);

export class Stage extends Scene implements StageContext {
  game: Game;

  currentData: StageData|null = null;
  currentIndex: number = 0;
  /** 選択画面から渡される表示用ラベル（"1-1" など） */
  currentLabel: string = "";

  logic!: StageLogic;
  view!: StageView;
  input!: StageInputSource;

  player!: Player;
  ghosts: Array<Ghost> = new Array();
  maxGhosts: number = MAX_GHOSTS;

  field!: Field;
  ui!: UI;

  initialized: boolean = true;

  steps: number = 0;

  constructor(game: Game){
    super();
    this.game = game;
  }

  load(stage: number, label: string = "") {
    this.currentIndex = stage;
    this.currentLabel = label;
    this.currentData = stages[stage] ?? null;
    if(this.currentData != null) {
      this.initialized = true;
      this.reset(true);
    } else {
      console.error(`[LoopCut] ステージ ${stage} は存在しません`);
      this.game.openSelect();
    }
  }

  // --- StageContext ---

  /** ループのやり直し。StageLogic から呼ばれる */
  restart(keepGhost: boolean) {
    this.reset(!keepGhost);
  }

  /** ステージクリア。StageLogic から呼ばれる */
  clear() {
    if(this.currentLabel !== "") markCleared(this.currentLabel);
    this.game.returnToSelect(this.currentLabel);
  }

  update(t: Ticker): void {
    this.logic.update(t);
    this.input.update(this.logic);
    this.view.update(t);
    this.ui.update(t);
    this.field.update(t);
    this.player.update(t);
    this.ghosts.forEach(g => {
      g.update(t);
    });
    if(this.initialized) {
      this.container.alpha = 1;
      this.initialized = false;
    }
  }

  /**
   * ステージを組み立て直す。ループが終わるたびに丸ごと作り直している。
   * @param init true ならゴーストを捨てて最初からやり直す
   */
  reset(init: boolean = false) {
    const data = this.currentData;
    if(data === null) return;
    this.steps = data.steps ?? DEFAULT_STEPS;

    // 古いシーングラフは「最後に」破棄する。
    // 先に壊すと、ゴーストの生成元になる旧 player まで壊れてしまう。
    const previous = this.container;
    this.container = new Container();
    if(this.initialized)this.container.alpha = 0;

    this.container.addChild(this.createBackground());

    app.stage.addChild(this.container);

    this.field = new Field();
    let start: GridPosition|null = null;
    data.tiles.forEach((s, y) => {
      s.split("").forEach((c, x) => {
        if(c === 'S') {
          start = {
            x: x,
            y: y
          }
        }
        const tile = createTile(c, x, y);
        if(tile !== null)this.field.addTile(tile);
      });
    });
    if(start === null) {
      // validateStage が警告済み。ここで落とさず (0,0) から始めて、遊べる形は保つ
      console.error(`[LoopCut] ステージ ${this.currentIndex + 1} に 'S' がありません。(0,0) から開始します`);
      start = { x: 0, y: 0 };
    }

    (data.objects ?? []).forEach(v => {
      const object = createObject(v);
      if(object !== null) this.field.addLaser(object);
    });

    this.container.addChild(this.field);

    if(init) {
      this.ghosts = [];
    } else {
      if(this.ghosts.length === this.maxGhosts)this.ghosts.shift();
      this.ghosts.push(new Ghost(this.player, this.logic.remainSteps));
    }

    this.player = new Player(start, this.field.gap);

    this.logic = new StageLogic(this);
    this.input = new KeyboardInput();

    this.view = new StageView(this);
    this.ui = new UI(this);
    this.container.addChild(this.view);
    this.container.addChild(this.ui);

    // StageView のコンストラクタが、生き残るゴーストを新しいツリーへ付け替え済み。
    // 残っているのは捨てるものだけなので、子ごと破棄して GPU リソースを解放する。
    previous.destroy({ children: true });
  }

  private createBackground(): Graphics {
    const g = new Graphics();
    const gradient = new FillGradient({
      start: {
        x: 0,
        y: 0
      },
      end: {
        x: 1280,
        y: 720
      }
    });
    gradient.addColorStop(0, "#f0f0f0");
    gradient.addColorStop(1, "#e0e0e0");
    g.rect(0, 0, 1280, 720);
    g.fill(gradient);
    return g;
  }
}
