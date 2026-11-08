import { Platform } from 'react-native';
import { isMemberReturn } from './web-member-return';

/**
 * The GoodWatch sign-in transition on the web: `leaving` fades the cover in before the page goes to
 * GoodWatch; `returning` starts covered on the page that comes back and fades out once that page is
 * ready. Native sign-in happens in the system sheet over the unchanged screen, so it stays idle.
 */
export type TransitionPhase = 'idle' | 'leaving' | 'returning';
/** The cover's fade-in before the browser leaves for GoodWatch. */
export const LEAVE_MS = 260;
/** The longest a returning page stays covered if it never says it is ready. */
export const RETURN_CAP_MS = 2500;

let phase: TransitionPhase = Platform.OS === 'web' && isMemberReturn() ? 'returning' : 'idle';
const listeners = new Set<(phase: TransitionPhase) => void>();
function set(next: TransitionPhase) {
  if (next === phase) return;
  phase = next;
  listeners.forEach((l) => l(next));
}
export const memberTransition = {
  phase: () => phase,
  subscribe(listener: (phase: TransitionPhase) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Covers the page, resolving once the cover is in (or at once with reduced motion). */
  leave(reduced = false) {
    set('leaving');
    return new Promise<void>((resolve) => setTimeout(resolve, reduced ? 0 : LEAVE_MS));
  },
  /** The returning page is ready: uncover it. */
  arrived() { if (phase === 'returning') set('idle'); },
  reset() { set('idle'); },
};
