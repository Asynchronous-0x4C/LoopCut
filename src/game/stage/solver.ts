import { Ticker } from "pixi.js";
import { Direction, DIRECTIONS, directionFromKey } from "./direction";
import { Field } from "./field";
import { Ghost } from "./ghost";
import { Player } from "./player";
import { createObject } from "./objects";
import { createTile, SwitchTile } from "./tiles";
import { LogicState, StageContext, StageLogic } from "./stagelogic";
import { DEFAULT_STEPS, GridPosition, MAX_GHOSTS, StageData } from "./stagedata";

/**
 * ヘッドレスなステージ検証（`bun run verify`）。
 *
 * **ルールを一切再実装していない。** `StageContext` を実装することで
 * ゲーム本体とまったく同じ `StageLogic` / `Field` / `Tile` / `Ghost` を動かしている。
 * つまりここが緑なら、ルールの回帰は起きていない。
 *
 * このファイルはゲーム本体からは import されないので、配信バンドルには入らない。
 */

/** 演出時間を飛ばすための巨大な deltaTime */
const SKIP_TICK = { deltaTime: 100 } as unknown as Ticker;

export class Sim implements StageContext {
  readonly data: StageData;

  field!: Field;
  player!: Player;
  ghosts: Array<Ghost> = new Array();
  steps: number = 0;
  logic!: StageLogic;

  /** クリアしたか */
  cleared: boolean = false;
  /** 何回ループをやり直したか */
  loopCount: number = 0;

  constructor(data: StageData) {
    this.data = data;
    this.build(true);
  }

  /** Stage.reset() と同じ手順でステージを組み立てる */
  private build(init: boolean) {
    const data = this.data;
    this.steps = data.steps ?? DEFAULT_STEPS;

    const field = new Field();
    let start: GridPosition = { x: 0, y: 0 };
    data.tiles.forEach((row, y) => {
      row.split("").forEach((c, x) => {
        if(c === "S") start = { x: x, y: y };
        const tile = createTile(c, x, y);
        if(tile !== null) field.addTile(tile);
      });
    });
    (data.objects ?? []).forEach(v => {
      const object = createObject(v);
      if(object !== null) field.addLaser(object);
    });

    // ゴーストの生成は新しい player / logic を作る前に行う（Stage.reset と同じ順序）
    if(init) {
      this.ghosts = [];
    } else {
      if(this.ghosts.length === MAX_GHOSTS) this.ghosts.shift();
      this.ghosts.push(new Ghost(this.player, this.logic.remainSteps));
    }

    this.field = field;
    this.player = new Player(start, field.gap);
    this.logic = new StageLogic(this);
  }

  // --- StageContext ---

  restart(keepGhost: boolean) {
    ++this.loopCount;
    this.build(!keepGhost);
  }

  clear() {
    this.cleared = true;
  }

  // --- 駆動 ---

  /** 演出を飛ばして操作可能状態（または クリア）まで進める */
  settle() {
    let guard = 0;
    while(!this.cleared && this.logic.state !== LogicState.Loop) {
      this.logic.update(SKIP_TICK);
      if(++guard > 64) throw new Error("settle() が収束しません");
    }
  }

  /** 1 手動かして演出を飛ばす。動けなければ false */
  step(dir: Direction): boolean {
    if(!this.logic.tryMove(dir)) return false;
    this.settle();
    return true;
  }

  /** 探索の重複判定に使う、状態の完全な指紋 */
  fingerprint(): string {
    const tiles = [...this.field.tiles.values()];
    const used = tiles.filter(t => !t.canEnter()).map(t => t.key()).sort().join("|");
    const pushed = tiles
      .filter((t): t is SwitchTile => t instanceof SwitchTile)
      .filter(t => t.pushed.value)
      .map(t => t.id).sort().join("");
    const lasers = [...this.field.lasers.values()]
      .filter(l => l.active.value).map(l => l.key()).sort().join("|");
    const ghosts = this.ghosts
      .map(g => `${g.grid.x},${g.grid.y}/${g.remainSteps.value}/${g.command.join("")}`)
      .join(";");
    return [
      this.loopCount,
      `${this.player.grid.x},${this.player.grid.y}`,
      this.logic.remainSteps,
      used,
      pushed,
      lasers,
      ghosts
    ].join("#");
  }
}

