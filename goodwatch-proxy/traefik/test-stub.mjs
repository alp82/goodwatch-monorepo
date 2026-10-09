// A stand-in for one webapp instance or one search role in test-local.sh and test-search-local.sh. It answers the
// readiness endpoint, and on SIGTERM it does what the webapp does: readiness turns 503, it keeps serving for
// DRAIN_SECONDS, then it closes and exits.
//
// Every other request gets a JSON body that says what arrived: the method, the path, the body, and the headers that
// the tests look at. Two request headers ask for a special answer:
// - X-Stub-Busy: the search role's busy answer, 503 with Retry-After.
// - X-Stub-Stream: two lines, the second one 600 ms after the first, like the search response.
import { createServer } from "node:http"

const name = process.env.NAME
let ready = true
const padding = "x".repeat(2048)
const server = createServer(async (request, response) => {
	if (request.url === "/health/ready") {
		response.writeHead(ready ? 200 : 503, ready ? {} : { Connection: "close" })
		return response.end(ready ? "ready" : "draining")
	}
	let received = ""
	for await (const chunk of request) received += chunk
	const close = ready ? {} : { Connection: "close" }
	if (request.headers["x-stub-busy"]) {
		response.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Retry-After": "2", "X-Instance": name, ...close })
		return response.end('{"error":"Search is busy right now. Try again in a moment."}')
	}
	if (request.headers["x-stub-stream"]) {
		response.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Instance": name, ...close })
		response.write('{"kind":"reading"}\n')
		return setTimeout(() => response.end('{"kind":"batch"}\n'), 600)
	}
	const body = JSON.stringify({
		instance: name,
		host: request.headers.host,
		realIp: request.headers["x-real-ip"],
		forwardedFor: request.headers["x-forwarded-for"],
		forwardedProto: request.headers["x-forwarded-proto"],
		method: request.method,
		path: request.url,
		received,
		cookie: request.headers.cookie,
		origin: request.headers.origin,
		contentType: request.headers["content-type"],
		acceptLanguage: request.headers["accept-language"],
		custom: request.headers["x-custom"],
		role: request.headers["x-gw-role"],
		padding,
	})
	response.writeHead(200, { "Content-Type": "application/json", "X-Instance": name, ...close })
	response.end(body)
})
// PORT and HOST are for test-search-local.sh, which runs the stubs as processes on this machine.
server.listen(Number(process.env.PORT ?? 3000), process.env.HOST)
process.on("SIGTERM", () => {
	ready = false
	setTimeout(() => {
		server.close(() => process.exit(0))
		server.closeAllConnections()
	}, Number(process.env.DRAIN_SECONDS ?? 8) * 1000)
})
