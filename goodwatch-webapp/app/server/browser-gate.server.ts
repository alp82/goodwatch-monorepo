// Answers requests for the site's endless URL sets before Express and Remix see them: the filtered views of a person
// page, and sign-in and sign-up with a return page. A client without the cookie that every page sets with a script
// (see ~/utils/browser-cookie) gets the browser check at the URL it asked for: one small fixed response, with no
// redirect, no session lookup, no database and no render. A browser sets the cookie there and reloads, and gets the
// page. A crawler that doesn't run scripts gets the same few hundred bytes for every such URL.
//
// Rule for a page cache in front of the webapp: never store the check (it is 403 with `private, no-store`), and send a
// request that it can't answer from its store to the webapp with its Cookie header, so that this file can tell a
// browser from a crawler. A stored filtered page may be served to anyone.
import { subscribe } from "node:diagnostics_channel"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { isbot } from "isbot"
import { BROWSER_COOKIE } from "../utils/browser-cookie.ts"

export type GateAnswer = {
	kind: "check" | "crawler" | "gone"
	status: number
	headers: Record<string, string>
	body: string
}

const HAS_COOKIE = new RegExp(`(?:^|;\\s*)${BROWSER_COOKIE}=1(?:;|$)`)

/** Whether a Cookie header carries the cookie that pages set with a script. */
export const hasBrowserCookieIn = (cookie: string | null | undefined) =>
	HAS_COOKIE.test(cookie ?? "")

// The check is the same for every URL: it reads the address from the browser, so nothing from the request is echoed.
// - A browser that didn't have the cookie and can keep it reloads, and gets the page it asked for. `reload` and not
//   `replace`, because replacing a URL with itself only scrolls when the URL has a fragment (#titles).
// - With cookies switched off, or when the cookie was there and the server still asked (something on the way drops
//   it), the browser goes to the page without its query: reloading would come back here forever.
// - Without scripts, the link leads to the same place.
const CHECK_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>GoodWatch</title>
<script>(function(){var c="${BROWSER_COOKIE}=1",had=document.cookie.indexOf(c)>=0;document.cookie=c+"; Path=/; Max-Age=31536000; SameSite=Lax";if(!had&&document.cookie.indexOf(c)>=0)location.reload();else location.replace(location.pathname)})()</script>
</head><body><noscript><a href="?">Continue to GoodWatch</a></noscript></body></html>`

const html = (body: string) => ({
	"Content-Type": "text/html; charset=utf-8",
	"Content-Length": String(Buffer.byteLength(body)),
	// Not the page: no cache may keep it under the page's URL, and no search engine may index it.
	"Cache-Control": "private, no-store",
	"X-Robots-Tag": "noindex",
	Vary: "Cookie",
})

// 403 and not 200: the response isn't the page at this URL, so caches, monitors and the metrics must be able to tell
// the two apart by status. Browsers run the script of a 403 page like any other. Not 429 or 503, which ask a crawler
// to come back.
const CHECK: GateAnswer = {
	kind: "check",
	status: 403,
	headers: html(CHECK_HTML),
	body: CHECK_HTML,
}

// The check used to be a page of its own that filtered views redirected to. Nothing links or redirects there now.
const GONE_HTML = "Gone"
const GONE: GateAnswer = {
	kind: "gone",
	status: 410,
	headers: { ...html(GONE_HTML), "Content-Type": "text/plain; charset=utf-8" },
	body: GONE_HTML,
}

/** A crawler that names itself is sent to the page without its query for good, so that search engines keep one URL. */
const toUnfiltered = (pathname: string): GateAnswer => ({
	kind: "crawler",
	status: 301,
	headers: {
		Location: pathname,
		"Content-Length": "0",
		"Cache-Control": "private, no-store",
	},
	body: "",
})

const PERSON = /^\/person\/[^/]+\/?$/
const AUTH = /^\/sign-(?:in|up)\/?$/
const RETURN_PAGE = /(?:^|&)redirectTo=/
// Remix's own request for a loader's data during navigation in the app. The loader answers those.
const LOADER_DATA = /(?:^|&)_data=/

/**
 * The answer to a request that must not reach the app, or null when the app handles it. `url` is the request target
 * as Node gives it: the path and the query.
 */
export function gateAnswer(
	method: string | undefined,
	url: string | undefined,
	headers: { cookie?: string; "user-agent"?: string },
): GateAnswer | null {
	if (!url || (method !== "GET" && method !== "HEAD")) return null
	const at = url.indexOf("?")
	const pathname = at < 0 ? url : url.slice(0, at)
	const query = at < 0 ? "" : url.slice(at + 1)
	if (pathname === "/browser-check") return GONE
	if (!query || LOADER_DATA.test(query)) return null
	const endless =
		PERSON.test(pathname) || (AUTH.test(pathname) && RETURN_PAGE.test(query))
	if (!endless || hasBrowserCookieIn(headers.cookie)) return null
	return isbot(headers["user-agent"]) ? toUnfiltered(pathname) : CHECK
}

// Shared across module reloads in development: the listener of the first load keeps running.
const key = Symbol.for("goodwatch.browser-gate")
const shared = globalThis as typeof globalThis & {
	[key]?: {
		started: boolean
		gated: WeakSet<Server>
		counts: { check: number; crawler: number; gone: number }
	}
}
shared[key] ??= {
	started: false,
	gated: new WeakSet(),
	counts: { check: 0, crawler: 0, gone: 0 },
}
const state = shared[key]
// What the gate answered since the last report.
const counts = state.counts

/** Counts of the gate's answers since the last call. Resets them. */
export function takeGateCounts(): typeof counts {
	const taken = { ...counts }
	counts.check = counts.crawler = counts.gone = 0
	return taken
}

/**
 * Puts the gate in front of everything else the server does with a request. The listeners that were there get the
 * requests the gate doesn't answer.
 */
export function putGateFirst(server: Server): void {
	if (state.gated.has(server)) return
	state.gated.add(server)
	const listeners = server.listeners("request")
	server.removeAllListeners("request")
	server.on("request", (request: IncomingMessage, response: ServerResponse) => {
		let answer: GateAnswer | null = null
		try {
			answer = gateAnswer(request.method, request.url, request.headers)
		} catch {
			// The app answers.
		}
		if (!answer) {
			for (const listener of listeners)
				Reflect.apply(listener, server, [request, response])
			return
		}
		counts[answer.kind]++
		response.writeHead(answer.status, answer.headers)
		response.end(request.method === "HEAD" ? undefined : answer.body)
	})
}

/**
 * Starts the gate on every HTTP server of this process, once. `remix-serve` and the Vite dev server create the server
 * themselves, so the gate finds it through Node's request event, which is published before the server's listeners run:
 * the gate already answers the request that it was installed on.
 */
export function startBrowserGate(): void {
	if (state.started) return
	state.started = true
	subscribe("http.server.request.start", (message) => {
		const { server } = message as { server: Server }
		putGateFirst(server)
	})
}
