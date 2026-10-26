/** Pure timing rules for cheers, shared by the hooks and their tests. */
export const CHEER_TIMING = { holdAfterMs: 300, renewMs: 500, bonusDwellMs: 350, holdEmitMs: 250 } as const;

/** The all-hold bonus shows only once everyone has held for the dwell; it drops at once when anyone lets go. */
export function bonusVisible(allHoldSince: number | null, now: number, dwellMs: number = CHEER_TIMING.bonusDwellMs) {
  return allHoldSince !== null && now - allHoldSince >= dwellMs;
}

export type CheerSignal = { kind: 'tap' | 'hold' | 'release'; seed: number };
export interface GestureState { phase: 'idle' | 'pressed' | 'holding'; seed: number; pressedAt: number; lastHoldAt: number }
export const idleGesture: GestureState = { phase: 'idle', seed: 0, pressedAt: 0, lastHoldAt: 0 };

/** Press: an immediate tap with a fresh episode seed. */
export function pressGesture(state: GestureState, now: number, seed: number): { state: GestureState; emit: CheerSignal[] } {
  if (state.phase !== 'idle') return { state, emit: [] };
  return { state: { phase: 'pressed', seed, pressedAt: now, lastHoldAt: 0 }, emit: [{ kind: 'tap', seed }] };
}
/** Time passing while pressed: becomes a hold after 300 ms, then renews every 500 ms with the same seed. */
export function tickGesture(state: GestureState, now: number): { state: GestureState; emit: CheerSignal[] } {
  if (state.phase === 'pressed' && now - state.pressedAt >= CHEER_TIMING.holdAfterMs)
    return { state: { ...state, phase: 'holding', lastHoldAt: now }, emit: [{ kind: 'hold', seed: state.seed }] };
  if (state.phase === 'holding' && now - state.lastHoldAt >= CHEER_TIMING.renewMs)
    return { state: { ...state, lastHoldAt: now }, emit: [{ kind: 'hold', seed: state.seed }] };
  return { state, emit: [] };
}
/** Up, cancel, background, unmount or disabled: a hold ends with an explicit release; a tap needs nothing. */
export function releaseGesture(state: GestureState): { state: GestureState; emit: CheerSignal[] } {
  return { state: idleGesture, emit: state.phase === 'holding' ? [{ kind: 'release', seed: state.seed }] : [] };
}
/** When the next tick is due, or null when idle (no timers while nothing is pressed). */
export function nextTickDelay(state: GestureState, now: number) {
  if (state.phase === 'pressed') return Math.max(0, state.pressedAt + CHEER_TIMING.holdAfterMs - now);
  if (state.phase === 'holding') return Math.max(0, state.lastHoldAt + CHEER_TIMING.renewMs - now);
  return null;
}
