import { Container, Ticker } from "pixi.js";
import { Scene } from "../scene";
import type { Game } from "../game";
import { app, key } from "../../main";
import { Field } from "../stage/field";
import { Player } from "../stage/player";
import { createObject } from "../stage/objects";
import { Direction, directionFromKey } from "../stage/direction";
import { GridPosition } from "../stage/stagedata";
import { hasFired, isCleared, loadProgress, markFired } from "../../common/progress";
import { selectMaps } from "./maps";
import {
  exitLabel,
  SelectEventData,
  SelectExit,
  SelectMapData
} from "./selectdata";
import { conditionMet, resolveSelectMap } from "./selectmap";
import { ExitArrow, selectTileRegistry, StageTile } from "./selecttiles";
import { SelectView } from "./selectview";
import { validateAllSelectMaps } from "./validate";
import { createBackground } from "../../common/background";

if(import.meta.env.DEV) validateAllSelectMaps(selectMaps);

enum SelectState {
  /** マップがせり上がってくる演出中 */
  Intro,
  /** クリア状況で発動したギミックの演出中 */
  Event,
  /** 操作可能 */
  Play,
  /** ステージへ入る演出中 */
  Leaving
}

/** イベント演出のタイムライン（フレーム） */
const EVENT_APPLY_AT = 40;
const EVENT_RETURN_AT = 95;
const EVENT_END_AT = 140;

/** 入退場演出の長さ */
const OUTRO_TIME = 70;

/**
 * ステージ選択画面。
 *
 * ステージと同じグリッドを歩いて回るが、**一筆書きではない**（タイルは消費されない）。
 * `&` タイルに立つとステージ番号が出て、隣の赤い矢印の向きへ動くとそのステージへ入る。
 * マップの書式は dev-docs/08-select-format.md。
 */
export class Select extends Scene {
  game: Game;

  private worldIndex: number = 0;
  private map: SelectMapData = selectMaps[0];

  private field!: Field;
  private player!: Player;
  private view!: SelectView;
  private exits: Array<SelectExit> = new Array();
  private arrows: Array<ExitArrow> = new Array();

  private state: SelectState = SelectState.Intro;
  private time: number = -20;
  private available: boolean = false;

  /** 次に入るステージ（Leaving 中に保持） */
  private pendingExit: SelectExit|null = null;
  /** 入場時に立たせたい位置。null なら S から */
  private standOn: GridPosition|null = null;
  /** これから演出するイベント */
  private pendingEvents: Array<SelectEventData> = new Array();
  private eventTime: number = 0;
  private eventApplied: boolean = false;

  constructor(game: Game) {
    super();
    this.game = game;
  }

  /** タイトルなどから開くときに、事前に呼ぶ */
  prepare(worldIndex: number) {
    this.worldIndex = Math.min(Math.max(0, worldIndex), selectMaps.length - 1);
    this.standOn = null;
  }

  /** ステージをクリアして戻ってくるときに、事前に呼ぶ。その `&` タイルの上に立たせる */
  prepareReturn(label: string) {
    selectMaps.forEach((map, worldIndex) => {
      map.exits.forEach((_, i) => {
        if(exitLabel(map.world, i) !== label) return;
        this.worldIndex = worldIndex;
      });
    });
    this.map = selectMaps[this.worldIndex];
    const exit = resolveSelectMap(this.map).exits.find(e => e.label === label);
    this.standOn = exit !== undefined ? exit.gate : null;
  }

  enter(): void {
    this.build();
  }

  update(t: Ticker): void {
    switch(this.state) {
      case SelectState.Intro:
        this.time += t.deltaTime;
        if(this.time >= 50) {
          this.time = 50;
          this.beginNextEventOrPlay();
        }
        break;
      case SelectState.Event:
        this.updateEvent(t);
        break;
      case SelectState.Play:
        this.updateInput();
        break;
      case SelectState.Leaving:
        this.time -= t.deltaTime;
        if(this.time <= 0) {
          this.time = 0;
          const exit = this.pendingExit;
          this.pendingExit = null;
          if(exit !== null) this.game.playStage(exit.stage, exit.label);
        }
        break;
    }

    this.field.update(t);
    this.player.update(t);
    this.view.update(t.deltaTime, this.time, this.state === SelectState.Leaving ? -1 : 1);
  }

  // --- 組み立て ---

