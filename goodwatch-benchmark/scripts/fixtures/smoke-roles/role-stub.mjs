// Local test only, for test-smoke-roles.sh. A stand-in for a webapp process in one role: it answers the requests
// that the smoke check sends for roles, and a metrics endpoint. Binds to loopback and makes no outbound call.
// Usage: ROLE=page|search|both PORT=N node role-stub.mjs
import { createServer } from "node:http"

const role = process.env.ROLE ?? "both"
createServer(async (request, response) => {
	for await (const _ of request);
	const json = (status, value, headers = {}) => {
		response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers })
		response.end(JSON.stringify(value))
	}
	const path = request.url.split("?")[0]
	if (path === "/metrics") {
		response.writeHead(200, { "Content-Type": "text/plain" })
		// An uptime far beyond --log-wait: the check then reads the log once and doesn't wait.
		return response.end("goodwatch_process_uptime_seconds 500\ngoodwatch_redis_client_ready 1\ngoodwatch_redis_breaker_open_nodes 0\n")
	}
	if (path === "/health/ready" || path === "/") return response.end("ready")
	// A page role answers a palette lookup from TMDB and a search with the busy answer.
	if (path === "/api/command-palette") return json(200, { titles: [{ title: "The Matrix" }] }, { "Server-Timing": "titles;dur=1.0" })
	if (path === "/api/combined-search") {
		if (role === "page") return json(503, { error: "Search is busy right now. Try again in a moment." }, { "Retry-After": "2" })
		return json(400, { error: "Enter between 2 and 4096 bytes of search text" })
	}
	json(200, { version: 1 })
}).listen(Number(process.env.PORT), "127.0.0.1")
