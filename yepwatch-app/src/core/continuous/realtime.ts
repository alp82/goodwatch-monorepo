import {
  paths,
  type ActivityView,
  type ActivityPointer,
  type ActivityGesture,
  type DecisionCheer,
  type MatchInspection,
  type RealtimeTicket,
  type ServerActivity,
  type SharedRoomSnapshot,
} from '@goodwatch/yepwatch-contracts/proposal';
import type { SocketLike, Connection } from '../realtime';
import { RoomFailure } from './api-client';
import { parseFrame } from './wire';
import { backoffDelay, serverWait } from './backoff';
type Timer = ReturnType<typeof setTimeout> | number;
export interface RealtimeOptions {
  roomId: string;
  ticket: () => Promise<RealtimeTicket>;
  socket: (path: string) => SocketLike;
  snapshot: (view: SharedRoomSnapshot) => void;
  privateRead: () => Promise<unknown>;
  revision: () => number | null;
  expiresAt: () => number | null;
  status: (status: Connection) => void;
  activity: (frame: ServerActivity) => void;
  clearActivity: () => void;
  serverClock: (offset: number) => void;
  authorityError: (error: RoomFailure) => void;
  later?: (fn: () => void, ms: number) => Timer;
  cancel?: (timer: Timer) => void;
  random?: () => number;
  /** Reconnect progress for the banner: an attempt is running, or the next one starts at `retryAt`. */
  attempt?: (state: ReconnectState) => void;
}
export interface ReconnectState {
  attempting: boolean;
  /** Epoch ms of the next automatic attempt; 0 when none is waiting. */
  retryAt: number;
}
/** Failed live attempts in a row before room reads over HTTP take over until the channel connects. */
export const POLL_AFTER_FAILURES = 2;
export const POLL_MS = 5000;
/**
 * One-use authentication, reactive private repair, fresh tickets on reconnect. When the channel keeps failing
 * (a browser or extension that blocks WebSockets), the room is read over HTTP every few seconds meanwhile.
 */
