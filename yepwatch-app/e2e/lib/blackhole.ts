// A network that drops packets silently, for one browser: a SOCKS5 proxy on loopback the browser sends all its traffic
// through (Room.person({ network })). While the hole is open nothing gets through and nothing fails: no error, no
// close, navigator.onLine stays true, as when a home line or a mobile network loses its route (2026-11-14 05:39, the
// production smoke runner lost every packet for 12 s).
//
// TCP is modeled, not just paused, so the timing after the network comes back is the real one:
//   - bytes sent while the hole is open (either way) are retransmitted by the sender: the first try after
//     RETRANSMIT_FIRST_MS, then each wait doubles (Linux RTO backoff). After the hole they get through at the sender's
//     next retransmission, not at once, and later bytes on that connection queue behind them;
//   - a close (FIN) sent meanwhile is lost the same way and arrives with the bytes before it;
//   - a new connection's SYN is lost: it is retried after SYN_FIRST_MS, then 2x each time (1 s, 3 s, 7 s, 15 s…),
//     and the connection only opens at the first retry after the hole.
// Loopback targets only: the browser reaches the hermetic stack and nothing else.
import net from 'node:net';

export const RETRANSMIT_FIRST_MS = 200;
export const SYN_FIRST_MS = 1000;

/** The first retry of a send made at `sentAt`, with retries after first, 3x first, 7x first… that falls at or after `at`. */
export function nextRetry(sentAt: number, at: number, first: number): number {
  let wait = first;
  let t = sentAt + wait;
  while (t < at) {
    wait *= 2;
    t += wait;
  }
  return t;
}

type Chunk = Buffer | 'end';
/** One direction of one connection: bytes go straight through, or wait for the sender's retransmission. */
class Lane {
  private queue: Chunk[] = [];
  /** When the oldest held byte was first sent (0: nothing held). */
  private since = 0;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private readonly hole: Blackhole, private readonly to: net.Socket) {}
  push(chunk: Chunk) {
    if (this.queue.length || this.hole.open) {
      if (!this.queue.length) this.since = Date.now();
      this.queue.push(chunk);
      this.schedule();
      return;
    }
    this.write(chunk);
  }
  private write(chunk: Chunk) {
    if (this.to.destroyed) return;
    if (chunk === 'end') this.to.end();
    else this.to.write(chunk);
  }
  /** Called when the hole closes: the held bytes go at their sender's next retransmission. */
  schedule() {
    clearTimeout(this.timer);
    if (!this.queue.length || this.hole.open) return;
    const at = nextRetry(this.since, Date.now(), RETRANSMIT_FIRST_MS);
    this.timer = setTimeout(() => {
      if (this.hole.open) return;
      for (const chunk of this.queue.splice(0)) this.write(chunk);
      this.since = 0;
    }, at - Date.now());
  }
  drop() {
    clearTimeout(this.timer);
    this.queue = [];
  }
}

export class Blackhole {
  open = false;
  /** Epoch ms of the last hole's start and end. */
  openedAt = 0;
  closedAt = 0;
  private server?: net.Server;
  private readonly lanes = new Set<Lane>();
  private readonly connecting = new Set<() => void>();
  /** SYN retries waiting to fire (cleared on close). */
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly sockets = new Set<net.Socket>();
  port = 0;
  /** What happened, for a failing test's report: [epoch ms, event]. */
  readonly log: [number, string][] = [];
  private seq = 0;