export interface SolveResult {
  solved: boolean;
  /** 解けたときに使ったループ数（1 = 最初のループでクリア） */
  loops: number;
  /** 全ループ通しの手順 */
  moves: Array<Direction>;
  /** 探索した状態数 */
  explored: number;
  /** 予算切れで探索を打ち切ったか（solved が false でも「解なし」とは限らない） */
  truncated: boolean;
}

const DIRECTION_NAMES: Record<Direction, string> = {
  [Direction.Up]: "W",
  [Direction.Down]: "S",
  [Direction.Left]: "A",
  [Direction.Right]: "D"
};

export function formatMoves(moves: Array<Direction>): string {
  return moves.map(d => DIRECTION_NAMES[d]).join("");
}

/** "DSDW" のような文字列を方向の列にする */
export function parseMoves(text: string): Array<Direction> {
  const moves: Array<Direction> = new Array();
  for(const c of text) {
    const d = directionFromKey(c.toLowerCase());
    if(d === null) throw new Error(`手順に使えない文字です: '${c}'（W/A/S/D のみ）`);
    moves.push(d);
  }
  return moves;
}

export interface RouteResult {
  cleared: boolean;
  /** 何手目まで進めたか。動けなくなった場合はその手前まで */
  played: number;
}

/**
 * 決まった手順を再生して、クリアできるかを確かめる。
 *
 * ソルバは「解が存在するか」しか見ないので、**別解があると
 * 「本来意図した手順が壊れた」ことを見逃す**。
 * 既知の手順をここで固定しておくと、その回帰を検出できる。
 */
export function playRoute(data: StageData, text: string): RouteResult {
  const moves = parseMoves(text);
  const sim = new Sim(data);
  sim.settle();
  for(let i = 0; i < moves.length; ++i) {
    if(sim.cleared) return { cleared: true, played: i };
    if(!sim.step(moves[i])) return { cleared: false, played: i };
  }
  return { cleared: sim.cleared, played: moves.length };
}

function replay(data: StageData, path: Array<Direction>): Sim|null {
  const sim = new Sim(data);
  sim.settle();
  for(const d of path) {
    if(sim.cleared) break;
    if(!sim.step(d)) return null;
  }
  return sim;
}

/** 指定ループ数以内で解けるか深さ優先で探す */
function search(data: StageData, loopLimit: number, budget: number): SolveResult {
  const seen = new Set<string>();
  const path: Array<Direction> = [];
  let explored = 0;
  let truncated = false;

  const visit = (sim: Sim): boolean => {
    if(sim.cleared) return true;
    if(sim.loopCount >= loopLimit) return false;

    const key = sim.fingerprint();
    if(seen.has(key)) return false;
    seen.add(key);

    if(++explored > budget) {
      truncated = true;
      return false;
    }

    for(const d of DIRECTIONS) {
      path.push(d);
      const next = replay(data, path);
      if(next !== null && visit(next)) return true;
      path.pop();
      if(truncated) return false;
    }
    return false;
  };

  const root = new Sim(data);
  root.settle();
  const solved = visit(root);
  return {
    solved,
    loops: 0,           // 呼び出し側（solve）が探索したループ上限を入れる
    moves: solved ? [...path] : [],
    explored,
    truncated
  };
}

/**
 * ステージが解けるかを調べる。
 * @param maxLoops 何ループまで許すか。これを超える解は「解なし」として扱う
 * @param budget 状態数の上限。超えたら truncated を立てて打ち切る
 */
export function solve(data: StageData, maxLoops: number = 4, budget: number = 120000): SolveResult {
  let last: SolveResult = { solved: false, loops: 0, moves: [], explored: 0, truncated: false };
  // ループ数の少ない解から探すことで「最小ループ数」が求まる
  for(let limit = 1; limit <= maxLoops; ++limit) {
    const result = search(data, limit, budget);
    result.loops = result.solved ? limit : 0;
    if(result.solved) return result;
    last = result;
    if(result.truncated) break;
  }
  return last;
}
