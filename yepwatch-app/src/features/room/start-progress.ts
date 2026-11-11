/**
 * Starting a round, as the room shows it. The server builds the first deck inside the Start command
 * itself: the room stays in setup until the deck is there, then goes straight to choosing (there is no
 * "deck building" phase). So the host's wait is the Start command in flight, a friend sees nothing
 * until the round is there, and a start that fails leaves the room in setup.
 */
import type { RoomView } from './model';

export type StartPhase = 'idle' | 'starting' | 'failed';

/** The second and third words of a long start. */
export const START_BEATS_MS = [2600, 5000] as const;
/** The progress line eases toward this while the deck isn't there, and fills only when it is. */
export const START_PROGRESS_CAP = 0.88;
export const START_PROGRESS_MS = 6500;
export const START_FAILED_NOTE = 'Couldn’t start the round';

/** Which words a start that has run for `elapsedMs` shows: 0, 1 or 2. */
export function startBeat(elapsedMs: number) {
  return START_BEATS_MS.filter((ms) => elapsedMs >= ms).length;
}

/** The loading words per beat. */
export function startWords(beat: number) {
  if (beat >= 2) return 'Almost ready…';
  if (beat === 1) return 'Finding titles…';
  return 'Starting…';
}

/**
 * The host's Start. `attempt` is this device's tap and how it went, `retrying` a start the server
 * hasn't confirmed going out again right now. The round arriving replaces this screen with voting.
 */
export function hostStartPhase({ attempt, retrying }: { attempt: 'starting' | 'failed' | null; retrying: boolean }): StartPhase {
  if (attempt === 'starting' || retrying) return 'starting';
  return attempt === 'failed' ? 'failed' : 'idle';
}

/** The words and accessible name on the host's Start. */
export function hostStartLabel(phase: StartPhase, beat: number) {
  return phase === 'failed' ? 'Try again' : phase === 'starting' ? startWords(beat) : 'Start';
}

/**
 * The round started while this screen watched: setup became choosing (only Start does that; a
 * restart goes back to setup first).
 */
export function startedLive(before: RoomView['phase'] | null | undefined, after: RoomView['phase'] | null | undefined) {
  return before === 'setup' && after === 'choosing';
}
