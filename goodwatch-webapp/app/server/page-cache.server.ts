// Keeps complete anonymous HTML pages in this Node process and answers repeated requests for them before Express and
// Remix: no loader, no React, no compression. A viral spike asks for one or a few URLs over and over, and a render
// costs 14 to 60 ms of the one main thread. The rules, the numbers, and what a cache in front must still do:
// docs/page-cache.md. The decision: docs/adr/0007-in-process-page-cache.md.
//
// - Who may use it: only what `cacheIdentity` calls cacheable, so a request with the auth cookie never reads, writes,
//   counts, leads, or waits. The browser gate's decision is taken again here with the gate's own function, whatever
//   order the wrappers run in: a request that the gate answers is passed on untouched.
// - Key: build commit, Host, path and query without tracking parameters, the cache identity (`anon;US;en`), and
//   whether a front cache named that identity (the two differ in `Cache-Control` and `Vary`), and the asset address.
// - What is stored: a 200 document that `applyCachePolicy` called `keyed` or `shared`, without `Set-Cookie` and without
//   a render error, on its second request within a minute. The page's own `Cache-Control` decides: a private route
//   (search, an unlisted share list) and an incomplete page (`no-store`, see incomplete-page.ts) are never stored.
//   The server entry hands over the HTML (`pageCacheWants`), and this module compresses it once per encoding off the
//   request path.
// - Tracking parameters (`utm_*`, `fbclid`, ...) aren't part of the key, and the app never sees them on a request
//   whose page may be stored, so that no visitor's click id ends up in a page for everyone. A redirect gets them back.
// - One render per key: while the first render of a repeated URL runs, later requests wait for it (at most 3 seconds)
//   instead of rendering. A URL that turned out not to be storable isn't waited for again (a pass period that
//   doubles from 5 seconds to 5 minutes). Released waiters share one retry render within their original deadline.
// - At most four renders of one key are in flight, whatever the reason: a lead render that is slow or failed, a pass
//   period, a shutdown. A request beyond that gets a busy answer: 503 with `no-store` and `Retry-After`, and a page
//   that reloads by itself.
// - Lifetime: from the response's own policy (`s-maxage`, `stale-while-revalidate`). A stale page is served while one
//   background render refreshes it. Lifetime and Age count from the render's start, including compression.
//   A failed refresh keeps the page only until that deadline and pauses for 30 seconds.
// - Bounds: bytes and entries, least recently used first. The admission counters are bounded too.
// - Reset: `resetPageCache` reaches only this process. The data cache's reset markers (ADR 0006) don't reach a stored
//   page, so a page with a reset path has a short lifetime: a share list page lives 10 + 10 seconds, which is what
//   bounds an old page in the other process.
// - Shutdown: while the process still serves, stored pages are answered as before. Nothing is stored, refreshed,
//   counted, or waited for.
// - Off switch: PAGE_CACHE=off.
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { subscribe } from "node:diagnostics_channel"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { promisify } from "node:util"
import { constants, brotliCompress, gunzip, gzip } from "node:zlib"
import { currentAssetBase } from "./asset-address.server.ts"
import { gateAnswer } from "./browser-gate.server.ts"
import {
	type CacheDecision,
	cacheIdentityOf,
	hasAuthCookie,
	pageLifetime,
} from "./cache-identity.server.ts"
import { isHealthPath, isShuttingDown, onShutdown } from "./lifecycle.server.ts"
import { counter, gauge } from "./metrics/registry.server.ts"
import { accepted } from "./static-files.server.ts"

export const TRACKING_PARAMETERS = [
	"utm_*",
	"gad_source",
	"mc_cid",
	"mc_eid",
	"gclid",
	"gclsrc",
	"dclid",
	"gbraid",
	"wbraid",
	"fbclid",
	"msclkid",
	"twclid",
	"li_fat_id",
	"igshid",
	"ttclid",
	"_ga",
	"_gl",
] as const
const tracking = new Set<string>(TRACKING_PARAMETERS)

const isTracking = (part: string) => {
	let name = part.split("=", 1)[0]
	try {
		name = decodeURIComponent(name.replace(/\+/g, " "))
	} catch {
		/* Keep malformed names. */
	}
	return name.startsWith("utm_") || tracking.has(name)
}

/**
 * A request target without its tracking parameters, and the parameters that were dropped. Works on the raw string:
 * every other parameter keeps its bytes and its place, and a `?` with nothing behind it goes too.
 */
