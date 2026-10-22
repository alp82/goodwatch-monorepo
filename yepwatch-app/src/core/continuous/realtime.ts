import {
  paths,
  type ActivityView,
  type ActivityGesture,
  type RealtimeTicket,
  type ServerActivity,
  type SharedRoomSnapshot,
} from '@goodwatch/yepwatch-contracts/continuous';
import type { SocketLike, Connection } from '../realtime';
import { RoomFailure } from './api-client';
import { parseFrame } from './wire';
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
}
/** One-use authentication, reactive private repair, fresh tickets on reconnect. No HTTP polling. */
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
  private reading?: Promise<void>;
  private dirty = false;
  private session: string | null = null;
  private sequence = 0;
  private view: ActivityView = 'voting';
  constructor(private readonly o: RealtimeOptions) {}
  private later(fn: () => void, ms: number) {
    return (this.o.later ?? setTimeout)(fn, ms);
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
    this.detach();
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
  sendActivity(view = this.view, gesture?: ActivityGesture, beat?: 'answer') {
    if (!this.active || !this.live || !this.session || !this.socket) return;
    this.socket.send(
      JSON.stringify({
        type: 'activity',
        sessionId: this.session,
        sequence: ++this.sequence,
        view,
        ...(gesture ? { gesture } : {}),
        ...(beat ? { beat } : {}),
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
    this.reading = (async () => {
      while (this.active && this.dirty) {
        this.dirty = false;
        try {
          await this.o.privateRead();
          this.repairFailures = 0;
          this.clear(this.repairTimer);
          this.repairTimer = undefined;
        } catch {
          // A bounded retry repairs one failed reconnect read even if no later revision arrives.
          if (this.active && this.repairFailures < 3) {
            const delay = 500 * 2 ** this.repairFailures++;
            this.clear(this.repairTimer);
            this.repairTimer = this.later(() => this.repair(), delay);
          }
        }
      }
    })().finally(() => {
      this.reading = undefined;
      if (this.active && this.dirty) this.repair();
    });
  }
  private retry(epoch: number, minimum = 0) {
    if (!this.active || epoch !== this.epoch) return;
    this.detach();
    this.o.status('reconnecting');
    const ms = Math.max(
      Math.min(minimum, 30000),
      Math.min(30000, 500 * 2 ** Math.min(6, this.failures++)) *
        (0.75 + (this.o.random ?? Math.random)() * 0.5)
    );
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
    this.o.status(this.failures ? 'reconnecting' : 'connecting');
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
          } else if (['unauthorized', 'forbidden', 'not_found'].includes(frame.code)) {
            this.stop();
            this.o.authorityError(
              new RoomFailure(frame.code, 'Your room access could not be restored.')
            );
            this.o.status('unavailable');
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
      } else this.retry(epoch);
    }
  }
}
