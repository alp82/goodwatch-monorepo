// Harness-only preload: refuses every outbound TCP connection that isn't to loopback, before it connects, and
// logs it. Fetch (undici), ioredis and the Crate client all connect through net.Socket.
import net from "node:net"
const LOOPBACK =
	/^(127\.\d+\.\d+\.\d+|localhost|::1|::ffff:127\.\d+\.\d+\.\d+)$/
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
	const first = Array.isArray(args[0]) ? args[0][0] : args[0]
	const opts =
		typeof first === "object" && first !== null
			? first
			: { port: first, host: typeof args[1] === "string" ? args[1] : undefined }
	const host = opts.host ?? "localhost"
	if (opts.path || LOOPBACK.test(host)) return connect.apply(this, args)
	console.error(`[egress blocked] ${host}:${opts.port}`)
	process.nextTick(() => this.destroy(new Error(`egress blocked: ${host}`)))
	return this
}
