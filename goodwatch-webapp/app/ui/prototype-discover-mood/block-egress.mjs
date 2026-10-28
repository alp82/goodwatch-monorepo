// PROTOTYPE - harness-only preload: refuses every outbound TCP connection except loopback and goodwatch.app (the
// prototype's read-only proxy), before it connects, and logs it.
import net from "node:net"
const ALLOWED = /^(127\.\d+\.\d+\.\d+|localhost|::1|::ffff:127\.\d+\.\d+\.\d+|goodwatch\.app)$/
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
	const first = Array.isArray(args[0]) ? args[0][0] : args[0]
	const opts = typeof first === "object" && first !== null ? first : { port: first, host: typeof args[1] === "string" ? args[1] : undefined }
	const host = opts.host ?? "localhost"
	if (opts.path || ALLOWED.test(host)) return connect.apply(this, args)
	console.error(`[egress blocked] ${host}:${opts.port}`)
	const socket = this
	process.nextTick(() => socket.destroy(new Error(`egress blocked: ${host}`)))
	return socket
}
