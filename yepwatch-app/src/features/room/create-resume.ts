import { transientFailure, unanswered } from '../../core/continuous/backoff';
import { browserOffline } from '../../core/continuous/network';

/** How one save of the New room page ended. */
export type CreateOutcome = 'answered' | 'cancelled' | 'offline' | 'failed';

/**
 * running: a save is going (it resends by itself, create-room.ts). paused: the app left the front during a
 * save; it goes again once the app is back and the cancelled save has settled. offline: goes again on the
 * online event. idle: nothing goes by itself (not started yet, or a final refusal: the person taps Try
 * again). left: the page left the front; nothing goes again and an answer doesn't navigate. done: answered.
 */
export type CreatePhase = 'idle' | 'running' | 'paused' | 'offline' | 'left' | 'done';

/** Outcomes fixed when the save failed (saveFailure), not when it settled after the page's cleanup. */
const failedAs = new WeakMap<object, CreateOutcome>();

/** A save's error, as the page sees it: the outcome saveFailure fixed, else classified now. */
export function createOutcome(error: unknown): CreateOutcome {
  if (error == null) return 'answered';
  if (typeof error === 'object' && failedAs.has(error)) return failedAs.get(error)!;
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
  return unanswered(error) && browserOffline() ? 'offline' : 'failed';
}

/** The server answered and said no (a 409, a 4xx): no resend can change it, so a cancellation doesn't hide it. */
export function definitiveRefusal(error: unknown) {
  return error instanceof Error && typeof (error as { status?: unknown }).status === 'number' && !transientFailure(error) &&
    !(Number((error as { status?: unknown }).status) === 429 && (error as { retryable?: unknown }).retryable === true);
}

/**
 * The error a save fails with, as the page keeps it, classified the moment it failed: cancelled (`aborted`:
 * the page or the app left the front) unless the server had already refused it for good, so a refusal whose
 * cleanup the background interrupted isn't sent again; an unanswered failure stays offline when the browser
 * is back before the page's cleanup settled (CreateResume.settled then starts it).
 */
export function saveFailure(error: unknown, aborted: boolean): Error {
  let failure: Error;
  if (aborted && !definitiveRefusal(error)) {
    failure = new Error('Room setup was interrupted.');
    failure.name = 'AbortError';
  } else failure = error instanceof Error ? error : new Error(String(error));
  failedAs.set(failure, createOutcome(failure));
  return failure;
}

interface CreateWiring { send: (text: string) => void; abort: () => void }

/**
 * When the New room page's save goes again by itself. One phase instead of flags, so successive lifecycle
 * events (iOS: inactive, then background) and a cancellation that settles before or after the app is back
 * can't drop the intent to resume.
 */
export class CreateResume {
  phase: CreatePhase = 'idle';
  private text: string | undefined;
  private saving = false;
  private front = true;

  /** `send` starts a save of the text; `abort` cancels the one going. The page connects them in an effect. */
  constructor(private o: CreateWiring = { send: () => undefined, abort: () => undefined }) {}

  connect(o: CreateWiring) { this.o = o; }

  /** The person picked a mood (Create room, Try again, a preset). */
  pick(text: string) {
    if (this.phase === 'done' || this.saving) return;
    this.text = text;
    this.go();
  }

  /** The page is in front (again): a person's pick may start a save. */
  focus() {
    if (this.phase === 'left') this.phase = 'idle';
  }

  /** The page left the front or unmounted: stop for good (the saved request stays for a later tap). */
  leave() {
    if (this.phase !== 'done') this.phase = 'left';
    this.o.abort();
  }

  /** The app's lifecycle: only 'active' is in front; every other state (inactive, background) pauses. */
  appState(state: string) {
    this.front = state === 'active';
    if (this.front) {
      // A cancellation still settling: settled() starts the save once it has.
      if (this.phase === 'paused' && !this.saving) this.go();
      return;
    }
    if (this.phase === 'running') {
      this.phase = 'paused';
      this.o.abort();
    }
  }

  /** The browser is online again. */
  online() {
    if (this.phase !== 'offline') return;
    if (this.front) this.go();
    else this.phase = 'paused';
  }

  /** A save ended. Returns whether its answer should open the room (the page is still in front). */
  settled(outcome: CreateOutcome): boolean {
    this.saving = false;
    if (this.phase === 'left' || this.phase === 'done') return false;
    if (outcome === 'answered') { this.phase = 'done'; return true; }
    if (outcome === 'cancelled' && this.phase === 'paused') {
      if (this.front) this.go();
      return false;
    }
    if (outcome !== 'offline') { this.phase = 'idle'; return false; }
    // Unanswered while offline. The online event may have come during the page's cleanup (ignored while
    // running): back online by now, it goes again once.
    if (!this.front) this.phase = 'paused';
    else if (browserOffline()) this.phase = 'offline';
    else this.go();
    return false;
  }

  private go() {
    if (this.text === undefined) { this.phase = 'idle'; return; }
    this.phase = 'running';
    this.saving = true;
    this.o.send(this.text);
  }
}
