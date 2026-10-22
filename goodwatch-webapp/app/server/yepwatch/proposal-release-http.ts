import { createServer } from "node:http"
import { Readable } from "node:stream"
/** Dedicated container listener; no request-body/path/credentials logging and no trusting a forwarded Host. */
export function releaseHttp(
	handler: (request: Request) => Promise<Response>,
	host: string,
	port: number
) {
	const server = createServer(async (incoming, outgoing) => {
		try {
			const request = new Request(
				`http://yepwatch-api.invalid${incoming.url}`,
				{
					method: incoming.method,
					headers: incoming.headers as Record<string, string>,
					...(incoming.method !== "GET" && incoming.method !== "HEAD"
						? {
								body: Readable.toWeb(incoming) as ReadableStream,
								duplex: "half",
						  }
						: {}),
				}
			)
			const response = await handler(request)
			const headers: Record<string, string | string[]> = Object.fromEntries(
				response.headers
			)
			const cookies = response.headers.getSetCookie()
			if (cookies.length) headers["set-cookie"] = cookies
			outgoing.writeHead(response.status, headers)
			outgoing.end(Buffer.from(await response.arrayBuffer()))
		} catch {
			outgoing.writeHead(503, {
				"content-type": "application/json",
				"cache-control": "no-store",
			})
			outgoing.end(
				JSON.stringify({
					error: {
						code: "busy",
						message: "Service unavailable; retain pending commands for retry",
						retryable: true,
					},
				})
			)
		}
	})
	server.requestTimeout = 30000
	server.headersTimeout = 10000
	return new Promise<typeof server>((resolve, reject) => {
		server.once("error", reject)
		server.listen(port, host, () => {
			server.off("error", reject)
			resolve(server)
		})
	})
}
