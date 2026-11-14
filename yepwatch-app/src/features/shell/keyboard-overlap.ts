/** The keyboard's frame as React Native reports it (window coordinates, dp). */
export interface KeyboardFrame { screenY: number; height: number }

/** How far a view whose window frame is (y, height) reaches below the keyboard's top edge (0 without a keyboard). */
export function keyboardOverlap(y: number, height: number, keyboard: KeyboardFrame | null | undefined) {
  if (!keyboard || !(keyboard.height > 0)) return 0;
  return Math.max(0, Math.round(y + height - keyboard.screenY));
}
