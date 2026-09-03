export enum Direction {
  Up,
  Down,
  Right,
  Left
}

export const DIRECTIONS: ReadonlyArray<Direction> = [
  Direction.Up,
  Direction.Down,
  Direction.Right,
  Direction.Left
];

/** その方向へ 1 マス進むときのグリッド差分 */
export function offsetOf(dir: Direction): { x: number, y: number } {
  switch(dir) {
    case Direction.Up: return { x: 0, y: -1 };
    case Direction.Down: return { x: 0, y: 1 };
    case Direction.Right: return { x: 1, y: 0 };
    case Direction.Left: return { x: -1, y: 0 };
  }
}

export function opposite(dir: Direction): Direction {
  switch(dir) {
    case Direction.Up: return Direction.Down;
    case Direction.Down: return Direction.Up;
    case Direction.Right: return Direction.Left;
    case Direction.Left: return Direction.Right;
  }
}

/** WASD の 1 文字を方向に変換する。移動キーでなければ null */
export function directionFromKey(k: string): Direction|null {
  switch(k) {
    case "w": return Direction.Up;
    case "a": return Direction.Left;
    case "s": return Direction.Down;
    case "d": return Direction.Right;
    default: return null;
  }
}
