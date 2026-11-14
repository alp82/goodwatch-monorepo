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
import { backoffDelay, PLANNED_RESTART_QUIET_MS, RECONNECT_BASE_MS, serverWait } from './backoff';
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
/**
 * A WebSocket that hasn't opened by then is taken for a connection lost on the way: no answer and no error, the
 * browser would keep it connecting for as long as the network lets it (a lost SYN alone retries at 1 s, 3 s, 7 s).
 * It is dropped and a new one dialed (a new connection, a new route through every NAT on the way). Each handshake
 * that timed out in a row doubles the next one's wait up to OPEN_TIMEOUT_MAX_MS, so a slow network still gets through.
 */
export const OPEN_TIMEOUT_MS = 1500;
export const OPEN_TIMEOUT_MAX_MS = 10000;
/** After the socket opened: authentication and the gateway's first room snapshot. */
export const FIRST_SNAPSHOT_MS = 10000;
/** A spare ticket is used for the next dial only while this much of its life is left (clocks differ a little). */
export const SPARE_TICKET_MARGIN_MS = 5000;
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
  /** When the current socket's handshake times out (epoch ms). */
  private openDeadline = 0;
  /** Handshakes in a row that never opened (OPEN_TIMEOUT_MS). */
  private openTimeouts = 0;
  /**
   * The ticket of the last socket that failed before it opened. The ticket only goes out in the authenticate frame,
   * after the open, so it is still unused: the next dial takes it instead of asking for another (the API keeps at
   * most 4 unused tickets per person for 30 s, and each costs a round trip).
   */
  private spare?: RealtimeTicket;
  /** Epoch ms before which no new reconnect may start: the server named a wait (Retry-After, retryAfterMs). */
  private serverRetryAt = 0;
  /** Failed room reads in a row, shared by the resync read and the HTTP fallback. */
  private readFailures = 0;
  /** Epoch ms before which no room read may start (backoff or server Retry-After), for both readers. */
  private readAt = 0;
  /** The one room read in flight; the resync read and the HTTP fallback share it. */
  private reading?: Promise<boolean>;
  private repairing = false;
  private dirty = false;
  private session: string | null = null;
  private sequence = 0;
  private view: ActivityView = 'voting';
  private attempting = false;
  private pollTimer?: Timer;
  private polling = false;
  private pollSession = 0;
  /**
   * Epoch ms until which this outage counts as a restart the server announced (0: none). Set once, when a live socket
   * gets the gateway's "restarting" frame or close 1012, and never extended until the channel is live again: a server
   * that keeps announcing restarts can't keep the outage quiet past PLANNED_RESTART_QUIET_MS.
   */
  private plannedUntil = 0;
  constructor(private readonly o: RealtimeOptions) {}
  /** The status of an outage: `restarting` while it is an announced restart, else `reconnecting`. */
  private outage(): Connection {
    return this.plannedUntil > Date.now() ? 'restarting' : 'reconnecting';
  }
  private planned() {
    if (!this.plannedUntil) this.plannedUntil = Date.now() + PLANNED_RESTART_QUIET_MS;
  }
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
  /** `hung`: its socket's handshake never answered (OPEN_TIMEOUT_MS), so it is cut off now. */
  private detach(hung = false) {
    for (const timer of [this.retryTimer, this.ping, this.watchdog, this.renewal, this.repairTimer])
      this.clear(timer);
    this.retryTimer = this.ping = this.watchdog = this.renewal = this.repairTimer = undefined;
    this.live = false;
    this.session = null;
    this.o.clearActivity();
    if (this.socket) {
      const old = this.socket;
      this.socket = undefined;
      old.onclose = old.onerror = old.onmessage = null;
      // A socket still connecting is closed the moment it opens, before it says anything (React Native on Android
      // can't cancel one anyway). Closing it now would have the browser report a connection that failed ("closed
      // before the connection is established") for a socket this channel only replaced or stopped. Only a handshake
      // that hung is cut off at once: the browser connects one WebSocket per host at a time, so the redial would
      // wait behind it.
      old.onopen = () => old.close();
      if (hung || old.readyState !== 0) old.close();
      else {
        // Its open timeout still holds: one that hangs would make every later dial wait behind it.
        const deadline = this.later(() => { if (old.readyState === 0) old.close(); }, Math.max(0, this.openDeadline - Date.now()));
        old.onopen = () => { this.clear(deadline); old.close(); };
      }
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
    this.spare = undefined;
    this.plannedUntil = 0;
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
    // An attempt already running is kept (a second would ask for another ticket), and so is a wait the
    // server named. Only the waits that grew while requests got no answer at all start over.
    if (this.live || this.attempting || this.serverRetryAt > Date.now()) return;
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
      // Keeps ticking while the channel is degraded (nothing is sent then), so presence carries on after it.
      if (this.active && this.session) {
        this.sendActivity();
        this.renew();
      }
    }, 3000);
  }
  /**
   * One room read over HTTP. A read already in flight is shared, and a failure sets one deadline (backoff,
   * never shorter than a server Retry-After) that both the resync read and the HTTP fallback wait for.
   */
  private read(): Promise<boolean> {
    if (this.reading) return this.reading;
    const reading = this.o.privateRead().then(
      () => {
        this.readFailures = 0;
        this.readAt = 0;
        return true;
      },
      (e: unknown) => {
        this.readAt = Date.now() + backoffDelay(this.readFailures++, this.o.random ?? Math.random, serverWait(e));
        return false;
      }
    ).finally(() => {
      if (this.reading === reading) this.reading = undefined;
    });
    this.reading = reading;
    return reading;
  }
  /** Runs `fn` once the shared read deadline has passed. The timer is the deadline's authority (fake clocks too). */
  private afterDeadline(fn: () => void, minimum = 0) {
    const deadline = this.readAt;
    return this.later(() => {
      if (this.readAt > deadline) return void this.afterDeadline(fn, 0);
      if (this.readAt === deadline) this.readAt = 0;
      fn();
    }, Math.max(minimum, deadline - Date.now(), 0));
  }
  private repair() {
    this.dirty = true;
    if (this.repairing) return;
    // A failed read set a deadline: newer revisions (or a reconnect) wait for it instead of reading early.
    if (this.readAt > Date.now()) {
      if (this.repairTimer === undefined) this.scheduleRepair();
      return;
    }
    this.repairing = true;
    void (async () => {
      while (this.active && this.dirty) {
        // A read already in flight (the fallback's) may have started before this revision: let it finish,
        // then read again.
        if (this.reading) {
          await this.reading;
          if (this.readAt > Date.now()) break;
          continue;
        }
        this.dirty = false;
        if (!(await this.read())) {
          // The resync read keeps trying (backing off to 15 s, jittered) while the room is open, even if no
          // later revision arrives: a restart can take the API down longer than the socket.
          this.dirty = true;
          break;
        }
        this.clear(this.repairTimer);
        this.repairTimer = undefined;
      }
    })().finally(() => {
      this.repairing = false;
      if (!this.active || !this.dirty) return;
      if (this.readAt > Date.now()) this.scheduleRepair();
      else this.repair();
    });
  }
  private scheduleRepair() {
    this.clear(this.repairTimer);
    this.repairTimer = this.afterDeadline(() => {
      this.repairTimer = undefined;
      this.repair();
    });
  }
  /** Reads the room over HTTP until the live channel connects; while reads work the room counts as current. */
  private poll(ms = POLL_MS) {
    const session = this.pollSession;
    const current = () => this.active && !this.live && session === this.pollSession;
    // Never before the shared read deadline (a 429 on the resync read holds the fallback too).
    this.pollTimer = this.afterDeadline(() => {
      if (!current()) {
        if (session === this.pollSession) this.pollTimer = undefined;
        return;
      }
      void this.read().then((ok) => {
        if (!current()) {
          if (session === this.pollSession) this.pollTimer = undefined;
          return;
        }
        this.polling = ok;
        // Room reads that work end the outage for the page (`polling` is connected): an announcement from before
        // no longer explains a later failure.
        if (ok) this.plannedUntil = 0;
        this.o.status(ok ? 'polling' : this.outage());
        this.poll();
      });
    }, ms);
  }
  private stopPolling() {
    this.pollSession++;
    this.clear(this.pollTimer);
    this.pollTimer = undefined;
    this.polling = false;
  }
  private retry(epoch: number, minimum = 0, hung = false) {
    if (!this.active || epoch !== this.epoch) return;
    this.detach(hung);
    if (!this.polling) this.o.status(this.outage());
    const ms = backoffDelay(this.failures++, this.o.random ?? Math.random, minimum, RECONNECT_BASE_MS);
    this.serverRetryAt = minimum > 0 ? Date.now() + minimum : 0;
    if (this.failures >= POLL_AFTER_FAILURES && this.pollTimer === undefined) this.poll();
    this.report(false, Date.now() + ms);
    this.retryTimer = this.later(() => {
      void this.connect(epoch);
    }, ms);
  }
  /**
   * The gateway can't vouch for live updates just now (the API restarts, or its bus recovers) and sends a
   * fresh room snapshot as soon as it can. The socket stays: closing it would wait out the gateway's audit
   * period (10 s) after a restart that took 2. The room is read over HTTP meanwhile.
   */
  private degrade() {
    if (!this.live) return;
    this.live = false;
    this.o.clearActivity();
    this.repair();
    if (this.pollTimer === undefined) this.poll();
  }
  private heartbeat(epoch: number) {
    this.clear(this.watchdog);
    this.clear(this.ping);
    this.watchdog = this.later(() => this.retry(epoch), 35000);
    this.ping = this.later(() => this.socket?.send(JSON.stringify({ type: 'ping' })), 20000);
  }
  private async connect(epoch: number) {
    if (!this.active || epoch !== this.epoch) return;
    if (!this.polling) this.o.status(this.failures ? this.outage() : 'connecting');
    this.report(true);
    try {
      const spare = this.spare;
      this.spare = undefined;
      const ticket = spare && spare.expiresAt - Date.now() > SPARE_TICKET_MARGIN_MS ? spare : await this.o.ticket();
      if (!this.active || epoch !== this.epoch) return;
      if (ticket.websocketPath !== paths.realtime)
        throw new RoomFailure('invalid_request', 'Unexpected realtime destination.');
      const socket = this.o.socket(ticket.websocketPath);
      this.socket = socket;
      let opened = false;
      /** This socket carried the room live: only then is a restart it announces this outage's cause. */
      let served = false;
      // Failed before it opened: the ticket never left this device.
      const unopened = () => {
        if (!opened && this.active && epoch === this.epoch && socket === this.socket) this.spare = ticket;
      };
      const openWait = Math.min(OPEN_TIMEOUT_MAX_MS, OPEN_TIMEOUT_MS * 2 ** this.openTimeouts);
      this.openDeadline = Date.now() + openWait;
      this.watchdog = this.later(() => {
        unopened();
        this.openTimeouts++;
        this.retry(epoch, 0, true);
      }, openWait);
      socket.onopen = () => {
        if (!this.active || epoch !== this.epoch || socket !== this.socket) return;
        opened = true;
        this.openTimeouts = 0;
        this.clear(this.watchdog);
        this.watchdog = this.later(() => this.retry(epoch), FIRST_SNAPSHOT_MS);
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
      };
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
          // Back from degraded on the same socket: others see this person again at once, renewals carry on.
          const recovered = !this.live && this.session !== null;
          this.live = true;
          served = true;
          this.plannedUntil = 0;
          this.failures = 0;
          this.serverRetryAt = 0;
          this.stopPolling();
          if (recovered) {
            this.sendActivity();
            this.renew();
          }
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
        else if (frame.type === 'degraded') this.degrade();
        else if (frame.type === 'restarting') {
          if (served) this.planned();
          this.retry(epoch, frame.retryAfterMs);
        }
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
      socket.onerror = () => {
        unopened();
        this.retry(epoch);
      };
      socket.onclose = (event) => {
        // 1012 Service Restart: the gateway's own close when it stops (after its "restarting" frame).
        if (served && event?.code === 1012 && this.active && epoch === this.epoch && socket === this.socket) this.planned();
        unopened();
        this.retry(epoch);
      };
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
