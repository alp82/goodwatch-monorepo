// Stand-ins for what the browser can get on the search paths, for the tests of the search page, Discover's search,
// and the command palette. Only tests import this.
import { mock } from "node:test"

/** The search role's own busy answer, as searchBusyResponse in server/search-runtime/admission.server.ts builds it. */
export const busyAnswer = () =>
	new Response(
		JSON.stringify({
			error: "Search is busy right now. Try again in a moment.",
		}),
		{
			status: 503,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "private, no-store",
				"Retry-After": "2",
			},
		},
	)

/** What the proxy answers by itself when no search role is healthy: no JSON body. */
export const gatewayAnswers: Record<string, () => Response> = {
	"a 502 with an HTML body": () =>
		new Response("<html><body>Bad Gateway</body></html>", {
			status: 502,
			headers: { "Content-Type": "text/html" },
		}),
	"a 503 without a body": () => new Response(null, { status: 503 }),
	"a 503 with a plain text body": () =>
		new Response("no available server\n", {
			status: 503,
			headers: { "Content-Type": "text/plain" },
		}),
	"a 504 without a body": () => new Response(null, { status: 504 }),
}

/** What `fetch` rejects with when the connection fails. */
export const networkError = () => new TypeError("Failed to fetch")

/** Replaces `fetch` for one test. Returns the mock, for the number of requests. */
export function stubFetch(
	t: { after: (fn: () => void) => void },
	answer: () => Response | Promise<Response>,
) {
	const original = globalThis.fetch
	const stub = mock.fn(async () => answer())
	globalThis.fetch = stub as unknown as typeof fetch
	t.after(() => {
		globalThis.fetch = original
	})
	return stub
}

/** A ranked stream: one JSON message per line. */
export const streamAnswer = (...messages: unknown[]) =>
	new Response(messages.map((message) => `${JSON.stringify(message)}\n`).join(""), {
		headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
	})
