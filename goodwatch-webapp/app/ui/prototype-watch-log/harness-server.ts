// DEVELOPMENT HARNESS for /prototype/watch-log-real. A stand-in for the server, in the browser: it answers the
// requests the real title actions and the real watch log send, from memory, by the movie rule of
// docs/implementation/tracking/data-model.md. Nothing here reaches a database, and a production build leaves it out.
import { afterWatchLog } from "~/domain/member-data-updates-watch-log"
import {
	type WatchLogEntry,
	orderWatches,
	scoreWatchId,
	withDate,
	withRestored,
	withWatch,
	withoutWatch,
} from "~/domain/watch-log"
import type { UserData } from "~/types/user-data"
import { parseTitleKey } from "~/utils/title-key"

export const HARNESS_MEMBER = "harness-member"

export interface Sample {
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	poster: string
	starts: string
}

export const SAMPLES: Sample[] = [
	{ mediaType: "movie", tmdbId: 693134, title: "Dune: Part Two", poster: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", starts: "Not seen, on the Wishlist" },
	{ mediaType: "movie", tmdbId: 496243, title: "Parasite", poster: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", starts: "One watch, two hours ago" },
	{ mediaType: "movie", tmdbId: 157336, title: "Interstellar", poster: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", starts: "Three watches: a moment, an imported day, an imported unknown" },
	{ mediaType: "movie", tmdbId: 680, title: "Pulp Fiction", poster: "/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg", starts: "Scored 9, no watch logged" },
	{ mediaType: "movie", tmdbId: 603, title: "The Matrix", poster: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", starts: "Not seen, marked Not interested" },
	{ mediaType: "show", tmdbId: 1396, title: "Breaking Bad", poster: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg", starts: "A show: Seen stays the toggle" },
]
/** The movie at the top of Watch next. */
export const NEXT: Sample = { mediaType: "movie", tmdbId: 872585, title: "Oppenheimer", poster: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", starts: "On the Wishlist" }

/** The endpoints the stand-in answers. Every other request goes to the dev server. */
const ANSWERED = [
	"/api/user-data",
	"/api/watch-log",
	"/api/update-watch-history",
	"/api/update-scores",
	"/api/update-wishlist",
	"/api/update-not-interested",
	"/api/watch-next/watched",
]

type Key = `${"movie" | "show"}-${number}`
interface Store {
	scores: Record<Key, { score: number; review: null; updatedAt: string }>
	wishlist: Record<Key, { createdAt: string; updatedAt: string }>
	notInterested: Record<Key, { updatedAt: string }>
	logs: Record<number, WatchLogEntry[]>
	seenShows: Record<number, true>
}

const DAY = 86_400_000

function seed(): Store {
	const now = Date.now()
	const nineDaysAgo = new Date(now - 9 * DAY)
	nineDaysAgo.setHours(21, 40, 0, 0)
	const added = new Date(now - 60 * DAY).toISOString()
	const entry = (id: string, parts: Partial<WatchLogEntry>): WatchLogEntry => ({
		id,
		at: null,
		precision: "unknown",
		origin: "single",
		importId: null,
		source: null,
		createdAt: now - 20 * DAY,
		...parts,
	})
	return {
		scores: { "movie-680": { score: 9, review: null, updatedAt: added } },
		wishlist: {
			"movie-693134": { createdAt: added, updatedAt: added },
			"movie-872585": { createdAt: added, updatedAt: added },
		},
		notInterested: { "movie-603": { updatedAt: added } },
		logs: {
			496243: [entry("seed-parasite-1", { at: now - 2 * 3_600_000, precision: "moment", createdAt: now - 2 * 3_600_000 })],
			157336: [
				entry("seed-interstellar-1", { at: nineDaysAgo.getTime(), precision: "moment", createdAt: nineDaysAgo.getTime() }),
				entry("i-00000000000000000000000000000001", { at: Date.UTC(2019, 2, 12), precision: "day", origin: "import", importId: "imp-letterboxd", source: "letterboxd" }),
				entry("i-00000000000000000000000000000002", { origin: "import", importId: "imp-imdb", source: "imdb", createdAt: now - 20 * DAY - 1 }),
			],
			680: [entry(scoreWatchId(680), { origin: "score" })],
		},
		seenShows: {},
	}
}

export interface Controls {
	/** The next write to /api/watch-log answers 500. */
	failNext: boolean
	/** Milliseconds every answer waits, to see what the browser shows before it. */
	delay: number
}

export interface HarnessServer {
	controls: Controls
	requests: { method: string; url: string; body: unknown; status: number }[]
	state: () => Store
	reset: () => void
	/** Puts the harness in place of `fetch`, and returns the function that takes it out again. */
	install: (onChange: () => void) => () => void
}

export function createHarnessServer(): HarnessServer {
	let store = seed()
	const controls: Controls = { failNext: false, delay: 0 }
	const requests: HarnessServer["requests"] = []

	const key = (mediaType: string, tmdbId: number) => `${mediaType}-${tmdbId}` as Key
	/** The movie rule: the score's watch exists exactly while the movie has a score and no other watch. */
	const settle = (movieId: number) => {
		const log = store.logs[movieId] ?? []
		const own = log.filter((watch) => watch.origin !== "score")
		const scored = key("movie", movieId) in store.scores
		store.logs[movieId] =
			own.length || !scored
				? own
				: log.length
					? log
					: withoutWatch([], null, { movieId, scored: true, now: new Date() })
		if (!store.logs[movieId].length) delete store.logs[movieId]
	}
	const clearLists = (k: Key) => {
		delete store.wishlist[k]
		delete store.notInterested[k]
	}
	const userData = (): UserData => {
		let data = {
			scores: store.scores,
			wishlist: store.wishlist,
			watchState: {},
			favorites: {},
			skipped: {},
			notInterested: store.notInterested,
		} as unknown as UserData
		for (const [movieId, log] of Object.entries(store.logs))
			data = afterWatchLog(data, Number(movieId), log) as UserData
		for (const showId of Object.keys(store.seenShows))
			data.watchState[key("show", Number(showId))] = {
				state: "seen",
				watchedAt: null,
				precision: "unknown",
				count: 0,
				pass: 1,
				episodesWatched: 0,
				furthest: null,
				lastActivityAt: null,
			}
		return data
	}
	const logOf = (movieId: number) => orderWatches(store.logs[movieId] ?? [])

	// biome-ignore lint/suspicious/noExplicitAny: request bodies of several endpoints, read loosely as a stand-in may.
	function watchLog(movieId: number, action: any) {
		const log = store.logs[movieId] ?? []
		const applied = (next: WatchLogEntry[]) => {
			store.logs[movieId] = next
			settle(movieId)
			return { status: "applied", refused: null, watches: logOf(movieId) }
		}
		const refused = (why: string) => ({ status: "refused", refused: why, watches: logOf(movieId) })
		const k = key("movie", movieId)
		const scored = k in store.scores
		switch (action.type) {
			case "watch": {
				if (log.some((watch) => watch.id === action.watchId)) return applied(log)
				const when = action.when ?? { precision: "moment" }
				const at = when.precision === "moment" ? Date.now() : when.precision === "day" ? Date.parse(`${when.day}T00:00:00Z`) : null
				if (at !== null && at > Date.now() + 2 * DAY) return refused("That day has not come yet.")
				clearLists(k)
				return applied(withWatch(log, { id: action.watchId, at, precision: when.precision, origin: "single", importId: null, source: null, createdAt: Date.now() }))
			}
			case "editDate":
				if (!log.some((watch) => watch.id === action.watchId)) return refused("That watch is not in the log.")
				return applied(withDate(log, action.watchId, action.when))
			case "delete": {
				const watch = log.find((one) => one.id === action.watchId)
				if (watch?.origin === "score") return refused("This watch comes from your score. It goes when the score is cleared.")
				const answer = applied(log.filter((one) => one.id !== action.watchId))
				if (watch && !store.logs[movieId] && action.back) {
					if (action.back.wantToSeeAddedAt) store.wishlist[k] = { createdAt: action.back.wantToSeeAddedAt, updatedAt: new Date().toISOString() }
					else if (action.back.notInterested) store.notInterested[k] = { updatedAt: new Date().toISOString() }
				}
				return answer
			}
			case "removeAll":
				return applied(withoutWatch(log, null, { movieId, scored, now: new Date() }))
			case "restore": {
				const taken = new Set(log.filter((watch) => watch.origin !== "score").map((watch) => watch.id))
				const sources: Record<string, string> = { "imp-letterboxd": "letterboxd", "imp-imdb": "imdb" }
				return applied(
					withRestored(
						log,
						(action.rows as WatchLogEntry[])
							.filter((row) => !taken.has(row.id))
							.map((row) => ({ ...row, source: row.importId ? (sources[row.importId] ?? null) : null })),
					),
				)
			}
		}
		return refused("No such action.")
	}

	// biome-ignore lint/suspicious/noExplicitAny: as above.
	function answer(method: string, path: string, query: URLSearchParams, body: any): { status: number; json: unknown } | null {
		if (path === "/api/user-data") return { status: 200, json: userData() }
		if (path === "/api/watch-log") {
			if (method === "GET") return { status: 200, json: { watches: logOf(Number(query.get("tmdb_id"))) } }
			if (controls.failNext) {
				controls.failNext = false
				return { status: 500, json: { error: "The harness was told to fail" } }
			}
			return { status: 200, json: watchLog(Number(body.tmdb_id), body.action) }
		}
		if (path === "/api/update-watch-history") {
			const k = key(body.media_type, body.tmdb_id)
			if (body.media_type === "show") {
				if (body.action === "add") {
					store.seenShows[body.tmdb_id] = true
					clearLists(k)
				} else delete store.seenShows[body.tmdb_id]
			} else if (body.action === "add") watchLog(body.tmdb_id, { type: "watch", watchId: body.action_id ?? `press-${Date.now()}` })
			else watchLog(body.tmdb_id, { type: "removeAll" })
			return { status: 200, json: { status: "success" } }
		}
		if (path === "/api/update-scores") {
			const k = key(body.media_type, body.tmdb_id)
			if (body.score === null) delete store.scores[k]
			else {
				store.scores[k] = { score: body.score, review: null, updatedAt: new Date().toISOString() }
				delete store.notInterested[k]
			}
			if (body.media_type === "movie") {
				const before = store.logs[body.tmdb_id]?.length ?? 0
				settle(body.tmdb_id)
				if (!before && body.score !== null) delete store.wishlist[k]
			}
			return { status: 200, json: { status: "success" } }
		}
		if (path === "/api/update-wishlist" || path === "/api/update-not-interested") {
			const k = key(body.media_type, body.tmdb_id)
			const list = path === "/api/update-wishlist" ? "wishlist" : "notInterested"
			const now = new Date().toISOString()
			delete store.wishlist[k]
			delete store.notInterested[k]
			if (body.action === "add") store[list][k] = { createdAt: now, updatedAt: now }
			return { status: 200, json: { status: "success" } }
		}
		if (path === "/api/watch-next/watched") {
			if ("key" in body) {
				const { mediaType, tmdbId } = parseTitleKey(body.key)
				const k = key(mediaType, tmdbId)
				const addedAt = store.wishlist[k]?.createdAt ?? null
				const has = (store.logs[tmdbId] ?? []).some((watch) => watch.origin !== "score")
				const watchId = has ? null : `finish-${Date.now()}`
				if (watchId) watchLog(tmdbId, { type: "watch", watchId })
				delete store.wishlist[k]
				return { status: 200, json: { undo: { key: body.key, addedAt, watchId } } }
			}
			const { mediaType, tmdbId } = parseTitleKey(body.undo.key)
			if (body.undo.watchId) watchLog(tmdbId, { type: "delete", watchId: body.undo.watchId })
			if (body.undo.addedAt) store.wishlist[key(mediaType, tmdbId)] = { createdAt: body.undo.addedAt, updatedAt: body.undo.addedAt }
			return { status: 200, json: { ok: true } }
		}
		return null
	}

	return {
		controls,
		requests,
		state: () => store,
		reset: () => {
			store = seed()
		},
		install(onChange) {
			const real = window.fetch
			window.fetch = async (input, init) => {
				const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin)
				const method = (init?.method ?? "GET").toUpperCase()
				const body = typeof init?.body === "string" ? JSON.parse(init.body) : null
				if (url.origin !== window.location.origin || !ANSWERED.includes(url.pathname)) return real(input, init)
				// The wait comes first: what the stand-in holds changes when it answers, as on a server.
				if (controls.delay) await new Promise((resolve) => setTimeout(resolve, controls.delay))
				const answered = answer(method, url.pathname, url.searchParams, body)
				if (!answered) return real(input, init)
				requests.push({ method, url: url.pathname + url.search, body, status: answered.status })
				onChange()
				return new Response(JSON.stringify(answered.json), {
					status: answered.status,
					headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
				})
			}
			return () => {
				window.fetch = real
			}
		},
	}
}
