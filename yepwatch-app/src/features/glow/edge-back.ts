/** Only a deliberate rightward swipe from the left edge is navigation. */
export const BACK_EDGE = 20;
export function edgeBackIntent(dx: number, dy: number) {
  return dx > 9 && dx > Math.abs(dy) * 1.5;
}
export function edgeBackComplete(dx: number, dy: number, vx: number) {
  return edgeBackIntent(dx, dy) && (dx >= 64 || (dx >= 32 && vx > 0.45));
}
