/**
 * 一次遅れ補間の係数を、フレームレートに依存しない形に補正する。
 *
 * `v += (target - v) * damp(rate, t.deltaTime)` と書くと、
 * 60fps（deltaTime = 1）では `rate` そのものと同じ動きになり、
 * 高リフレッシュレートでも同じ速さで収束する。
 *
 * 補間の係数一覧は dev-docs/05-visual-style.md。
 */
export function damp(rate: number, deltaTime: number): number {
  if(deltaTime <= 0) return 0;
  if(deltaTime === 1) return rate;
  return 1 - Math.pow(1 - rate, deltaTime);
}
