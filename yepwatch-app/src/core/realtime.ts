import type { RealtimeTicket, SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts';
import { ApiFailure, isRoomExpired } from './errors';
import { parseRealtimeFrame } from './wire';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'background' | 'unavailable' | 'expired';
export interface SocketLike {
  onopen: ((event: Event) => void) | null; onmessage: ((event: MessageEvent) => void) | null; onclose: ((event: CloseEvent) => void) | null; onerror: ((event: Event) => void) | null;
  send(data: string): void; close(): void;
}
type Timer = number | ReturnType<typeof setTimeout>;
export interface RealtimeOptions {
  roomId: string; ticket: () => Promise<RealtimeTicket>; socket: (path: string) => SocketLike;
  snapshot: (snapshot: SharedRoomSnapshot) => void; refetchPrivate: () => Promise<unknown>;
  status: (status: Connection) => void; revision: () => number | null; roomExpiresAt?: () => number | null;
  random?: () => number; later?: (callback: () => void, ms: number) => Timer; cancel?: (timer: Timer) => void;
}
/** Strictly no polling. Each reconnect authenticates with a fresh, one-use ticket. */
export class RoomRealtime {
  private socket?: SocketLike; private timer?: Timer; private watchdog?: Timer;
  private epoch = 0; private failures = 0; private active = false; private privateRefresh?: Promise<unknown>;
  private privateRefreshDirty = false;
  constructor(private readonly o: RealtimeOptions) {}
  private later(fn: () => void, ms: number) { return (this.o.later ?? setTimeout)(fn, ms); }
  private clear(timer?: Timer) { if (timer) (this.o.cancel ?? clearTimeout)(timer); }
  private detach() {
    this.clear(this.timer); this.clear(this.watchdog); this.timer = this.watchdog = undefined;
    if (this.socket) { const old = this.socket; this.socket = undefined; old.onclose = old.onerror = old.onopen = old.onmessage = null; old.close(); }
  }
  start() { this.active = true; this.failures = 0; this.detach(); const epoch = ++this.epoch; void this.connect(epoch); }
  pause() { this.active = false; this.privateRefreshDirty = false; ++this.epoch; this.detach(); this.o.status('background'); }
  stop() { this.active = false; this.privateRefreshDirty = false; ++this.epoch; this.detach(); }
  private refetch() {
    this.privateRefreshDirty = true;
    if (this.privateRefresh) return;
    // A push arriving during the read requires another read; it must not disappear into the in-flight promise.
    this.privateRefresh = (async () => {
      while (this.active && this.privateRefreshDirty) {
        this.privateRefreshDirty = false;
        await this.o.refetchPrivate().catch(() => undefined);
      }
    })().finally(() => { this.privateRefresh = undefined; if (this.active && this.privateRefreshDirty) this.refetch(); });
  }
  private retry(epoch: number, minimum = 0) {
    if (!this.active || epoch !== this.epoch) return;
    this.detach(); this.o.status('reconnecting');
    const delay = Math.max(Math.min(minimum, 30000), Math.min(30000, 500 * 2 ** Math.min(this.failures++, 6)) * (0.75 + (this.o.random ?? Math.random)() * 0.5));
    this.timer = this.later(() => { void this.connect(epoch); }, delay);
  }
  private heartbeat(epoch: number) {
    this.clear(this.watchdog);
    this.watchdog = this.later(() => this.retry(epoch), 35000);
    this.clear(this.timer);
    this.timer = this.later(() => { this.socket?.send(JSON.stringify({ type: 'ping' })); }, 20000);
  }
  private async connect(epoch: number) {
    if (!this.active || epoch !== this.epoch) return;
    this.o.status(this.failures ? 'reconnecting' : 'connecting');
    try {
      const ticket = await this.o.ticket();
      if (!this.active || epoch !== this.epoch) return;
      const socket = this.o.socket(ticket.websocketPath); this.socket = socket;
      this.watchdog = this.later(() => this.retry(epoch), 10000);
      socket.onopen = () => socket.send(JSON.stringify({ type: 'authenticate', ticket: ticket.ticket, roomId: this.o.roomId, lastRevision: this.o.revision() }));
      socket.onmessage = event => {
        if (!this.active || epoch !== this.epoch || this.socket !== socket) return;
        const frame = parseRealtimeFrame(event.data);
        if (!frame) { this.retry(epoch); return; }
        if (frame.type === 'room.snapshot' || frame.type === 'room.updated') {
          const view = frame.snapshot;
          if (view.roomId !== this.o.roomId || view.contractVersion !== 1 || !Number.isSafeInteger(view.revision) || 'own' in view || !Array.isArray(view.participants)) { this.retry(epoch); return; }
          if (view.revision >= (this.o.revision() ?? -1)) { this.o.snapshot(view); this.refetch(); }
          this.failures = 0; this.o.status(view.phase === 'expired' ? 'expired' : 'live'); this.heartbeat(epoch);
          if (view.phase === 'expired') this.stop();
        } else if (frame.type === 'pong') this.heartbeat(epoch);
        else if (frame.type === 'resync_required' && frame.roomId === this.o.roomId) this.retry(epoch);
        else if (frame.type === 'degraded' || frame.type === 'restarting') this.retry(epoch, frame.retryAfterMs);
        else if (frame.type === 'error') {
          if (frame.code === 'expired') {
            // Gateway leases expire independently of rooms. Repair HTTP and get a new ticket.
            const deadline = this.o.roomExpiresAt?.();
            if (deadline != null && deadline <= Date.now()) { this.stop(); this.o.status('expired'); }
            else { this.refetch(); this.retry(epoch); }
          } else if (['unauthorized', 'forbidden'].includes(frame.code)) { this.stop(); this.o.status('unavailable'); }
          else this.retry(epoch);
        }
      };
      socket.onclose = () => this.retry(epoch); socket.onerror = () => this.retry(epoch);
    } catch (error) {
      if (!this.active || epoch !== this.epoch) return;
      if (isRoomExpired(error)) { this.stop(); this.o.status('expired'); }
      else if (error instanceof ApiFailure && ['not_implemented', 'unauthorized', 'forbidden'].includes(error.code)) { this.stop(); this.o.status(error.code === 'expired' ? 'expired' : 'unavailable'); }
      else this.retry(epoch);
    }
  }
}