export function stripTracking(raw: string): { url: string; dropped: string } {
	const at = raw.indexOf("?")
	if (at < 0) return { url: raw, dropped: "" }
	const kept: string[] = []
	const dropped: string[] = []
	for (const part of raw.slice(at + 1).split("&"))
		(isTracking(part) ? dropped : kept).push(part)
	if (!dropped.length && kept.some(Boolean)) return { url: raw, dropped: "" }
	const query = kept.filter(Boolean).join("&")
	return {
		url: raw.slice(0, at) + (query ? `?${query}` : ""),
		dropped: dropped.join("&"),
	}
}

// A request target (`/path?query`) is appended to an origin, as the Remix adapter does, and not resolved against it:
// `//host/path` must stay a path. The server entry passes the complete URL of its Fetch request. Anything else throws.
const parseTarget = (raw: string) =>
	raw.startsWith("/") ? new URL(`http://x${raw}`) : new URL(raw)

/** The path and query that a page is stored under: no tracking parameters, parsed the way Remix parses it. */
export function normalizePageUrl(raw: string): string {
	const url = parseTarget(stripTracking(raw).url)
	return url.pathname + url.search
}

/** Puts the tracking parameters back on a redirect to this site, so that the browser's analytics still see them. */
export function restoreTracking(location: string, dropped: string): string {
	if (!dropped || !location.startsWith("/") || location.startsWith("//"))
		return location
	const hash = location.indexOf("#")
	const base = hash < 0 ? location : location.slice(0, hash)
	return `${base}${base.includes("?") ? "&" : "?"}${dropped}${hash < 0 ? "" : location.slice(hash)}`
}

type KeyInput = {
	method?: string
	url: string
	host?: string | null
	cookie?: string | null
	acceptLanguage?: string | null
	identityHeader?: string | null
	userAgent?: string
	build?: string
	assets?: string
}
type PageKey = { key: string; path: string }
export function pageCacheKey(
	input: KeyInput,
): PageKey | { bypass: string; path: string } | null {
	const { method = "GET", url } = input
	if (method !== "GET" && method !== "HEAD") return null
	const parsed = parseTarget(url)
	const path = parsed.pathname
	if (
		isHealthPath(path) ||
		/^\/(api|og|assets|health)\//.test(path) ||
		/(?:^|&)_data=/.test(parsed.search.slice(1)) ||
		path.split("/").at(-1)?.includes(".")
	)
		return null
	if (
		(url.startsWith("/") ? url : parsed.pathname + parsed.search).length > 2048
	)
		return { bypass: "long_url", path }
	// The gate's own decision, for the target as it arrived and as Remix will parse it.
	const gateHeaders = {
		cookie: input.cookie ?? undefined,
		"user-agent": input.userAgent,
	}
	if (
		(url.startsWith("/") && gateAnswer(method, url, gateHeaders)) ||
		gateAnswer(method, parsed.pathname + parsed.search, gateHeaders)
	)
		return { bypass: "gate", path }
	const identity = cacheIdentityOf({ ...input, method })
	if (!identity.cacheable) return { bypass: "member", path }
	return {
		key: `${input.build ?? (process.env.SOURCE_COMMIT || "unknown")}|${(input.host ?? "").toLowerCase()}|${normalizePageUrl(url)}|${identity.key}|${identity.keyFromCache ? "h" : "a"}|${input.assets ?? currentAssetBase()}`,
		path,
	}
}

