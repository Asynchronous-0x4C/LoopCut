/**
 * プレイ進捗の永続化。保存先は localStorage（Web でも Tauri でも動く）。
 *
 * 壊れた値が入っていてもゲームが起動しなくなることは無いように、
 * 読み込みは必ず検証してから使い、失敗したら初期状態に戻す。
 */

const STORAGE_KEY = "loopcut.progress.v1";

export interface Progress {
  /** クリア済みステージのラベル（"1-1" など） */
  cleared: Array<string>;
  /** 演出を再生済みの選択画面イベント id。同じ演出を二度流さないために使う */
  firedEvents: Array<string>;
}

function empty(): Progress {
  return { cleared: [], firedEvents: [] };
}

function isStringArray(v: unknown): v is Array<string> {
  return Array.isArray(v) && v.every(x => typeof x === "string");
}

let cache: Progress|null = null;

export function loadProgress(): Progress {
  if(cache !== null) return cache;
  cache = empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if(typeof parsed === "object" && parsed !== null) {
        const o = parsed as Record<string, unknown>;
        if(isStringArray(o.cleared)) cache.cleared = o.cleared;
        if(isStringArray(o.firedEvents)) cache.firedEvents = o.firedEvents;
      }
    }
  } catch(e) {
    // localStorage が使えない環境や壊れた JSON。初期状態のまま続行する
    console.warn("[LoopCut] 進捗を読み込めませんでした。最初から始めます", e);
    cache = empty();
  }
  return cache;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadProgress()));
  } catch(e) {
    // プライベートブラウジング等で書き込めないことがある。落とさずに続行する
    console.warn("[LoopCut] 進捗を保存できませんでした", e);
  }
}

export function isCleared(label: string): boolean {
  return loadProgress().cleared.includes(label);
}

export function markCleared(label: string) {
  const p = loadProgress();
  if(p.cleared.includes(label)) return;
  p.cleared.push(label);
  save();
}

export function clearedCount(): number {
  return loadProgress().cleared.length;
}

export function hasFired(eventId: string): boolean {
  return loadProgress().firedEvents.includes(eventId);
}

export function markFired(eventId: string) {
  const p = loadProgress();
  if(p.firedEvents.includes(eventId)) return;
  p.firedEvents.push(eventId);
  save();
}

/** デバッグ用。進捗を全部消す */
export function resetProgress() {
  cache = empty();
  save();
}
