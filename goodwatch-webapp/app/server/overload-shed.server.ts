// Answers anonymous page requests from clients that never ran the site's scripts with a short busy page while this
// process is overloaded, before the page cache misses, the loaders and the render. Measured in the proxy's access log on
// November 12 and 13, 2026: over 99% of the site's requests are anonymous, about three quarters of the render time goes
// to crawlers, and one crawler asked for 12,000 different title pages from 12,000 addresses in four minutes, which no
// per-address limit sees. Both instances then ran seconds late, failed the proxy's health check in turn, and the proxy
// answered 503 to everyone. Shedding the anonymous script-less part keeps the event loop, the health check and the
// visitors' pages on time.
//
// - Overloaded: the event loop runs late (a timer every 100 ms; the delay decays by 30% per tick, so one long stall
//   counts for a moment after it ends, and the backlog that built up during the stall is shed instead of rendered), or
//   more requests are in the app than OVERLOAD_IN_FLIGHT. Once overloaded, it stays so for HOLD_MS.
// - Who is shed: a GET or HEAD for a page (not an API, not Remix's own data request) without the member cookie and
//   without the cookie that every page sets with a script. Search engines, link preview fetchers and the status
//   monitor named in their user agent are let through. Everyone else is served as before.
// - The answer: 503 with `Retry-After`, `no-store` and `noindex`, a few hundred bytes. In a browser its script sets
//   the cookie and reloads after a moment, and that request passes. A browser that can't keep the cookie (or had it and
//   lost it on the way) reloads only after `Retry-After`, never in a fast loop. A crawler that runs no script gets the
//   same small answer until the load is gone.
// - Health checks and static files never get here: they are answered by the wrappers inside and outside this one.
//
// Settings: OVERLOAD_SHED=off turns it off; OVERLOAD_LAG_MS (default 200) and OVERLOAD_IN_FLIGHT (default 64).
import { subscribe } from "node:diagnostics_channel"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { hasAuthCookie } from "../utils/auth-cookie.ts"
import { BROWSER_COOKIE } from "../utils/browser-cookie.ts"
import { isHealthPath, onShutdown } from "./lifecycle.server.ts"
import { counter } from "./metrics/registry.server.ts"

export const TICK_MS = 100
// How much of the last delay is left after a tick.
const DECAY = 0.7
export const HOLD_MS = 3_000
export const RETRY_AFTER_SECONDS = 30

export type ShedLimits = { lagMs: number; inFlight: number }
export type ShedState = { lagMs: number; inFlight: number }
type Head = {
	method?: string
	url?: string
	headers: { cookie?: string; "user-agent"?: string }
}

const HAS_BROWSER_COOKIE = new RegExp(`(?:^|;\\s*)${BROWSER_COOKIE}=1(?:;|$)`)
// Paths that are never shed: APIs (the site's own scripts and the apps call them), MCP and OAuth, share cards (link
// previews), the files crawlers need to find their way, and every file: a path whose last part has an extension. The
// static files that the static handler passes on to Express (a file without a compressed copy, a fallback) get here
// too, and a script or style sheet from another origin may come without cookies.
const NEVER =
	/^\/(?:api\/|mcp(?:\/|$|\?)|\.well-known\/|og\/|build\/|assets\/|robots\.txt|sitemap|favicon|site\.webmanifest|health\/)/
const FILE = /\.[A-Za-z0-9]{1,8}$/
const LOADER_DATA = /[?&]_data=/
// Search engines, link preview fetchers, and the status monitor. A user agent can say anything; this list only decides
// who is served while the process is overloaded, and a crawler that pretends to be one of these is served as before.
const LET_THROUGH =
	/Googlebot|Google-InspectionTool|Storebot-Google|bingbot|Applebot|DuckDuckBot|YandexBot|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|WhatsApp|TelegramBot|redditbot|Pinterestbot|Embedly|Uptime-Kuma/i

/** Whether a request may be shed: an anonymous page request from a client that never ran the site's scripts. */
export function isSheddable({ method, url, headers }: Head): boolean {
	if (method !== "GET" && method !== "HEAD") return false
	if (!url || NEVER.test(url) || isHealthPath(url) || LOADER_DATA.test(url))
		return false
	const at = url.indexOf("?")
	if (FILE.test(at < 0 ? url : url.slice(0, at))) return false
	const cookie = headers.cookie
	if (cookie && (HAS_BROWSER_COOKIE.test(cookie) || hasAuthCookie(cookie)))
		return false
	return !LET_THROUGH.test(headers["user-agent"] ?? "")
}

/** Whether the process counts as overloaded now. */
export const isOverloaded = (state: ShedState, limits: ShedLimits) =>
	state.lagMs >= limits.lagMs || state.inFlight >= limits.inFlight