export const PAGE_CACHE_LIMITS = {
	MAX_BYTES: 128 * 1024 * 1024,
	MAX_ENTRIES: 2000,
	MAX_ENTRY_BYTES: 4 * 1024 * 1024,
	MAX_HTML_BYTES: 8 * 1024 * 1024,
	ADMIT_AFTER: 2,
	ADMIT_WINDOW_MS: 60_000,
	ADMIT_MAX_KEYS: 20_000,
	// Renders of one key in flight, the lead included. More than one, so that a render that hangs doesn't make the URL
	// unanswerable. Few, because the process renders about 20 title pages per second: four renders take about 160 ms of
	// the main thread, which leaves it to other URLs.
	MAX_RENDERS_PER_KEY: 4,
	// What the busy answer says in `Retry-After`. A waiter has waited 3 seconds by then, and the server render gives up
	// after 5 seconds, so 2 seconds later the lead render has stored its page or has ended.
	BUSY_RETRY_SECONDS: 2,
	MAX_FLIGHTS: 1000,
	MAX_WAITERS: 2000,
	JOIN_MAX_AGE_MS: 3000,
	JOIN_WAIT_MS: 3000,
	MAX_REFRESHES: 2,
	REFRESH_PAUSE_MS: 30_000,
	MAX_REFRESH_PAUSES: 1000,
	REFRESH_TIMEOUT_MS: 15_000,
	// Caps the fresh time that the response's own policy gives (PAGE_CACHE_MAX_FRESH_SECONDS). No cap by default.
	MAX_FRESH_MS: Number.POSITIVE_INFINITY,
}
type HeadersObject = Record<string, string | number>
type Variant = { body: Buffer; etag: string; headers: HeadersObject }
export type PageEntry = PageKey & {
	route: string
	storedAt: number
	freshUntil: number
	staleUntil: number
	br: Variant
	gzip: Variant
	identityLength: number
	identityEtag: string
	headers: HeadersObject
	bytes: number
}
type Admission = {
	count: number
	windowStart: number
	passUntil: number
	passStreak: number
}
type Waiter = {
	flight?: Flight
	finish: (entry?: PageEntry, reason?: string) => void
}
type Flight = PageKey & {
	route: string
	startedAt: number
	joinable: boolean
	retry: boolean
	waiters: Set<Waiter>
	offered: boolean
	kind: "request" | "refresh"
	cancelled: boolean
	timer?: ReturnType<typeof setTimeout>
}
export type PageCacheOptions = {
	assets?: () => string
	now?: () => number
	compress?: (html: Buffer) => Promise<{ br: Buffer; gzip: Buffer }>
	render?: (request: Request) => Promise<{ status: number }>
	routeLabel?: (path: string, status: number) => string
	limits?: Partial<typeof PAGE_CACHE_LIMITS>
	enabled?: () => boolean
	draining?: () => boolean
}
const brotli = promisify(brotliCompress)
const zip = promisify(gzip)
const unzip = promisify(gunzip)
async function compressHtml(html: Buffer) {
	const [br, gzip] = await Promise.all([
		brotli(html, {
			params: {
				[constants.BROTLI_PARAM_QUALITY]: 5,
				[constants.BROTLI_PARAM_SIZE_HINT]: html.length,
			},
		}),
		zip(html, { level: 6 }),
	])
	return { br, gzip }
}
const metric = (name: string, labels: string[]) =>
	counter(`goodwatch_page_cache_${name}_total`, `Page cache ${name}.`, labels)
// `audience` is read from the cookie again when the request is counted, apart from the decision above: a `member`
// row with `hit`, `stale`, or `joined` would mean that a member got a stored page. It must never appear.
const requests = metric("requests", ["route", "result", "audience"])
const audienceOf = (request: IncomingMessage) =>
	hasAuthCookie(request.headers.cookie) ? "member" : "anon"
const bypasses = metric("bypass", ["route", "reason"])
const misses = metric("misses", ["route", "reason"])
const busyAnswers = metric("busy", ["route", "reason"])
const stores = metric("stores", ["route"])
const notStored = metric("not_stored", ["route", "reason"])
const evictions = metric("evictions", ["reason"])
const refreshes = metric("refreshes", ["route", "result"])
const notModified = metric("not_modified", ["route"])
const omitHeaders =
	/^(content-length|content-encoding|transfer-encoding|connection|keep-alive|date|set-cookie|etag|vary|age|gw-page-cache)$/i
const hopHeaders =
	/^(connection|keep-alive|transfer-encoding|upgrade|te|trailer|proxy-.*|if-none-match|if-modified-since|range|content-length)$/i
function fromRequest(request: Request): KeyInput {
	return {
		method: request.method,
		url: request.url,
		host: request.headers.get("host"),
		cookie: request.headers.get("cookie"),
		acceptLanguage: request.headers.get("accept-language"),
		identityHeader: request.headers.get("gw-cache-identity"),
		userAgent: request.headers.get("user-agent") ?? undefined,
	}
}

