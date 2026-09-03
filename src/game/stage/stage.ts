import { Container, FillGradient, Graphics, Ticker } from "pixi.js";
import { Scene } from "../scene";
import { StageLogic } from "./stagelogic";
import { StageView } from "./stageview";
import { EndTile, Field, StartTile, SwitchTile, Tile, TileState } from "./field";
import { Player } from "./player";
import { app } from "../../main";
import { Laser } from "./objects";
import { Ghost } from "./ghost";
import { UI } from "../ui/ui";
import { Game } from "../game";

const stages = Object.values((import.meta as any).glob('./stages/*.json', { eager: true })) as Array<any>;

export class Stage extends Scene {
  game: Game;

  currentData: any|null = null;
  currentIndex: number = 0;

  logic!: StageLogic;
  view!: StageView;

  player!: Player;
  ghosts: Array<Ghost> = new Array();
  maxGhosts: number = 1;

  field!: Field;
  ui!: UI;

  initialized: boolean = true;

  steps: number = 0;

  constructor(game: Game){
    super();
    this.game = game;
  }

  load(stage: number) {
    this.currentIndex = stage;
    this.currentData = stages[stage];
    if(this.currentData != null) {
      this.initialized = true;
      this.reset(true);
    } else {
      this.game.setScene("fin");
    }
  }

  update(t: Ticker): void {
    this.logic.update(t);
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

  reset(init: boolean = false) {
    this.steps = this.currentData.steps ?? 4;

    this.container.destroy();
    this.container = new Container();
    if(this.initialized)this.container.alpha = 0;

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
    this.container.addChild(g);

    app.stage.addChild(this.container);

    this.field = new Field();
    let start: {x: number, y: number};
    (this.currentData.tiles as Array<string>).forEach((s, y) => {
      s.split("").forEach((c, x) => {
        if(c === 'S') {
          start = {
            x: x,
            y: y
          }
        }
        const tile = this.getTile(c, x, y);
        if(tile !== null)this.field.addTile(tile);
      });
    });

    const o = this.currentData.objects as Array<any>|null;
    if(o) {
      o.forEach(v => {
        switch(v.type) {
          case "laser":
            this.field.addLaser(new Laser(v.position.x, v.position.y, v.id));
            break;
          default: break;
        }
      })
    }

    this.container.addChild(this.field);

    if(init) {
      this.ghosts = [];
    } else {
      if(this.ghosts.length === this.maxGhosts)this.ghosts.shift();
      this.ghosts.push(new Ghost(this.player, this.logic.remainSteps));
    }

    this.player = new Player(start!, this.field.gap);

    this.logic = new StageLogic(this);

    this.view = new StageView(this);
    this.ui = new UI(this);
    this.container.addChild(this.view);
    this.container.addChild(this.ui);
  }

  private getTile(c: string, x: number, y: number): Tile|null {
    switch(c){
      case 'S': return new StartTile(TileState.Unused, x, y);
      case 'G': return new EndTile(TileState.Unused, x, y);
      case '#': return new Tile(TileState.Unused, x, y);
      case '@': return new Tile(TileState.Used, x, y);
      default: break;
    }
    if(/[a-z]/.test(c)) {
      return new SwitchTile(TileState.Unused, x, y, c, this.field);
    }
    return null;
  }
}