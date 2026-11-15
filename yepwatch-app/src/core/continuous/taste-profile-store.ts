import type { ProfileAnswersRequest, ProfileAnswersResponse, ProfileSummary, TasteAnswer, TasteCard } from '@goodwatch/yepwatch-contracts/proposal';
import { backoffDelay, serverWait } from './backoff';
import {
  acknowledge, BATCH_SIZE, decodeOutbox, encodeOutbox, enqueue, itemId, nextBatch, pendingDelta, ratedDelta, toWire,
  type FollowUpAnswer, type PendingAnswer,
} from './taste-outbox';

/** A next-day question: the decided title and when it was decided. */
export type FollowUp = TasteCard & { decidedAt: number };
export interface TasteProfileView {
  /** idle: never read · loading: the first read is on its way · ready · failed: the last read failed (counts stay). */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Titles answered Loved it or Not for me, waiting answers included; null until the profile was read once. */
  rated: number | null;
  /** Next-day questions, newest first, without the ones answered on this device. */
  followUps: readonly FollowUp[];
}
export interface TasteProfileApi {
  profile(): Promise<ProfileSummary>;
  profileAnswers(body: ProfileAnswersRequest): Promise<ProfileAnswersResponse>;
  deleteProfile(): Promise<void>;
}
export interface TasteProfileDeps {
  api: TasteProfileApi;
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
  /** Forgets the device secret (Reset my taste): the next request makes a new one. */
  forgetSecret(): Promise<void>;
  now?: () => number;
  wait?: (ms: number, run: () => void) => () => void;
  random?: () => number;
}
type Failure = Error & { status?: number; retryAfterSeconds?: number };
const followUpId = (f: { key: number; decidedAt: number }) => `${f.key}@${f.decidedAt}`;

/**
 * The device's taste profile: the last read of GET /profile and the answers on their way. Answers go in batches of
 * up to 10, when Taste mode closes (flush) and when the app leaves the front; a failed send goes again after a backoff
 * while the app is in front. A stale revision (409) reads the profile again and resends the same items (same `at`).
 */
export class TasteProfileStore {
  private view: TasteProfileView = { status: 'idle', rated: null, followUps: [] };
  private listeners = new Set<() => void>();
  private pending: PendingAnswer[] = [];
  private inFlight = new Set<string>();
  private summary: ProfileSummary | null = null;
  private answeredFollowUps = new Set<string>();
  private lastAt = 0;
  private failures = 0;
  private conflicts = 0;
  private cancelRetry: (() => void) | null = null;
  private sending: Promise<void> | null = null;
  private reading: Promise<ProfileSummary | null> | null = null;
  private readAt = 0;
  /** Bumped by Reset: a read that started before it belongs to the forgotten profile and is dropped. */
  private epoch = 0;
  private restored: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  /** In front (app active, page visible): only then do failed sends go again by themselves. */
  private front = true;
  private readonly now: () => number;
  private readonly wait: NonNullable<TasteProfileDeps['wait']>;
  private readonly random: () => number;

