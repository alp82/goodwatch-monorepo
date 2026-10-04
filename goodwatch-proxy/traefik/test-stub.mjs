// A stand-in for one webapp instance in test-local.sh. It answers the readiness endpoint, and on SIGTERM it does what
// the webapp does: readiness turns 503, it keeps serving for DRAIN_SECONDS, then it closes and exits.
import { createServer } from "node:http"

const name = process.env.NAME
let ready = true
const padding = "x".repeat(2048)
const server = createServer((request, response) => {
	if (request.url === "/health/ready") {
		response.writeHead(ready ? 200 : 503, ready ? {} : { Connection: "close" })
		return response.end(ready ? "ready" : "draining")
	}
	const body = JSON.stringify({
		instance: name,
		host: request.headers.host,
		realIp: request.headers["x-real-ip"],
		forwardedFor: request.headers["x-forwarded-for"],
		forwardedProto: request.headers["x-forwarded-proto"],
		padding,
	})
	response.writeHead(200, { "Content-Type": "application/json", "X-Instance": name, ...(ready ? {} : { Connection: "close" }) })
	response.end(body)
})
server.listen(3000)
process.on("SIGTERM", () => {
	ready = false
	setTimeout(() => {
		server.close(() => process.exit(0))
		server.closeAllConnections()
	}, Number(process.env.DRAIN_SECONDS ?? 8) * 1000)
})
