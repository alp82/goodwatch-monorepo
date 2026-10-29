// Development only, preloaded by dev-discover-bar.sh: refuses every outbound TCP connection except loopback and
// goodwatch.app (the live site's public read endpoints), before it connects, and logs it. A local server without
// databases then can't reach a production host even if a setting slips through.
import net from "node:net"

const ALLOWED =
	/^(127\.\d+\.\d+\.\d+|localhost|::1|::ffff:127\.\d+\.\d+\.\d+|goodwatch\.app)$/
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
	const first = Array.isArray(args[0]) ? args[0][0] : args[0]
	const options =
		typeof first === "object" && first !== null
			? first
			: { port: first, host: typeof args[1] === "string" ? args[1] : undefined }
	const host = options.host ?? "localhost"
	if (options.path || ALLOWED.test(host)) return connect.apply(this, args)
	console.error(`[egress blocked] ${host}:${options.port}`)
	process.nextTick(() => this.destroy(new Error(`egress blocked: ${host}`)))
	return this
}
