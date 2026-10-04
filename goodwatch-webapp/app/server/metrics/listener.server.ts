// Exposes metrics on a separate container port so the public Remix server has no metrics route.
import { createServer } from "node:http"
import { ignoreMetricsServer } from "./http.server"
import { renderMetrics } from "./registry.server"

export function startMetricsListener(): void {
	const configured =
		process.env.METRICS_PORT ??
		(process.env.NODE_ENV === "production" ? "9464" : "off")
	if (configured === "off" || configured === "0") return
	const port = Number(configured)
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		console.error("Metrics listener disabled: invalid METRICS_PORT")
		return
	}
	const server = createServer((request, response) => {
		if (request.method !== "GET" || request.url !== "/metrics") {
			response.writeHead(404).end()
			return
		}
		response.writeHead(200, {
			"Content-Type": "text/plain; version=0.0.4; charset=utf-8",
		})
		response.end(renderMetrics())
	})
	ignoreMetricsServer(server)
	server.once("error", (error: NodeJS.ErrnoException) => {
		console.error(`Metrics listener disabled: ${error.code ?? "listen error"}`)
	})
	// Private to the Docker network: this port is not published and Traefik routes only to port 3000.
	server.listen(port, "0.0.0.0")
	server.unref()
}