export function createPageCache(options: PageCacheOptions = {}) {
	const limits = { ...PAGE_CACHE_LIMITS, ...options.limits }
	const now = options.now ?? Date.now
	const entries = new Map<string, PageEntry>()
	const admission = new Map<string, Admission>()
	const flights = new Map<string, Flight>()
	const renders = new Map<string, number>()
	const pauses = new Map<string, number>()
	const context = new AsyncLocalStorage<Flight>()
	const busyBody = Buffer.from(
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="${limits.BUSY_RETRY_SECONDS}"><meta name="robots" content="noindex"><title>GoodWatch is busy</title></head><body><p>This page is busy right now. It reloads by itself in a moment.</p></body></html>`,
	)
	let bytes = 0
	let waiters = 0
	let stopped = false
	let activeRefreshes = 0
	let refreshFlights = 0
	const enabled = () => !stopped && (options.enabled?.() ?? true)
	const draining = () => stopped || (options.draining?.() ?? false)
	const routeLabel = (path: string) => options.routeLabel?.(path, 200) ?? "page"
	const alive = (flight: Flight) =>
		!flight.cancelled && flights.get(flight.key) === flight
	const admitted = (key: string) => {
		const row = admission.get(key)
		return (
			!!row &&
			now() - row.windowStart < limits.ADMIT_WINDOW_MS &&
			row.count >= limits.ADMIT_AFTER
		)
	}
	function count(key: string): Admission {
		let row = admission.get(key)
		if (!row) {
			if (admission.size >= limits.ADMIT_MAX_KEYS) {
				for (const [key, row] of admission)
					if (
						now() - row.windowStart >= limits.ADMIT_WINDOW_MS &&
						now() >= row.passUntil
					)
						admission.delete(key)
				if (admission.size >= limits.ADMIT_MAX_KEYS)
					admission.delete(admission.keys().next().value as string)
			}
			row = { count: 0, windowStart: now(), passUntil: 0, passStreak: 0 }
			admission.set(key, row)
		}
		if (now() - row.windowStart >= limits.ADMIT_WINDOW_MS) {
			row.windowStart = now()
			row.count = 0
		}
		row.count++
		return row
	}
	function remove(key: string, reason: string) {
		const entry = entries.get(key)
		if (!entry) return
		bytes -= entry.bytes
		entries.delete(key)
		evictions.inc([reason])
	}
	function end(flight: Flight, entry?: PageEntry) {
		if (!alive(flight)) return
		flights.delete(flight.key)
		if (flight.kind === "refresh") refreshFlights--
		flight.cancelled = true
		clearTimeout(flight.timer)
		for (const waiter of [...flight.waiters])
			if (waiter.flight === flight) waiter.finish(entry)
	}
	function pause(key: string) {
		pauses.delete(key)
		if (pauses.size >= limits.MAX_REFRESH_PAUSES) {
			for (const [key, until] of pauses) if (until <= now()) pauses.delete(key)
			if (pauses.size >= limits.MAX_REFRESH_PAUSES)
				pauses.delete(pauses.keys().next().value as string)
		}
		pauses.set(key, now() + limits.REFRESH_PAUSE_MS)
	}
	function failedRefresh(flight: Flight, result: string) {
		if (!alive(flight)) return
		if (result === "gone") remove(flight.key, "gone")
		else pause(flight.key)
		refreshes.inc([flight.route, result])
		end(flight)
	}
	function newFlight(
		page: PageKey,
		kind: Flight["kind"],
		joinable: boolean,
	): Flight {
		const flight: Flight = {
			...page,
			route: routeLabel(page.path),
			startedAt: now(),
			joinable,
			retry: false,
			kind,
			waiters: new Set(),
			offered: false,
			cancelled: false,
		}
		flights.set(page.key, flight)
		if (kind === "refresh") refreshFlights++
		return flight
	}
	function refresh(entry: PageEntry, request: IncomingMessage) {
		if (
			!options.render ||
			flights.has(entry.key) ||
			(renders.get(entry.key) ?? 0) >= limits.MAX_RENDERS_PER_KEY ||
			flights.size >= limits.MAX_FLIGHTS ||
			activeRefreshes >= limits.MAX_REFRESHES ||
			refreshFlights >= limits.MAX_REFRESHES ||
			draining()
		)
			return
		const until = pauses.get(entry.key)
		if (until !== undefined && until > now()) return
		pauses.delete(entry.key)
		const flight = newFlight(entry, "refresh", false)
		activeRefreshes++
		flight.timer = setTimeout(
			() => failedRefresh(flight, "error"),
			limits.REFRESH_TIMEOUT_MS,
		)
		flight.timer.unref()
		void context.run(flight, async () => {
			try {
				const headers = new Headers()
				const connection = new Set(
					(request.headers.connection ?? "")
						.toLowerCase()
						.split(",")
						.map((s) => s.trim()),
				)
				for (const [name, value] of Object.entries(request.headers)) {
					if (
						value !== undefined &&
						!hopHeaders.test(name) &&
						!connection.has(name)
					)
						headers.set(name, Array.isArray(value) ? value.join(", ") : value)
				}
				const result = await options.render?.(
					new Request(
						`http://${request.headers.host ?? "x"}${stripTracking(request.url ?? "/").url}`,
						{ method: "GET", headers },
					),
				)
				if (!flight.offered)
					failedRefresh(
						flight,
						!result || result.status >= 500
							? "error"
							: result.status === 200
								? "not_storable"
								: "gone",
					)
			} catch {
				failedRefresh(flight, "error")
			} finally {
				activeRefreshes--
			}
		})
	}
	function serve(
		entry: PageEntry,
		request: IncomingMessage,
		response: ServerResponse,
		result: string,
		fallback: () => void,
	) {
		const encoding = accepted(request.headers["accept-encoding"] ?? "")
		const variant = encoding.br
			? entry.br
			: encoding.gzip
				? entry.gzip
				: undefined
		const etag = variant?.etag ?? entry.identityEtag
		const tags = [entry.br.etag, entry.gzip.etag, entry.identityEtag]
		const matched = request.headers["if-none-match"]
			?.split(",")
			.some(
				(tag) =>
					tag.trim() === "*" || tags.includes(tag.trim().replace(/^W\//, "")),
			)
		const send = (body?: Buffer) => {
			if (response.destroyed || response.writableEnded) return
			if (entries.get(entry.key) === entry) {
				entries.delete(entry.key)
				entries.set(entry.key, entry)
			}
			requests.inc([entry.route, result, audienceOf(request)])
			const headers: HeadersObject = matched
				? {}
				: {
						...(variant?.headers ?? entry.headers),
						"Content-Length": variant?.body.length ?? entry.identityLength,
						Age: Math.max(0, Math.floor((now() - entry.storedAt) / 1000)),
					}
			if (matched) {
				for (const name of ["cache-control", "vary", "gw-cache-identity"])
					if (entry.headers[name] !== undefined)
						headers[name] = entry.headers[name]
				notModified.inc([entry.route])
			}
			headers.ETag = etag
			headers["GW-Page-Cache"] = result === "joined" ? "miss" : result
			response.writeHead(matched ? 304 : 200, headers)
			response.end(matched || request.method === "HEAD" ? undefined : body)
		}
		if (matched || request.method === "HEAD" || variant) send(variant?.body)
		else void unzip(entry.gzip.body).then(send, fallback)
	}
	function handle(
		request: IncomingMessage,
		response: ServerResponse,
		next: () => void,
	) {
		if (!enabled() && !stopped) return next()
		let page: ReturnType<typeof pageCacheKey> = null
		try {
			page = pageCacheKey({
				assets: options.assets?.(),
				method: request.method,
				url: request.url ?? "/",
				host: request.headers.host,
				cookie: request.headers.cookie,
				acceptLanguage: request.headers["accept-language"],
				identityHeader: String(request.headers["gw-cache-identity"] ?? ""),
				userAgent: request.headers["user-agent"],
			})
		} catch {
			// A target that doesn't parse. The app answers it.
		}
		if (!page) return next()
		if ("bypass" in page) {
			const route = routeLabel(page.path)
			response.setHeader("GW-Page-Cache", "bypass")
			requests.inc([route, "bypass", audienceOf(request)])
			bypasses.inc([route, page.bypass])
			return next()
		}
		const full = () =>
			(renders.get(page.key) ?? 0) >= limits.MAX_RENDERS_PER_KEY
		// The answer for a request that would be one render too many for its key. No cache may keep it.
		const busy = (reason: string) => {
			if (response.destroyed || response.writableEnded) return
			const route = routeLabel(page.path)
			requests.inc([route, "busy", audienceOf(request)])
			busyAnswers.inc([route, reason])
			response.writeHead(503, {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "private, no-store",
				"Retry-After": limits.BUSY_RETRY_SECONDS,
				"X-Robots-Tag": "noindex",
				"GW-Page-Cache": "busy",
				"Content-Length": busyBody.length,
			})
			response.end(request.method === "HEAD" ? undefined : busyBody)
		}
		const pass = (reason: string, flight?: Flight) => {
			if (response.destroyed || response.writableEnded) return
			if (full()) return busy(reason)
			renders.set(page.key, (renders.get(page.key) ?? 0) + 1)
			// Before the other close listeners: a lead render gives its slot back before it releases its waiters.
			response.prependOnceListener("close", () => {
				const remaining = (renders.get(page.key) ?? 1) - 1
				if (remaining) renders.set(page.key, remaining)
				else renders.delete(page.key)
			})
			const route = routeLabel(page.path)
			response.setHeader("GW-Page-Cache", "miss")
			requests.inc([route, "miss", audienceOf(request)])
			misses.inc([route, reason])
			// The app never sees the tracking parameters of a request whose page may be stored: what it renders can
			// go to every visitor. A redirect gets them back, so that the browser's analytics still see them.
			const { url, dropped } = stripTracking(request.url ?? "/")
			if (dropped) {
				request.url = url
				const writeHead = response.writeHead
				response.writeHead = function (
					this: ServerResponse,
					...args: Parameters<ServerResponse["writeHead"]>
				) {
					const status = typeof args[0] === "number" ? args[0] : this.statusCode
					const location = this.getHeader("location")
					if (status >= 300 && status < 400 && typeof location === "string")
						this.setHeader("Location", restoreTracking(location, dropped))
					return Reflect.apply(writeHead, this, args)
				} as ServerResponse["writeHead"]
			}
			if (flight) context.run(flight, next)
			else next()
		}
		const entry = entries.get(page.key)
		if (entry) {
			if (now() < entry.staleUntil) {
				const stale = now() >= entry.freshUntil
				serve(entry, request, response, stale ? "stale" : "hit", () =>
					pass("released"),
				)
				if (stale) refresh(entry, request)
				return
			}
			remove(page.key, "expired")
		}
		if (draining()) return pass("shutdown")
		if (request.method === "HEAD") return pass("head")
		const row = count(page.key)
		const lead = (reason: string, previous?: Flight) => {
			const retry = !!previous
			const flight = newFlight(page, "request", retry || row.passStreak === 0)
			flight.retry = retry
			// Move the remaining waiters before the app can finish or refuse the retry.
			for (const waiter of previous?.waiters ?? []) {
				waiter.flight = flight
				flight.waiters.add(waiter)
			}
			previous?.waiters.clear()
			response.once("close", () => {
				if (!alive(flight) || flight.offered) return
				const route = flight.route
				const finished = response.writableFinished
				const status = response.statusCode
				notStored.inc([
					route,
					!finished ? "aborted" : status !== 200 ? "status" : "unstorable",
				])
				if (
					finished &&
					((status === 200 && admitted(page.key)) ||
						(status !== 200 && status < 500))
				) {
					row.passStreak++
					row.passUntil =
						now() + Math.min(5000 * 2 ** (row.passStreak - 1), 300_000)
				}
				end(flight)
			})
			return pass(reason, flight)
		}
		if (now() < row.passUntil) return pass("pass")
		const existing = flights.get(page.key)
		if (
			existing?.joinable &&
			now() - existing.startedAt < limits.JOIN_MAX_AGE_MS &&
			admitted(page.key) &&
			waiters < limits.MAX_WAITERS
		) {
			const waiter: Waiter = {
				flight: existing,
				finish(entry, reason = "released") {
					const previous = waiter.flight
					if (!previous) return
					previous.waiters.delete(waiter)
					waiter.flight = undefined
					const retry =
						!entry &&
						reason === "released" &&
						!previous.retry &&
						!draining() &&
						!response.destroyed &&
						!response.writableEnded
					clearTimeout(timer)
					response.removeListener("close", closed)
					waiters--
					if (entry)
						serve(entry, request, response, "joined", () => pass("released"))
					else if (
						retry &&
						!flights.has(page.key) &&
						!full() &&
						flights.size < limits.MAX_FLIGHTS
					)
						lead("retry", previous)
					else if (reason !== "closed") pass(reason)
				},
			}
			const closed = () => waiter.finish(undefined, "closed")
			const timer = setTimeout(
				() => waiter.finish(undefined, "wait_timeout"),
				limits.JOIN_WAIT_MS,
			)
			timer.unref()
			response.once("close", closed)
			existing.waiters.add(waiter)
			waiters++
			return
		}
		if (!existing && flights.size < limits.MAX_FLIGHTS) {
			const reason = !admitted(page.key)
				? "not_admitted"
				: row.passStreak === 0
					? "lead"
					: "probe"
			if (full()) return busy(reason)
			return lead(reason)
		}
		pass("busy")
	}
	function wants(
		request: Request,
		status: number,
		headers: Headers,
		decision: CacheDecision,
		routePolicy?: string | null,
	) {
		if (
			!enabled() ||
			draining() ||
			request.method !== "GET" ||
			status !== 200 ||
			(decision !== "keyed" && decision !== "shared") ||
			headers.has("set-cookie")
		)
			return null
		let page: ReturnType<typeof pageCacheKey> = null
		try {
			page = pageCacheKey({
				...fromRequest(request),
				assets: options.assets?.(),
			})
		} catch {
			// Not a URL this cache can key.
		}
		if (!page || !("key" in page)) return null
		const flight = flights.get(page.key)
		if (
			!flight ||
			flight.offered ||
			(context.getStore() && context.getStore() !== flight)
		)
			return null
		const snapshot = new Headers(headers)
		return (html: Buffer) => {
			if (!alive(flight) || flight.offered || draining()) return
			const refuse = (reason: string) => {
				if (!alive(flight)) return
				notStored.inc([flight.route, reason])
				if (flight.kind === "refresh")
					failedRefresh(
						flight,
						reason === "compress_error" ? "error" : "not_storable",
					)
				else end(flight)
			}
			if (flight.kind !== "refresh" && !admitted(page.key))
				return refuse("not_admitted")
			if (html.length > limits.MAX_HTML_BYTES) return refuse("too_large")
			flight.offered = true
			const identityLength = html.length
			const tag = createHash("sha1")
				.update(html)
				.digest("base64url")
				.slice(0, 20)
			void Promise.resolve()
				.then(() => (options.compress ?? compressHtml)(html))
				.then(
					(compressed) => {
						if (!alive(flight) || draining()) return
						const size = compressed.br.length + compressed.gzip.length + 1024
						if (size > limits.MAX_ENTRY_BYTES) return refuse("too_large")
						const storedAt = flight.startedAt
						const lifetime = pageLifetime(
							/(?:^|,)\s*s-maxage=/i.test(routePolicy ?? "")
								? routePolicy
								: snapshot.get("cache-control"),
						)
						const freshUntil =
							storedAt + Math.min(lifetime.fresh * 1000, limits.MAX_FRESH_MS)
						const staleUntil = freshUntil + lifetime.stale * 1000
						if (now() >= staleUntil) return refuse("expired")
						const storedHeaders: HeadersObject = {}
						for (const [name, value] of snapshot)
							if (!omitHeaders.test(name)) storedHeaders[name] = value
						storedHeaders.vary = [snapshot.get("vary"), "Accept-Encoding"]
							.filter(Boolean)
							.join(", ")
						const variant = (
							body: Buffer,
							encoding: string,
							suffix: string,
						): Variant => ({
							body,
							etag: `"${tag}${suffix}"`,
							headers: {
								...storedHeaders,
								"Content-Encoding": encoding,
								"Content-Length": body.length,
							},
						})
						const entry: PageEntry = {
							...page,
							route: routeLabel(page.path),
							storedAt,
							freshUntil,
							staleUntil,
							br: variant(compressed.br, "br", "-br"),
							gzip: variant(compressed.gzip, "gzip", "-gz"),
							identityLength,
							identityEtag: `"${tag}"`,
							headers: storedHeaders,
							bytes: size,
						}
						bytes -= entries.get(page.key)?.bytes ?? 0
						entries.delete(page.key)
						entries.set(page.key, entry)
						bytes += size
						while (
							entries.size > limits.MAX_ENTRIES ||
							bytes > limits.MAX_BYTES
						)
							remove(entries.keys().next().value as string, "lru")
						const row = admission.get(page.key)
						if (row) {
							row.passStreak = 0
							row.passUntil = 0
						}
						pauses.delete(page.key)
						stores.inc([entry.route])
						if (flight.kind === "refresh") refreshes.inc([entry.route, "ok"])
						end(flight, entry)
					},
					() => refuse("compress_error"),
				)
		}
	}
	function reset(match: (path: string) => boolean = () => true) {
		let deleted = 0
		for (const [key, entry] of entries)
			if (match(entry.path)) {
				remove(key, "reset")
				pauses.delete(key)
				deleted++
			}
		for (const flight of [...flights.values()])
			if (match(flight.path)) {
				notStored.inc([flight.route, "reset"])
				end(flight)
			}
		return deleted
	}
	function sweep() {
		for (const [key, entry] of entries)
			if (now() >= entry.staleUntil) remove(key, "expired")
		for (const [key, row] of admission)
			if (
				now() - row.windowStart >= limits.ADMIT_WINDOW_MS &&
				now() >= row.passUntil
			)
				admission.delete(key)
		for (const [key, until] of pauses) if (until <= now()) pauses.delete(key)
	}
	return {
		handle,
		wants,
		reset,
		sweep,
		configure(next: Pick<PageCacheOptions, "render" | "routeLabel">) {
			Object.assign(options, next)
		},
		stop() {
			stopped = true
			reset()
			admission.clear()
			pauses.clear()
		},
		stats: () => ({
			entries: entries.size,
			bytes,
			flights: flights.size,
			waiters,
			admission_keys: admission.size,
		}),
		entries,
		admission,
		flights,
		pauses,
		limits,
	}
}

export type PageCache = ReturnType<typeof createPageCache>
export function pageCacheEnabled() {
	return (
		process.env.NODE_ENV === "production" &&
		!/^(off|0|false)$/i.test(process.env.PAGE_CACHE ?? "")
	)
}
function envLimit(name: string, fallback: number) {
	const value = Number(process.env[name] ?? fallback)
	return Number.isSafeInteger(value) && value >= 0 ? value : fallback
}
export const pageCache = createPageCache({
	enabled: pageCacheEnabled,
	draining: isShuttingDown,
	limits: {
		MAX_BYTES: envLimit("PAGE_CACHE_MAX_BYTES", PAGE_CACHE_LIMITS.MAX_BYTES),
		MAX_ENTRIES: envLimit(
			"PAGE_CACHE_MAX_ENTRIES",
			PAGE_CACHE_LIMITS.MAX_ENTRIES,
		),
		MAX_FRESH_MS: process.env.PAGE_CACHE_MAX_FRESH_SECONDS
			? envLimit("PAGE_CACHE_MAX_FRESH_SECONDS", 1800) * 1000
			: PAGE_CACHE_LIMITS.MAX_FRESH_MS,
	},
})
export const configurePageCache = pageCache.configure
export const pageCacheWants = pageCache.wants
export const resetPageCache = pageCache.reset
const wrapped = new WeakSet<Server>()
export function putPageCacheFirst(
	server: Server,
	cache: PageCache = pageCache,
) {
	if (wrapped.has(server)) return
	wrapped.add(server)
	const listeners = server.listeners("request")
	server.removeAllListeners("request")
	server.on("request", (request, response) =>
		cache.handle(request, response, () => {
			for (const listener of listeners)
				Reflect.apply(listener, server, [request, response])
		}),
	)
}
let started = false
let handler: ((request: Request) => Promise<Response>) | undefined
async function render(request: Request) {
	if (!handler) {
		const build = await import("virtual:remix/server-build")
		const { createRequestHandler } = await import("@remix-run/node")
		// The local virtual-module declaration lists only the fields used by metrics and static files.
		handler = createRequestHandler(
			build as unknown as Parameters<typeof createRequestHandler>[0],
			"production",
		)
	}
	const response = await handler(request)
	await response.arrayBuffer()
	return { status: response.status }
}
export function startPageCache() {
	if (started || !pageCacheEnabled()) return
	started = true
	configurePageCache({ render })
	console.info(
		`Page cache: ${pageCache.limits.MAX_ENTRIES} entries, ${pageCache.limits.MAX_BYTES} bytes, ${PAGE_CACHE_LIMITS.MAX_ENTRY_BYTES} bytes per entry`,
	)
	for (const name of [
		"entries",
		"bytes",
		"flights",
		"waiters",
		"admission_keys",
	] as const)
		gauge(`goodwatch_page_cache_${name}`, `Page cache ${name}.`, [], () => [
			{ labels: [], value: pageCache.stats()[name] },
		])
	const timer = setInterval(pageCache.sweep, 60_000)
	timer.unref()
	onShutdown("page cache", () => {
		clearInterval(timer)
		pageCache.stop()
	})
	subscribe("http.server.request.start", (message) => {
		const { server, request } = message as {
			server: Server
			request: IncomingMessage
		}
		if (request.socket.localPort === (Number(process.env.PORT) || 3000))
			putPageCacheFirst(server)
	})
}