  constructor(private readonly deps: TasteProfileDeps) {
    this.now = deps.now ?? Date.now;
    this.wait = deps.wait ?? ((ms, run) => { const t = setTimeout(run, ms); return () => clearTimeout(t); });
    this.random = deps.random ?? Math.random;
    this.restored = deps.read().then((raw) => {
      this.pending = [...decodeOutbox(raw), ...this.pending];
      this.lastAt = Math.max(this.lastAt, ...this.pending.map((p) => p.at));
      this.publish();
      // Answers kept from an earlier run go out without waiting for a new answer or Taste mode closing.
      if (this.pending.length) void this.flush();
    }, () => undefined);
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.view;

  /** Reads GET /profile (at most once every `maxAgeMs`; concurrent calls share one read). */
  load(maxAgeMs = 0): Promise<ProfileSummary | null> {
    if (this.reading) return this.reading;
    if (this.summary && this.now() - this.readAt < maxAgeMs) return Promise.resolve(this.summary);
    if (this.view.status === 'idle') this.set({ status: 'loading' });
    const epoch = this.epoch;
    const reading: Promise<ProfileSummary | null> = this.deps.api.profile().then((summary) => {
      // Reset came in between (the read was of the forgotten profile), or a send already moved past this revision.
      if (epoch !== this.epoch) return this.summary;
      if (this.summary && summary.revision < this.summary.revision) return this.summary;
      this.summary = summary;
      this.readAt = this.now();
      this.publish('ready');
      return summary;
    }, () => {
      if (epoch === this.epoch) this.publish(this.summary ? 'ready' : 'failed');
      return epoch === this.epoch ? null : this.summary;
    }).finally(() => { if (this.reading === reading) this.reading = null; });
    this.reading = reading;
    return reading;
  }

  /** A Taste card answered; `previous` is what this title had before (an answer changed or undone). */
  answer(key: number, answer: TasteAnswer | null, previous: TasteAnswer | null = null) {
    this.add({ key, answer, at: this.stamp(), delta: ratedDelta(answer) - ratedDelta(previous) });
    if (nextBatch(this.pending, this.inFlight).length >= BATCH_SIZE) void this.flush();
  }

  /** A next-day question answered: it leaves this device's list at once and goes out right away. */
  answerFollowUp(f: { key: number; decidedAt: number }, answer: FollowUpAnswer) {
    this.answeredFollowUps.add(followUpId(f));
    this.add({ key: f.key, answer, at: this.stamp(), decidedAt: f.decidedAt, delta: ratedDelta(answer) });
    void this.flush();
  }

  /** Sends everything waiting now (Taste mode closing, the app leaving the front). */
  flush(): Promise<void> {
    this.sending ??= this.run().finally(() => { this.sending = null; });
    return this.sending;
  }

  /**
   * In front again (or not): whatever waits goes now, a failed send waiting out its backoff included. Also when the
   * send failed while away (no retry was planned then).
   */
  setFront(front: boolean) {
    this.front = front;
    this.cancelRetry?.();
    this.cancelRetry = null;
    void this.flush();
  }

  /** Reset my taste: the server forgets the profile and this device makes a new one next time. */
  async reset() {
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.epoch += 1;
    this.reading = null;
    await this.sending?.catch(() => undefined);
    await this.deps.api.deleteProfile();
    await this.deps.forgetSecret();
    // Reads started while the profile was being deleted were of the old one too.
    this.epoch += 1;
    this.reading = null;
    this.pending = [];
    this.inFlight.clear();
    this.answeredFollowUps.clear();
    this.summary = { answered: 0, loved: 0, notForMe: 0, unseen: 0, revision: 0, followups: [] };
    this.readAt = this.now();
    this.persist();
    this.publish('ready');
  }

  private stamp() {
    this.lastAt = Math.max(this.now(), this.lastAt + 1);
    return this.lastAt;
  }

  private add(item: PendingAnswer) {
    this.pending = enqueue(this.pending, item, this.inFlight);
    this.persist();
    this.publish();
  }

  private persist() {
    const value = this.pending.length ? encodeOutbox(this.pending) : null;
    this.writes = this.writes.then(() => this.deps.write(value)).catch(() => undefined);
  }

  private async run() {
    await this.restored;
    while (true) {
      const batch = nextBatch(this.pending, this.inFlight);
      if (!batch.length) return;
      if (!this.summary && !(await this.load())) { this.retryLater(); return; }
      const ids = batch.map(itemId);
      ids.forEach((id) => this.inFlight.add(id));
      try {
        const answer = await this.deps.api.profileAnswers({ revision: this.summary!.revision, items: batch.map(toWire) });
        this.failures = 0;
        this.conflicts = 0;
        this.pending = acknowledge(this.pending, batch);
        this.summary = { ...this.summary!, revision: answer.revision, answered: answer.answered };
        this.persist();
        this.publish();
      } catch (e) {
        const failure = e as Failure;
        if (failure.status === 409) {
          // Another device or tab wrote first: read the revision again and send the same items. Conflicts that keep
          // coming wait like a failed send (the answers stay).
          this.summary = null;
          if (++this.conflicts <= 3) continue;
          this.conflicts = 0;
          this.failures += 1;
          this.retryLater();
          return;
        }
        if (failure.status !== undefined && failure.status >= 400 && failure.status < 500 && failure.status !== 408 && failure.status !== 429) {
          // Refused for good (a next-day question past its week, a malformed item): it leaves, so the rest can go.
          this.conflicts = 0;
          this.pending = acknowledge(this.pending, batch);
          this.persist();
          this.publish();
          continue;
        }
        this.failures += 1;
        this.retryLater(serverWait(e));
        return;
      } finally {
        ids.forEach((id) => this.inFlight.delete(id));
      }
    }
  }

  private retryLater(minimum = 0) {
    if (!this.front) return;
    this.cancelRetry?.();
    this.cancelRetry = this.wait(backoffDelay(this.failures, this.random, minimum), () => { this.cancelRetry = null; void this.flush(); });
  }

  private set(patch: Partial<TasteProfileView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  private publish(status = this.view.status) {
    const summary = this.summary;
    const rated = summary ? Math.max(0, summary.answered + pendingDelta(this.pending)) : this.view.rated;
    const followUps = summary ? summary.followups.filter((f) => !this.answeredFollowUps.has(followUpId(f))) : this.view.followUps;
    const same = status === this.view.status && rated === this.view.rated && followUps.length === this.view.followUps.length && followUps.every((f, i) => f === this.view.followUps[i]);
    if (!same) this.set({ status, rated, followUps });
  }
}