const BUSY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GoodWatch</title>
<script>(function(){var c="${BROWSER_COOKIE}=1",had=document.cookie.indexOf(c)>=0;document.cookie=c+"; Path=/; Max-Age=31536000; SameSite=Lax";setTimeout(function(){location.reload()},!had&&document.cookie.indexOf(c)>=0?1500:${RETRY_AFTER_SECONDS * 1000})})()</script>
</head><body style="background:#030712;color:#d1d5db;font-family:system-ui,sans-serif;text-align:center;padding-top:20vh"><p>Loading GoodWatch…</p></body></html>`
const BUSY_HEADERS = {
	"Content-Type": "text/html; charset=utf-8",
	"Content-Length": String(Buffer.byteLength(BUSY_HTML)),
	"Cache-Control": "private, no-store",
	"Retry-After": String(RETRY_AFTER_SECONDS),
	"X-Robots-Tag": "noindex",
	Vary: "Cookie",
	"GW-Overload": "shed",
}

const setting = (name: string, fallback: number) => {
	const value = Number(process.env[name])
	return process.env[name] && Number.isFinite(value) && value > 0
		? value
		: fallback
}

/**
 * The shedder of one process: how late the event loop runs, how many requests are in the app, and what it shed.
 * `now` and `limits` are for tests.
 */
export function createShedder(
	options: { now?: () => number; limits?: ShedLimits } = {},
) {
	const now = options.now ?? (() => performance.now())
	const limits = options.limits ?? {
		lagMs: setting("OVERLOAD_LAG_MS", 200),
		inFlight: setting("OVERLOAD_IN_FLIGHT", 64),
	}
	const state: ShedState = { lagMs: 0, inFlight: 0 }
	let overloadedUntil = Number.NEGATIVE_INFINITY
	let expected = now() + TICK_MS
	const report = { shed: 0, maxLagMs: 0, maxInFlight: 0 }

	/** One timer tick: how late it ran feeds the delay. */
	function tick() {
		const at = now()
		const late = Math.max(0, at - expected)
		state.lagMs = Math.max(late, state.lagMs * DECAY)
		report.maxLagMs = Math.max(report.maxLagMs, late)
		expected = at + TICK_MS
	}

	/** Whether this request is answered with the busy page. */
	function shouldShed(request: Head): boolean {
		const at = now()
		// A tick that is due but hasn't run yet: the loop is that late already.
		const pending = Math.max(0, at - expected)
		const current = {
			lagMs: Math.max(state.lagMs, pending),
			inFlight: state.inFlight,
		}
		if (isOverloaded(current, limits)) overloadedUntil = at + HOLD_MS
		return at < overloadedUntil && isSheddable(request)
	}

	return {
		state,
		limits,
		tick,
		shouldShed,
		entered() {
			state.inFlight++
			report.maxInFlight = Math.max(report.maxInFlight, state.inFlight)
		},
		left() {
			state.inFlight--
		},
		shed() {
			report.shed++
		},
		/** What happened since the last call, or null when nothing was shed. Resets the counts. */
		takeReport() {
			const taken = { ...report }
			report.shed = 0
			report.maxLagMs = 0
			report.maxInFlight = state.inFlight
			return taken.shed ? taken : null
		},
	}
}

export type Shedder = ReturnType<typeof createShedder>

const shedTotal = counter(
	"goodwatch_overload_shed_total",
	"Anonymous page requests answered with the busy page while the process was overloaded.",
	[],
	1,
)

const wrapped = new WeakSet<Server>()

/** Puts the shedder in front of the listeners that are there now. */
export function putShedderFirst(server: Server, shedder: Shedder): void {
	if (wrapped.has(server)) return
	wrapped.add(server)
	const listeners = server.listeners("request")
	server.removeAllListeners("request")
	server.on("request", (request: IncomingMessage, response: ServerResponse) => {
		// A request can reach this wrapper after its client left: the page cache hands some requests on after a wait.
		// Nobody is there to answer, and a "close" listener added now would never run.
		if (response.destroyed || response.writableEnded || response.closed) return
		if (shedder.shouldShed(request)) {
			shedder.shed()
			shedTotal.inc([])
			response.writeHead(503, BUSY_HEADERS)
			response.end(request.method === "HEAD" ? undefined : BUSY_HTML)
			return
		}
		if (!isHealthPath(request.url)) {
			shedder.entered()
			response.once("close", shedder.left)
		}
		for (const listener of listeners)
			Reflect.apply(listener, server, [request, response])
	})
}

let started = false

/**
 * Starts the shedder on the public server, once. Call it after `startLifecycle` (whose health answers stay inside it)
 * and before `startPageCache` (whose stored pages are answered outside it, so a cached page is never shed).
 */
export function startOverloadShedder(): void {
	if (started || process.env.OVERLOAD_SHED === "off") return
	started = true
	const shedder = createShedder()
	const timer = setInterval(shedder.tick, TICK_MS)
	timer.unref()
	const reporter = setInterval(() => {
		const report = shedder.takeReport()
		if (report)
			console.info(
				`Overload: ${report.shed} anonymous page requests answered busy in the last minute (event loop up to ${Math.round(report.maxLagMs)} ms late, up to ${report.maxInFlight} requests in the app)`,
			)
	}, 60_000)
	reporter.unref()
	onShutdown("overload shedder", () => {
		clearInterval(timer)
		clearInterval(reporter)
	})
	subscribe("http.server.request.start", (message) => {
		const { server, request } = message as {
			server: Server
			request: IncomingMessage
		}
		if (request.socket.localPort === (Number(process.env.PORT) || 3000))
			putShedderFirst(server, shedder)
	})
}
