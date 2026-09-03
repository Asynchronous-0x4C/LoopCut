import { Ticker } from "pixi.js";
import { Direction } from "./direction";
import { Field } from "./field";
import { Tile } from "./tiles";
import { Entity } from "./entity";
import { Ghost } from "./ghost";
import { Player } from "./player";

export enum LogicState {
  /** タイルがせり上がってくる演出中。操作不可 */
  Start,
  /** 操作可能 */
  Loop,
  /** ループ終了の演出中。終わったら restart() */
  Next,
  /** クリア演出中。終わったら clear() */
  End
}

/**
 * `StageLogic` が必要とする「ステージ」の最小面。
 *
 * `Stage`（PixiJS のシーン）だけでなく、ヘッドレスなソルバも
 * これを実装することで**まったく同じルールコードを再利用できる**。
 * ここに描画や入力を持ち込まないこと。
 */
export interface StageContext {
  readonly field: Field;
  readonly player: Player;
  readonly ghosts: Array<Ghost>;
  /** 1 ループで動ける回数 */
  readonly steps: number;
  /**
   * ループをやり直す。
   * @param keepGhost 直前のプレイヤーをゴーストとして引き継ぐか（R リセットでは false）
   */
  restart(keepGhost: boolean): void;
  /** ステージクリア */
  clear(): void;
}

/** ループ終了・クリア演出の長さ（フレーム） */
const OUTRO_TIME = 70;

/**
 * ゲームのルールそのもの。**描画にも入力にも依存しない。**
 *
 * 入力は `KeyboardInput`（stageinput.ts）が `tryMove()` / `requestReset()` を
 * 呼ぶ形で外から与える。ルール仕様は dev-docs/02-game-rules.md。
 */
export class StageLogic {
  ctx: StageContext;
  state: LogicState = LogicState.Start;
  time: number = -20;

  /** このループでプレイヤーが残り何歩動けるか */
  remainSteps: number;

  /** 次の restart() でゴーストを引き継ぐか */
  private keepGhost: boolean = true;

  constructor(ctx: StageContext) {
    this.ctx = ctx;
    this.remainSteps = ctx.steps;

    // ループ開始時、プレイヤーとゴーストはそれぞれの開始タイルを占有する
    ctx.field.getTile(ctx.player.grid.x, ctx.player.grid.y)?.onEnter(true);
    ctx.ghosts.forEach(g => {
      const t = ctx.field.getTile(g.grid.x, g.grid.y);
      if(t === null) return;
      const solid = g.solid;
      t.onEnter(solid);
      if(solid) --g.remainSteps.value;
    });
  }

  update(t: Ticker) {
    switch(this.state) {
      case LogicState.Start:
        this.time += t.deltaTime;
        if(this.time >= 50) {
          this.time = 50;
          this.state = LogicState.Loop;
        }
        break;
      case LogicState.Loop:
        // 操作は外（KeyboardInput）から tryMove() / requestReset() で入る
        break;
      case LogicState.Next:
        this.time -= t.deltaTime;
        if(this.time <= 0) {
          this.time = 0;
          this.ctx.restart(this.keepGhost);
        }
        break;
      case LogicState.End:
        this.time -= t.deltaTime;
        if(this.time <= 0) {
          this.time = 0;
          this.ctx.clear();
        }
        break;
    }
  }

  /**
   * プレイヤーを 1 歩動かす。動けたら（＝1 ターン進んだら）true。
   * 進入できないタイルや操作不能な状態なら false を返して何も起こさない。
   */
  tryMove(dir: Direction): boolean {
    if(this.state !== LogicState.Loop) return false;

    const p = this.ctx.player.grid;
    const t = this.ctx.field.getAdjacentTile(p.x, p.y, dir);
    if(t === null || !t.canEnter()) return false;

    if(this.next(this.ctx.player, t, dir)) return true;

    // プレイヤーが動いたぶんだけ、ゴーストも軌跡を 1 歩ぶん逆再生する
    this.ctx.ghosts.forEach(g => {
      const gdir = g.command.pop();
      if(gdir == null) return;
      const gt = this.ctx.field.getAdjacentTile(g.grid.x, g.grid.y, gdir);
      if(gt === null) {
        // 自分の軌跡を辿っている限り起きないはず。起きたら経路の作り方が壊れている
        console.error("[LoopCut] ゴーストの移動先にタイルがありません。移動を打ち切ります");
        return;
      }
      this.next(g, gt, gdir);
    });

    this.ctx.field.nextTurn();

    // 歩数切れと詰みの判定は、**ゴーストが動いたあと**に行う。
    // ゴーストがスイッチを踏んでレーザーが開くことがあるので、
    // プレイヤーの移動直後に判定すると「ゴーストが道を開けてくれる」手が成立しない。
    const after = this.ctx.player.grid;
    if(this.state === LogicState.Loop
       && (this.remainSteps === 0 || this.ctx.field.isJammed(after.x, after.y))) {
      this.endLoop();
    }
    return true;
  }

  /** R キーによるリセット。ゴーストを引き継がずにやり直す */
  requestReset() {
    if(this.state !== LogicState.Loop) return;
    this.keepGhost = false;
    this.endLoop();
  }

  private endLoop() {
    this.state = LogicState.Next;
    this.time = OUTRO_TIME;
  }

  /**
   * エンティティ 1 体を 1 歩進める。
   * @returns このループ（またはステージ）がここで終わったら true
   */
  private next(e: Entity, t: Tile, dir: Direction): boolean {
    const solid = e.solid;

    if(solid && this.ctx.field.existsLaser(e.grid.x, e.grid.y, dir)) {
      e.bump(dir);
      this.endLoop();
      return true;
    }

    e.move(dir);
    t.onEnter(solid);

    if(e instanceof Player) {
      --this.remainSteps;
    } else if(e instanceof Ghost && solid) {
      --e.remainSteps.value;
    }

    // ゴールを踏めるのはプレイヤーだけ
    if(e instanceof Player && t.isGoal) {
      this.state = LogicState.End;
      this.time = OUTRO_TIME;
      return true;
    }

    // 歩数切れ・詰みはここでは見ない。ゴーストが動いたあとに tryMove() が判定する
    return false;
  }
}
