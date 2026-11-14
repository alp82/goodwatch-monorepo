/** A browser page: it hears online, offline and focus (the app has none of these). */
export const browserEvents = () =>
  typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof navigator !== 'undefined' && 'onLine' in navigator;
/** The browser knows it has no network at all. */
export const browserOffline = () => browserEvents() && navigator.onLine === false;
/** Calls `back` when the browser is online again (a no-op in the app); returns the unsubscribe. */
export function onBackOnline(back: () => void) {
  if (!browserEvents()) return () => undefined;
  window.addEventListener('online', back);
  return () => window.removeEventListener('online', back);
}

type AnswerListener = (status: number, ticket: boolean) => void;
const answerListeners = new Set<AnswerListener>();
/**
 * YepWatch answered an HTTP request with `status`: the way to it works right now. A network that dropped every packet
 * for a while says nothing when it comes back (no `online` event), so this is how the live channel hears it
 * (ContinuousRealtime.answered). `ticket`: the answer to the channel's own ticket request.
 */
export function yepwatchAnswered(status: number, ticket = false) {
  lastAnswerAt = Date.now();
  for (const listener of [...answerListeners]) listener(status, ticket);
}
let lastAnswerAt = 0;
let requestSeq = 0;
/** Requests to YepWatch still waiting for an answer: id → epoch ms sent. */
const waiting = new Map<number, number>();
/** A request to YepWatch goes out; call the returned function when it settles (answered, failed or aborted). */
export function requestSent(now = Date.now()) {
  const id = ++requestSeq;
  waiting.set(id, now);
  return () => void waiting.delete(id);
}
/**
 * How long YepWatch has said nothing while a request waited for it (ms; 0 when nothing waits): from the later of the
 * oldest waiting request and the last answer. A network that drops every packet shows as this growing; a slow one
 * keeps answering.
 */
export function unansweredFor(now = Date.now()) {
  if (!waiting.size) return 0;
  return Math.max(0, now - Math.max(Math.min(...waiting.values()), lastAnswerAt));
}
/** Calls `listener` at each YepWatch answer (yepwatchAnswered); returns the unsubscribe. */
export function onYepwatchAnswer(listener: AnswerListener) {
  answerListeners.add(listener);
  return () => void answerListeners.delete(listener);
}
