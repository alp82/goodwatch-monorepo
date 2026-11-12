import { unanswered } from './backoff';
import { browserOffline } from './network';
import { definitiveRefusal } from './resend';

/** How one send of a saved admission (New room's create, a join) ended. */
export type ResendOutcome = 'answered' | 'cancelled' | 'offline' | 'failed';

/**
 * running: a send is going (it resends by itself, resend.ts). paused: the app left the front during a
 * send; it goes again once the app is back and the cancelled send has settled. offline: goes again on the
 * online event. idle: nothing goes by itself (not started yet, or a final refusal: the person taps Try
 * again). left: the page left the front; nothing goes again and an answer doesn't navigate. done: answered.
 */
export type ResendPhase = 'idle' | 'running' | 'paused' | 'offline' | 'left' | 'done';

/** Outcomes fixed when the send failed (sendFailure), not when it settled after the page's cleanup. */
const failedAs = new WeakMap<object, ResendOutcome>();

/** A send's error, as the page sees it: the outcome sendFailure fixed, else classified now. */
export function resendOutcome(error: unknown): ResendOutcome {
  if (error == null) return 'answered';
  if (typeof error === 'object' && failedAs.has(error)) return failedAs.get(error)!;
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
  return unanswered(error) && browserOffline() ? 'offline' : 'failed';
}

/**
 * The error a send fails with, as the page keeps it, classified the moment it failed: cancelled (`aborted`:
 * the page or the app left the front) unless the server had already refused it for good, so a refusal whose
 * cleanup the background interrupted isn't sent again; an unanswered failure stays offline when the browser
 * is back before the page's cleanup settled (ResendResume.settled then starts it).
 */
export function sendFailure(error: unknown, aborted: boolean, cancelledWords = 'Room setup was interrupted.'): Error {
  let failure: Error;
  if (aborted && !definitiveRefusal(error)) {
    failure = new Error(cancelledWords);
    failure.name = 'AbortError';
  } else failure = error instanceof Error ? error : new Error(String(error));
  failedAs.set(failure, resendOutcome(failure));
  return failure;
}

interface ResendWiring<T> { send: (value: T) => void; abort: () => void }

/**
 * When a page's saved admission goes again by itself (New room's create with the mood text, the join page's
 * join with what was asked). One phase instead of flags, so successive lifecycle events (iOS: inactive, then
 * background) and a cancellation that settles before or after the app is back can't drop the intent to resume.
 */
export class ResendResume<T> {
  phase: ResendPhase = 'idle';
  private value: T | undefined;
  private saving = false;
  private front = true;

  /** `send` starts a send of the value; `abort` cancels the one going. The page connects them in an effect. */
  constructor(private o: ResendWiring<T> = { send: () => undefined, abort: () => undefined }) {}

  connect(o: ResendWiring<T>) { this.o = o; }

  /** The person asked (Create room, Join, Try again, a preset). Returns whether a send started. */
  pick(value: T) {
    if (this.phase === 'done' || this.saving) return false;
    this.value = value;
    this.go();
    return true;
  }

  /** The page is in front (again), a new visit: a person's pick may start a send. */
  focus() {
    if (this.phase === 'left' || this.phase === 'done') this.phase = 'idle';
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
      // A cancellation still settling: settled() starts the send once it has.
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

  /** A send ended. Returns whether its answer should open the room (the page is still in front). */
  settled(outcome: ResendOutcome): boolean {
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
    if (this.value === undefined) { this.phase = 'idle'; return; }
    this.phase = 'running';
    this.saving = true;
    this.o.send(this.value);
  }
}