export class ContinuousRealtime {
  private active = false;
  private epoch = 0;
  private socket?: SocketLike;
  private live = false;
  private retryTimer?: Timer;
  private ping?: Timer;
  private watchdog?: Timer;
  private renewal?: Timer;
  private repairTimer?: Timer;
  private failures = 0;
  private repairFailures = 0;
  /** Epoch ms before which the resync read must not run again (backoff or server Retry-After). */
  private repairAt = 0;
  private reading?: Promise<void>;
  private dirty = false;
  private session: string | null = null;
  private sequence = 0;
  private view: ActivityView = 'voting';
  private attempting = false;
  private pollTimer?: Timer;
  private polling = false;
  private pollSession = 0;
  private pollFailures = 0;
  constructor(private readonly o: RealtimeOptions) {}
  private later(fn: () => void, ms: number) {
    return (this.o.later ?? setTimeout)(fn, ms);
  }
  private report(attempting: boolean, retryAt = 0) {
    this.attempting = attempting;
    this.o.attempt?.({ attempting, retryAt });
  }
  private clear(timer?: Timer) {
    if (timer !== undefined) (this.o.cancel ?? clearTimeout)(timer);
  }
  private detach() {
    for (const timer of [this.retryTimer, this.ping, this.watchdog, this.renewal, this.repairTimer])
      this.clear(timer);
    this.retryTimer = this.ping = this.watchdog = this.renewal = this.repairTimer = undefined;
    this.live = false;
    this.session = null;
    this.o.clearActivity();
    if (this.socket) {
      const old = this.socket;
      this.socket = undefined;
      old.onclose = old.onerror = old.onopen = old.onmessage = null;
      old.close();
    }
  }
  start() {
    this.active = true;
    this.failures = 0;
    this.detach();
    const epoch = ++this.epoch;
    void this.connect(epoch);
  }
  stop() {
    this.active = false;
    this.dirty = false;
    ++this.epoch;
    this.stopPolling();
    this.detach();
    this.report(false);
  }
  /** Refresh: try now instead of waiting for the next automatic attempt. A live or running attempt is kept. */
  reconnectNow() {
    if (!this.active) {
      this.start();
      return;
    }
    if (this.live || this.attempting) return;
    this.detach();
    const epoch = ++this.epoch;
    void this.connect(epoch);
  }
  /**
   * The device is back online (or the page came back to the front): connect now instead of waiting for
   * the backoff timer, which kept growing while every attempt failed offline. A live channel is kept.
   */
  resume() {
    if (!this.active) {
      this.start();
      return;
    }
    if (this.live) return;
    this.failures = 0;
    this.detach();
    const epoch = ++this.epoch;
    void this.connect(epoch);
  }
  pause() {
    this.sendActivity('away');
    this.stop();
    this.o.status('background');
  }
  setView(view: ActivityView) {
    if (this.view !== view) {
      this.view = view;
      this.sendActivity(view);
    }
  }
  private lastPointerAt = 0;
  sendPointer(pointer: ActivityPointer | null) {
    if (this.view !== 'voting') return;
    const now = Date.now();
    if (pointer && now - this.lastPointerAt < 280) return;
    this.lastPointerAt = now;
    this.sendActivity(undefined, undefined, undefined, undefined, pointer);
  }
  private cheerTimes: number[] = [];
  /** One decision cheer frame on the matches (Tonight) view. Never stored, so view renewals cannot replay it.
   * Client-side guard: at most 4 cheer frames per second; a release always goes out so holds never stick. */
  sendCheer(cheer: DecisionCheer) {
    if (!this.active || !this.live || !this.session || !this.socket) return false;
    const now = Date.now();
    this.cheerTimes = this.cheerTimes.filter((t) => now - t < 1000);
    if (cheer.kind !== 'release' && this.cheerTimes.length >= 4) return false;
    this.cheerTimes.push(now);
    this.socket.send(
      JSON.stringify({
        type: 'activity',
        sessionId: this.session,
        sequence: ++this.sequence,
        view: 'matches',
        cheer: { kind: cheer.kind, generation: cheer.generation, seed: cheer.seed },
      })
    );
    return true;
  }
  sendActivity(
    view = this.view,
    gesture?: ActivityGesture,
    beat?: 'answer',
    inspection?: MatchInspection,
    pointer?: ActivityPointer | null
  ) {
    if (!this.active || !this.live || !this.session || !this.socket) return;
    this.socket.send(
      JSON.stringify({
        type: 'activity',
        sessionId: this.session,
        sequence: ++this.sequence,
        view,
        ...(view === 'voting' && pointer !== undefined ? { pointer } : {}),
        ...(gesture ? { gesture } : {}),
        ...(view === 'voting' && beat ? { beat } : {}),
        ...(view === 'matches' && inspection ? { inspection } : {}),
      })
    );
  }
  private renew() {
    this.clear(this.renewal);
    this.renewal = this.later(() => {
      if (this.active && this.live) {
        this.sendActivity();
        this.renew();
      }
    }, 3000);
  }
  private repair() {
    this.dirty = true;
    if (this.reading) return;
    // A failed read set a deadline: newer revisions (or a reconnect) wait for it instead of reading early.
    const wait = this.repairAt - Date.now();
    if (wait > 0) {
      if (this.repairTimer === undefined) this.scheduleRepair(wait);
      return;
    }
    this.reading = (async () => {
      while (this.active && this.dirty) {
        this.dirty = false;
        try {
          await this.o.privateRead();
          this.repairFailures = 0;
          this.repairAt = 0;
          this.clear(this.repairTimer);
          this.repairTimer = undefined;
        } catch (e) {
          // The resync read keeps trying (backing off to 15 s, jittered) while the room is open, even if no
          // later revision arrives: a restart can take the API down longer than the socket. A server
          // Retry-After (busy, 429 rate limit) is a floor, never shortened.
          if (this.active) {
            const delay = backoffDelay(this.repairFailures++, this.o.random ?? Math.random, serverWait(e));
            this.repairAt = Date.now() + delay;
            this.scheduleRepair(delay);
          }
          return;
        }
      }
    })().finally(() => {
      this.reading = undefined;
      if (this.active && this.dirty) this.repair();
    });
  }
  private scheduleRepair(ms: number) {
    this.clear(this.repairTimer);
    this.repairTimer = this.later(() => {
      // The timer is the deadline's authority (tests and slow clocks alike).
      this.repairTimer = undefined;
      this.repairAt = 0;
      this.repair();
    }, ms);
  }
  /** Reads the room over HTTP until the live channel connects; while reads work the room counts as current. */
  private poll(ms = POLL_MS) {
    const session = this.pollSession;
    const current = () => this.active && !this.live && session === this.pollSession;
    this.pollTimer = this.later(() => {
      if (!current()) {
        if (session === this.pollSession) this.pollTimer = undefined;
        return;
      }
      void this.o.privateRead().then(
        () => {
          if (!current()) return POLL_MS;
          this.pollFailures = 0;
          this.polling = true;
          this.o.status('polling');
          return POLL_MS;
        },
        (e: unknown) => {
          // Failed reads back off like the resync read, and a server Retry-After is a floor.
          const wait = Math.max(POLL_MS, backoffDelay(this.pollFailures++, this.o.random ?? Math.random, serverWait(e)));
          if (!current()) return wait;
          this.polling = false;
          this.o.status('reconnecting');
          return wait;
        }
      ).then((next) => {
        if (current()) this.poll(next);
        else if (session === this.pollSession) this.pollTimer = undefined;
      });
    }, ms);
  }
  private stopPolling() {
    this.pollSession++;
    this.pollFailures = 0;
    this.clear(this.pollTimer);
    this.pollTimer = undefined;
    this.polling = false;
  }
  private retry(epoch: number, minimum = 0) {
    if (!this.active || epoch !== this.epoch) return;
    this.detach();
    if (!this.polling) this.o.status('reconnecting');
    const ms = backoffDelay(this.failures++, this.o.random ?? Math.random, minimum);
    if (this.failures >= POLL_AFTER_FAILURES && this.pollTimer === undefined) this.poll();
    this.report(false, Date.now() + ms);
    this.retryTimer = this.later(() => {
      void this.connect(epoch);
    }, ms);
  }
  private heartbeat(epoch: number) {
    this.clear(this.watchdog);
    this.clear(this.ping);
    this.watchdog = this.later(() => this.retry(epoch), 35000);
    this.ping = this.later(() => this.socket?.send(JSON.stringify({ type: 'ping' })), 20000);
  }
  private async connect(epoch: number) {
    if (!this.active || epoch !== this.epoch) return;
    if (!this.polling) this.o.status(this.failures ? 'reconnecting' : 'connecting');
    this.report(true);
    try {
      const ticket = await this.o.ticket();
      if (!this.active || epoch !== this.epoch) return;
      if (ticket.websocketPath !== paths.realtime)
        throw new RoomFailure('invalid_request', 'Unexpected realtime destination.');
      const socket = this.o.socket(ticket.websocketPath);
      this.socket = socket;
      this.watchdog = this.later(() => this.retry(epoch), 10000);
      socket.onopen = () =>
        socket.send(
          JSON.stringify({
            type: 'authenticate',
            ticket: ticket.ticket,
            roomId: this.o.roomId,
            lastRevision: this.o.revision(),
            pointers: true,
            cheers: true,
            roomDetails: true,
          })
        );
      socket.onmessage = (event) => {
        if (!this.active || epoch !== this.epoch || socket !== this.socket) return;
        const frame = parseFrame(event.data);
        if (!frame) {
          this.retry(epoch);
          return;
        }
        if (frame.type === 'room.snapshot' || frame.type === 'room.updated') {
          if (frame.snapshot.roomId !== this.o.roomId) {
            this.retry(epoch);
            return;
          }
          if (frame.snapshot.revision >= (this.o.revision() ?? -1)) {
            this.o.snapshot(frame.snapshot);
            if (!this.active) return;
            this.repair();
          }
          if (frame.snapshot.phase === 'expired') {
            this.stop();
            this.o.status('expired');
            return;
          }
          this.live = true;
          this.failures = 0;
          this.stopPolling();
          this.report(false);
          this.o.status('live');
          this.heartbeat(epoch);
        } else if (frame.type === 'activity.session') {
          if (!this.live || frame.roomId !== this.o.roomId) return;
          this.session = frame.sessionId;
          this.sequence = 0;
          this.o.serverClock(frame.serverTime - Date.now());
          this.sendActivity();
          this.renew();
        } else if (frame.type === 'activity') {
          if (this.live && frame.roomId === this.o.roomId) this.o.activity(frame);
        } else if (frame.type === 'pong') this.heartbeat(epoch);
        else if (frame.type === 'resync_required') this.retry(epoch);
        else if (frame.type === 'degraded' || frame.type === 'restarting')
          this.retry(epoch, frame.retryAfterMs);
        else if (frame.type === 'error') {
          if (frame.code === 'expired') {
            if ((this.o.expiresAt() ?? Infinity) <= Date.now()) {
              this.stop();
              this.o.status('expired');
            } else {
              this.repair();
              this.retry(epoch);
            }
          // Any other refusal reconnects with a fresh ticket, and that HTTP answer decides access. The
          // gateway also says "unauthorized" when the authenticate frame came late (a network that
          // dropped right after the socket opened), which is not lost access.
          } else this.retry(epoch);
        }
      };
      socket.onerror = socket.onclose = () => this.retry(epoch);
    } catch (e) {
      if (!this.active || epoch !== this.epoch) return;
      if (
        e instanceof RoomFailure &&
        (e.status === 410 ||
          ['expired', 'unauthorized', 'forbidden', 'not_found', 'not_implemented'].includes(e.code))
      ) {
        this.stop();
        this.o.authorityError(e);
        this.o.status(e.code === 'expired' || e.status === 410 ? 'expired' : 'unavailable');
      } else this.retry(epoch, serverWait(e));
    }
  }
}
