/**
 * When the live dot rings (owner Q41): the room opening and each join, once per beat however many
 * headers show the dot. The rings themselves are in live-pulse.ts.
 */

/**
 * Whether someone arrived: an id present now that wasn't present before. The first look (`before`
 * null) is the room opening, not a join. A person coming back after dropping counts as joining.
 */
export function someoneJoined(before: ReadonlySet<string> | null, present: readonly string[]): boolean {
  return before !== null && present.some((id) => !before.has(id));
}

/** Who's in the room as last seen, and how many joins there have been since it opened here. */
export interface Arrivals { present: readonly string[] | null; joins: number }
export const NO_ARRIVALS: Arrivals = { present: null, joins: 0 };
/** The next arrivals for the people present now; the same object when nobody came or went. */
export function trackArrivals(state: Arrivals, present: readonly string[]): Arrivals {
  const before = state.present ? new Set(state.present) : null;
  if (before && before.size === present.length && present.every((id) => before.has(id))) return state;
  return { present: [...present], joins: state.joins + (someoneJoined(before, present) ? 1 : 0) };
}

/**
 * Beats that already rang, so each room page's header doesn't ring again for the same opening or
 * join.
 */
const rang: string[] = [];
export function claimLiveBeat(beat: string): boolean {
  if (rang.includes(beat)) return false;
  rang.push(beat);
  if (rang.length > 32) rang.shift();
  return true;
}
/** A beat whose rings were cut short (its header went away) may ring in the next header. */
export function releaseLiveBeat(beat: string) {
  const at = rang.indexOf(beat);
  if (at >= 0) rang.splice(at, 1);
}
