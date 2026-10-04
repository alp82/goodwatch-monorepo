// Answers a card that was served a moment ago again, before Express.
//
// A card that the stores hold in memory still cost a request five times as much main-thread time as a page from the
// page cache: Express, the Remix request object, route matching over more than a hundred routes, and the response
// conversion, for a body that needs none of it. So the /og/ routes leave each complete answer here for ten seconds,
// under its request path, and a request for that path within that time is answered with one map lookup and one write.
//
// - An entry holds a reference to the image buffer that the card store or the share card cache already holds, not a
//   copy. The byte bound covers the case that those stores evict a buffer that is still referenced here.
// - After ten seconds the next request takes the route again. That is where a card's age is checked and a redraw
//   starts, and where a share list image learns that its list was changed, hidden, or deleted. A list's images
//   outlive a delete by at most ten seconds here, on top of the list view's lifetime (see docs/page-cache.md).
// - `resetListView` drops a list's images in the process that got the write.
//
// `remix-serve` owns the HTTP server, so this module finds it through Node's request event and wraps its listeners,
// as the static file handler and the page cache do. The order of the wrappers doesn't matter.
import { subscribe } from "node:diagnostics_channel"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { isShuttingDown } from "../lifecycle.server.ts"
import { gauge } from "../metrics/registry.server.ts"

export const HOT_CARD_MS = 10_000
export const HOT_CARDS_MAX_BYTES = 32 * 1024 * 1024

export type HotCard = {
	image: Buffer
	etag: string
	contentType: string
	cacheControl: string
	lastModified?: string
	onHit?: () => void
}

export function createHotCards({
	now = Date.now,
	maxBytes = HOT_CARDS_MAX_BYTES,
	hotMs = HOT_CARD_MS,
} = {}) {
	const cards = new Map<string, { card: HotCard; expires: number }>()
	let bytes = 0
	function drop(pathname: string) {
		const entry = cards.get(pathname)
		if (!entry) return
		bytes -= entry.card.image.length
		cards.delete(pathname)
	}
	function remember(pathname: string, card: HotCard) {
		const time = now()
		drop(pathname)
		cards.set(pathname, { card, expires: time + hotMs })
		bytes += card.image.length
		for (const [path, entry] of cards) {
			if (entry.expires > time) break
			drop(path)
		}
		for (const path of cards.keys()) {
			if (bytes <= maxBytes) break
			drop(path)
		}
	}
	function answer(request: IncomingMessage, response: ServerResponse) {
		if (request.method !== "GET" && request.method !== "HEAD") return false
		const pathname = request.url?.split("?", 1)[0] ?? ""
		if (!pathname.startsWith("/og/")) return false
		const entry = cards.get(pathname)
		if (!entry) return false
		if (entry.expires <= now()) {
			drop(pathname)
			return false
		}
		const { card } = entry
		const headers = {
			"Cache-Control": card.cacheControl,
			ETag: card.etag,
			"X-OG-Card": "hot",
		}
		const matches = request.headers["if-none-match"]
			?.split(",")
			.some(
				(tag) =>
					tag.trim() === "*" || tag.trim().replace(/^W\//, "") === card.etag,
			)
		card.onHit?.()
		if (matches) {
			response.writeHead(304, headers)
			response.end()
		} else {
			response.writeHead(200, {
				...headers,
				"Content-Type": card.contentType,
				"Content-Length": card.image.length,
				...(card.lastModified ? { "Last-Modified": card.lastModified } : {}),
			})
			response.end(request.method === "HEAD" ? undefined : card.image)
		}
		return true
	}
	function forget(match: (pathname: string) => boolean) {
		for (const pathname of cards.keys()) if (match(pathname)) drop(pathname)
	}
	return {
		remember,
		answer,
		forget,
		stats: () => ({ entries: cards.size, bytes }),
	}
}

const key = Symbol.for("goodwatch.og-hot-cards")
const initial = {
	cards: createHotCards(),
	started: false,
	wrapped: new WeakSet<Server>(),
}
const shared = globalThis as typeof globalThis & { [key]?: typeof initial }
shared[key] ??= initial
const state = shared[key]
export const hotCards = state.cards

export function startHotCards() {
	if (process.env.NODE_ENV !== "production" || state.started) return
	state.started = true
	for (const name of ["entries", "bytes"] as const)
		gauge(`goodwatch_og_hot_cards_${name}`, `Hot OG cards ${name}.`, [], () => [
			{ labels: [], value: hotCards.stats()[name] },
		])
	subscribe("http.server.request.start", (message) => {
		const { server, request } = message as {
			server: Server
			request: IncomingMessage
		}
		if (
			request.socket.localPort !== (Number(process.env.PORT) || 3000) ||
			state.wrapped.has(server)
		)
			return
		state.wrapped.add(server)
		const listeners = server.listeners("request")
		server.removeAllListeners("request")
		server.on("request", (request, response) => {
			try {
				if (!isShuttingDown() && hotCards.answer(request, response)) return
			} catch {
				// The app answers when no headers have been sent.
				if (response.headersSent) return void response.destroy()
			}
			for (const listener of listeners)
				Reflect.apply(listener, server, [request, response])
		})
	})
}
