// Harness-only preload (NODE_OPTIONS=--import): refuses every outbound TCP connection that isn't to loopback,
// before it connects, and logs it. fetch (undici), ioredis, ws and the Crate client all connect through net.Socket.
import net from 'node:net';
import dgram from 'node:dgram';

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|::1|::ffff:127\.\d+\.\d+\.\d+)$/;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const opts = typeof first === 'object' && first !== null ? first : { port: first, host: typeof args[1] === 'string' ? args[1] : undefined };
  const host = opts.host ?? 'localhost';
  if (opts.path || LOOPBACK.test(host)) return connect.apply(this, args);
  console.error(`[e2e egress blocked] ${host}:${opts.port}`);
  const socket = this;
  process.nextTick(() => socket.destroy(new Error(`e2e egress blocked: ${host}`)));
  return socket;
};
const send = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (...args) {
  const host = args.find((a, i) => i > 0 && typeof a === 'string');
  if (host && !LOOPBACK.test(host)) throw new Error(`e2e egress blocked (udp): ${host}`);
  return send.apply(this, args);
};
