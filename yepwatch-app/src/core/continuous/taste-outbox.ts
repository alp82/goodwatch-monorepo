import type { ProfileAnswerItem, TasteAnswer } from '@goodwatch/yepwatch-contracts/proposal';

/**
 * Taste answers on their way to the profile (POST /profile/answers), kept on the device until the server takes them.
 * Pure: the store (taste-profile.ts) owns timing, storage and the network.
 *
 * - One slot per title (and per decision for a next-day question): a newer answer that isn't sent yet replaces the
 *   older one, so an answer and its Undo before a send cost nothing. An answer already on its way stays; the newer
 *   one goes after it (the server keeps the latest `at`).
 * - `at` is the moment of the answer and never changes on a resend (the server's idempotency key).
 * - `delta` is what the item does to the "N rated" count (Loved it and Not for me count, Haven't seen doesn't).
 */
export type FollowUpAnswer = 'loved' | 'not_for_me' | 'did_not_watch';
export interface PendingAnswer {
  key: number;
  answer: TasteAnswer | 'did_not_watch' | null;
  at: number;
  /** Set for a next-day question (with its decision time). */
  decidedAt?: number;
  delta: number;
}
/** At most this many wait on the device (the server takes 50 per request). */
export const OUTBOX_MAX = 50;
/** One request carries at most this many. */
export const BATCH_SIZE = 10;

export const ratedDelta = (answer: PendingAnswer['answer']) => (answer === 'loved' || answer === 'not_for_me' ? 1 : 0);
const slot = (p: Pick<PendingAnswer, 'key' | 'decidedAt'>) => `${p.decidedAt === undefined ? 't' : `f${p.decidedAt}`}:${p.key}`;
/** One send of one item: its slot and moment. */
export const itemId = (p: Pick<PendingAnswer, 'key' | 'decidedAt' | 'at'>) => `${slot(p)}@${p.at}`;

export function enqueue(list: readonly PendingAnswer[], item: PendingAnswer, inFlight: ReadonlySet<string>): PendingAnswer[] {
  const waiting = list.findIndex((p) => slot(p) === slot(item) && !inFlight.has(itemId(p)));
  if (waiting >= 0) {
    const merged = { ...item, delta: list[waiting].delta + item.delta };
    return [...list.slice(0, waiting), ...list.slice(waiting + 1), merged];
  }
  const next = [...list, item];
  // Over the cap the oldest unsent answers give way (a phone offline for a very long Taste session).
  while (next.length > OUTBOX_MAX) {
    const drop = next.findIndex((p) => !inFlight.has(itemId(p)));
    if (drop < 0) break;
    next.splice(drop, 1);
  }
  return next;
}

/** The next request's items: the oldest that aren't on their way already. */
export function nextBatch(list: readonly PendingAnswer[], inFlight: ReadonlySet<string>, size = BATCH_SIZE): PendingAnswer[] {
  return list.filter((p) => !inFlight.has(itemId(p))).slice(0, size);
}

/** The server took `sent`: they leave (a newer answer for the same title stays). */
export function acknowledge(list: readonly PendingAnswer[], sent: readonly PendingAnswer[]): PendingAnswer[] {
  const done = new Set(sent.map(itemId));
  return list.filter((p) => !done.has(itemId(p)));
}

/** How the waiting answers change the server's count. */
export const pendingDelta = (list: readonly PendingAnswer[]) => list.reduce((sum, p) => sum + p.delta, 0);

export function toWire(p: PendingAnswer): ProfileAnswerItem {
  return p.decidedAt === undefined
    ? { key: p.key, answer: p.answer, at: p.at }
    : { key: p.key, answer: p.answer, at: p.at, source: 'followup', decidedAt: p.decidedAt };
}

/** Compact storage form ([key, answer, at, delta, decidedAt?]): device stores keep small values. */
type Stored = [number, string | null, number, number, number?];
const ANSWERS = new Set(['loved', 'not_for_me', 'unseen', 'did_not_watch']);
export function encodeOutbox(list: readonly PendingAnswer[]): string {
  return JSON.stringify(list.map((p): Stored => (p.decidedAt === undefined ? [p.key, p.answer, p.at, p.delta] : [p.key, p.answer, p.at, p.delta, p.decidedAt])));
}
export function decodeOutbox(raw: string | null): PendingAnswer[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((row): PendingAnswer[] => {
      if (!Array.isArray(row)) return [];
      const [key, answer, at, delta, decidedAt] = row as Stored;
      if (!Number.isSafeInteger(key) || !Number.isSafeInteger(at) || !Number.isInteger(delta)) return [];
      if (answer !== null && !ANSWERS.has(answer)) return [];
      if (decidedAt !== undefined && !Number.isSafeInteger(decidedAt)) return [];
      return [{ key, answer: answer as PendingAnswer['answer'], at, delta, ...(decidedAt === undefined ? {} : { decidedAt }) }];
    }).slice(-OUTBOX_MAX);
  } catch {
    return [];
  }
}