  async listen() {
    this.server = net.createServer((client) => this.accept(client));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as net.AddressInfo).port;
    return `socks5://127.0.0.1:${this.port}`;
  }

  /** Every packet from now on is lost, both ways. */
  drop() {
    this.open = true;
    this.openedAt = Date.now();
  }

  private upgradeArmed = false;
  /** The hole opens right behind the next WebSocket upgrade request: the server gets it, its answer is lost. */
  dropAfterUpgrade() {
    this.upgradeArmed = true;
  }

  /** Packets get through again; what was lost meanwhile arrives at its sender's next retransmission. */
  restore() {
    this.open = false;
    this.closedAt = Date.now();
    for (const lane of this.lanes) lane.schedule();
    for (const retry of [...this.connecting]) retry();
  }

  async close() {
    this.open = false;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.connecting.clear();
    for (const lane of this.lanes) lane.drop();
    for (const s of this.sockets) s.destroy();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private accept(client: net.Socket) {
    this.sockets.add(client);
    client.on('close', () => this.sockets.delete(client));
    client.on('error', () => {});
    client.setNoDelay(true);
    // The connection is the browser's dial: while the hole is open its SYN is lost, so it only goes ahead at the
    // first SYN retry after the hole (the browser sees a connection still connecting meanwhile, nothing more).
    const dialedAt = Date.now();
    const id = ++this.seq;
    this.log.push([dialedAt, `conn ${id} dialed${this.open ? ' (in the hole)' : ''}`]);
    client.once('close', () => this.log.push([Date.now(), `conn ${id} closed by browser`]));
    let early = Buffer.alloc(0);
    const collect = (b: Buffer) => {
      early = Buffer.concat([early, b]);
    };
    client.on('data', collect);
    let started = false;
    const start = () => {
      this.connecting.delete(go);
      if (started || client.destroyed) return;
      started = true;
      this.log.push([Date.now(), `conn ${id} connects`]);
      client.off('data', collect);
      this.handshake(client, early);
    };
    /** Its SYN met the open hole (and so waits for a retry after it). */
    let lost = false;
    const go = () => {
      if (started || client.destroyed) return;
      if (this.open) {
        lost = true;
        this.connecting.add(go);
        return;
      }
      this.connecting.delete(go);
      const wait = lost ? nextRetry(dialedAt, Date.now(), SYN_FIRST_MS) - Date.now() : 0;
      if (wait <= 0) return start();
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.open) this.connecting.add(go);
        else start();
      }, wait);
      this.timers.add(timer);
      client.once('close', () => {
        clearTimeout(timer);
        this.timers.delete(timer);
      });
    };
    client.once('close', () => this.connecting.delete(go));
    go();
  }

  /** SOCKS5, no authentication, CONNECT to loopback only. */
  private handshake(client: net.Socket, early: Buffer) {
    let buf = early;
    let stage: 'greeting' | 'request' = 'greeting';
    const feed = (b?: Buffer) => {
      if (b) buf = Buffer.concat([buf, b]);
      if (stage === 'greeting') {
        if (buf.length < 2 || buf.length < 2 + buf[1]) return;
        if (buf[0] !== 5) return void client.destroy();
        buf = buf.subarray(2 + buf[1]);
        client.write(Buffer.from([5, 0]));
        stage = 'request';
      }
      // CONNECT to an IPv4 address (1) or a name (3; Chromium sends the host as a name, resolved by the proxy).
      if (buf.length < 5) return;
      const atyp = buf[3];
      const end = atyp === 1 ? 10 : atyp === 3 ? 7 + buf[4] : -1;
      if (buf[0] !== 5 || buf[1] !== 1 || end < 0) {
        client.end(Buffer.from([5, 8, 0, 1, 0, 0, 0, 0, 0, 0]));
        return;
      }
      if (buf.length < end) return;
      const host = atyp === 1 ? `${buf[4]}.${buf[5]}.${buf[6]}.${buf[7]}` : buf.subarray(5, end - 2).toString('latin1');
      const port = buf.readUInt16BE(end - 2);
      const rest = buf.subarray(end);
      client.off('data', feed);
      if (host !== '127.0.0.1' && host !== 'localhost') {
        client.end(Buffer.from([5, 2, 0, 1, 0, 0, 0, 0, 0, 0]));
        return;
      }
      this.connect(client, port, rest);
    };
    client.on('data', feed);
    feed();
  }

  private connect(client: net.Socket, port: number, rest: Buffer) {
    const upstream = net.connect({ host: '127.0.0.1', port });
    this.sockets.add(upstream);
    upstream.setNoDelay(true);
    upstream.on('error', () => client.destroy());
    upstream.once('connect', () => {
      client.write(Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]));
      const up = new Lane(this, upstream);
      const down = new Lane(this, client);
      this.lanes.add(up);
      this.lanes.add(down);
      if (rest.length) up.push(rest);
      // The connection's first header block, however the bytes were split, to spot a WebSocket upgrade request.
      let head = rest.toString('latin1');
      let inspected = false;
      const inspect = () => {
        if (inspected) return;
        const end = head.indexOf('\r\n\r\n');
        if (end < 0 && head.length < 16384) return;
        inspected = true;
        const headers = head.slice(0, end < 0 ? head.length : end + 2);
        head = '';
        if (this.upgradeArmed && !this.open && /^GET [^\r]* HTTP\/1\.1\r\n/.test(headers) && /\r\nupgrade:\s*websocket\r\n/i.test(headers)) {
          this.upgradeArmed = false;
          this.drop();
        }
      };
      inspect();
      client.on('data', (b: Buffer) => {
        up.push(b);
        if (!inspected) {
          head += b.toString('latin1');
          inspect();
        }
      });
      upstream.on('data', (b: Buffer) => down.push(b));
      // A close goes the same way as the bytes before it (lost in the hole, arrives with its retransmission).
      let ended = 0;
      const gone = () => {
        if (++ended < 2) return;
        this.lanes.delete(up);
        this.lanes.delete(down);
      };
      client.once('close', () => {
        up.push('end');
        gone();
      });
      upstream.once('close', () => {
        this.sockets.delete(upstream);
        down.push('end');
        gone();
      });
    });
  }
}