  private build() {
    this.map = selectMaps[this.worldIndex];

    const previous = this.container;
    this.container = new Container();
    this.container.addChild(createBackground());
    app.stage.addChild(this.container);

    const resolved = resolveSelectMap(this.map);
    if(import.meta.env.DEV) {
      resolved.problems.forEach(p => console.warn(`[LoopCut] world ${this.map.world}: ${p}`));
    }

    this.field = new Field();
    this.map.tiles.forEach((row, y) => {
      row.split("").forEach((c, x) => {
        // マークのマスは描画しない。矢印の向きとステージの決定にだけ使う
        if(resolved.markChars.has(c)) return;
        const factory = selectTileRegistry[c];
        if(factory !== undefined) this.field.addTile(factory(x, y));
      });
    });

    (this.map.objects ?? []).forEach(v => {
      const object = createObject(v);
      if(object !== null) this.field.addLaser(object);
    });

    this.exits = resolved.exits;
    this.arrows = this.exits.map(e => new ExitArrow(e.arrow.x, e.arrow.y, e.dir));
    this.markClearedTiles();

    let start = resolved.start;
    if(start === null) {
      console.error(`[LoopCut] ワールド ${this.map.world} の選択マップに 'S' がありません。(0,0) から開始します`);
      start = { x: 0, y: 0 };
    }
    this.player = new Player(this.standOn ?? start, this.field.gap);
    this.standOn = null;

    this.view = new SelectView(this.field, this.player, this.arrows);
    this.container.addChild(this.view);

    this.state = SelectState.Intro;
    this.time = -20;
    this.available = false;
    this.collectEvents();
    this.updateLabel();

    // 構築した直後のフレームは update() が回らないまま描画される。
    // ここで初期状態（マップは画面外・自機は透明）を適用しておかないと、
    // 完成形の選択画面が 1 フレームだけ見えてしまう。
    this.view.update(0, this.time, 1);

    previous.destroy({ children: true });
  }


  /** クリア済みのステージの `&` タイルを塗る */
  private markClearedTiles() {
    this.exits.forEach(e => {
      const t = this.field.getTile(e.gate.x, e.gate.y);
      if(t instanceof StageTile) t.setCleared(isCleared(e.label));
    });
  }

  // --- イベント ---

  private collectEvents() {
    this.pendingEvents = [];
    const cleared = new Set(loadProgress().cleared);
    (this.map.events ?? []).forEach(e => {
      if(!conditionMet(e.when, cleared)) return;
      if(hasFired(e.id)) {
        // 前回までに演出済み。効果だけ静かに適用する
        this.applyEvent(e);
        return;
      }
      this.pendingEvents.push(e);
    });
  }

  private applyEvent(e: SelectEventData) {
    switch(e.action.type) {
      case "openLaser":
        this.field.deactivateLasers(e.action.id);
        break;
      default: break;
    }
  }

  /** イベントの対象位置。カメラを寄せる先 */
  private eventFocus(e: SelectEventData): GridPosition|null {
    if(e.focus !== undefined) return e.focus;
    for(const l of this.field.lasers.values()) {
      if(l.id === e.action.id) return { x: l.x, y: l.y };
    }
    return null;
  }

  private beginNextEventOrPlay() {
    const next = this.pendingEvents.shift();
    if(next === undefined) {
      this.state = SelectState.Play;
      return;
    }
    this.state = SelectState.Event;
    this.eventTime = 0;
    this.eventApplied = false;
    this.view.focus(this.eventFocus(next));
    this.view.setLabel(null);
    this.pendingEvents.unshift(next);
  }

  private updateEvent(t: Ticker) {
    const e = this.pendingEvents[0];
    if(e === undefined) {
      this.state = SelectState.Play;
      return;
    }
    this.eventTime += t.deltaTime;

    if(!this.eventApplied && this.eventTime >= EVENT_APPLY_AT) {
      this.applyEvent(e);
      markFired(e.id);
      this.eventApplied = true;
    }
    if(this.eventTime >= EVENT_RETURN_AT) {
      this.view.focus(null);
    }
    if(this.eventTime >= EVENT_END_AT) {
      this.pendingEvents.shift();
      this.updateLabel();
      this.beginNextEventOrPlay();
    }
  }

  // --- 操作 ---

  private updateInput() {
    for(const k of key.keys) {
      const dir = directionFromKey(k);
      if(dir === null) continue;
      if(this.available && this.tryMove(dir)) this.available = false;
      break;
    }
    if(!key.pressed) {
      this.available = true;
    }
  }

  private tryMove(dir: Direction): boolean {
    const p = this.player.grid;

    // 立っているのが入口の `&` で、矢印の向きに動いたらステージへ
    const exit = this.exits.find(e => e.gate.x === p.x && e.gate.y === p.y && e.dir === dir);
    if(exit !== undefined) {
      this.pendingExit = exit;
      this.state = SelectState.Leaving;
      this.time = OUTRO_TIME;
      this.view.focus(null);
      return true;
    }

    const t = this.field.getAdjacentTile(p.x, p.y, dir);
    if(t === null || !t.canEnter()) return false;
    // レーザーは通せんぼ。ぶつかっても何も起きない（ステージと違ってやり直しが無い）
    if(this.field.existsLaser(p.x, p.y, dir)) return false;

    this.player.move(dir);
    this.updateLabel();
    return true;
  }

  private updateLabel() {
    const p = this.player.grid;
    const exit = this.exits.find(e => e.gate.x === p.x && e.gate.y === p.y);
    this.view.setLabel(exit !== undefined ? exit.label : null);
  }
}
