import { setTimeout as delay } from "node:timers/promises"
import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ImportWarning,
	type ParsedImport,
	importActionable,
	importInfo,
} from "../../domain/imports.ts"
import {
	timeoutSetting,
	withBackendTimeout,
} from "../../utils/backend-timeout.ts"

// Reads a member's MDBList account with their personal API key, read-only, for one import preview. The rules come
// from the #711 reader and its real-account runs (docs/prototypes/wishlist-imports/mdblist-reader):
// - A read is complete only when its last page says there is no more and has no cursor.
// - The Watchlist also sends counts (X-Total-Items, X-Matched-Items, pagination.total); a missing one leaves the read
//   unconfirmed and a different one makes it partial. History routes send no totals.
// - Routes that filter by type are read again per type; a row missing either way makes the read partial.
// - Unknown lists or rows that aren't objects leave the read unconfirmed. A list that isn't a list fails it.

/** Only fixed messages cross this boundary: the key travels in the request URL, which fetch errors can contain. */
export class MdblistError extends Error {
	readonly status: number
	constructor(
		message = "MDBList couldn't complete this import. Please try again.",
		status = 502,
	) {
		super(message)
		this.status = status
	}
}

const BASE = "https://api.mdblist.com"
// MDBList refuses some requests without a User-Agent (seen with Python's default client on October 23, 2026).
const USER_AGENT = "GoodWatch/1.0 (+https://goodwatch.app/settings/imports)"
const PAGE_SIZE = 1000
const MAX_PAGES = 100
const MAX_RETRY_AFTER_MS = 30_000
const BUCKETS = ["movies", "shows", "seasons", "episodes"] as const
type Bucket = (typeof BUCKETS)[number]
type JsonRecord = Record<string, unknown>
type Coverage = "complete" | "partial" | "unknown"
const COVERAGE_ORDER: Coverage[] = ["complete", "unknown", "partial"]
const worse = (a: Coverage, b: Coverage) =>
	COVERAGE_ORDER.indexOf(a) >= COVERAGE_ORDER.indexOf(b) ? a : b

const record = (value: unknown): JsonRecord | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonRecord)
		: null
const positiveId = (value: unknown) =>
	typeof value === "number" && Number.isSafeInteger(value) && value > 0
		? value
		: null
const imdb = (value: unknown) =>
	typeof value === "string" && /^tt\d{1,10}$/.test(value) ? value : null
const year = (value: unknown) =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 1870 &&
	value <= 2200
		? value
		: null
const title = (value: unknown) =>
	typeof value === "string" ? value.trim().slice(0, 500) : ""
const moment = (value: unknown) => {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value))
		return null
	const time = Date.parse(value)
	return Number.isFinite(time) ? new Date(time).toISOString() : null
}
const seasonNumber = (value: unknown) => (value === 0 ? 0 : positiveId(value))
const integerHeader = (headers: Headers, name: string) => {
	const value = headers.get(name)
	if (value === null) return undefined
	return /^\d+$/.test(value.trim()) ? Number(value) : Number.NaN
}

interface RouteRead {
	rows: Record<Bucket, JsonRecord[]>
	coverage: Coverage
}
interface RouteSpec {
	path: string
	params?: Record<string, string>
	buckets: readonly Bucket[]
	/** The Watchlist sends counts on every page; history routes don't. */
	counts?: boolean
	/** Types the route can filter by, to read again and compare. */
	crossCheck?: readonly ("movie" | "show" | "season" | "episode")[]
	/** How a sentence names what was read: "your Watchlist". */
	noun: string
}

export function createMdblistClient(options: {
	fetch?: typeof fetch
	sleep?: (ms: number) => Promise<unknown>
	base?: string
	pageSize?: number
}) {
	const send = options.fetch ?? fetch
	const sleep = options.sleep ?? delay
	const base = options.base || BASE
	const pageSize = options.pageSize ?? PAGE_SIZE

	async function request(
		apiKey: string,
		path: string,
		params: Record<string, string>,
	): Promise<{ body: unknown; headers: Headers }> {
		const url = new URL(path, base)
		for (const [name, value] of Object.entries(params))
			url.searchParams.set(name, value)
		// MDBList documents only the apikey query parameter for personal keys.
		url.searchParams.set("apikey", apiKey)
		let busy = 0
		for (let attempt = 0; ; attempt++) {
			let response: Response
			try {
				response = await withBackendTimeout(
					"MDBList",
					timeoutSetting("MDBLIST_TIMEOUT_MS", 15_000),
					(signal) =>
						send(url.toString(), {
							method: "GET",
							signal,
							redirect: "error",
							headers: { Accept: "application/json", "User-Agent": USER_AGENT },
						}),
				)
			} catch {
				if (attempt < 2) {
					await sleep(1000 * 2 ** attempt)
					continue
				}
				throw new MdblistError(
					"GoodWatch couldn't reach MDBList. Please try again.",
					503,
				)
			}
			if (response.ok) {
				try {
					return { body: await response.json(), headers: response.headers }
				} catch {
					throw new MdblistError(
						"MDBList sent an unreadable answer. Please try again.",
					)
				}
			}
			// Provider text is never read: it can repeat the key.
			await response.body?.cancel().catch(() => {})
			if (response.status === 401)
				throw new MdblistError(
					"MDBList didn't accept this API key. Copy it again from your MDBList preferences.",
					400,
				)
			if (response.status === 403)
				throw new MdblistError(
					"MDBList refused the request. Please try again later.",
				)
			if (response.status === 429) {
				if (response.headers.get("X-RateLimit-Remaining") === "0")
					throw new MdblistError(
						"Your MDBList daily request limit is used up. Try again after midnight UTC.",
						429,
					)
				const retry = response.headers.get("Retry-After")
				const wait =
					retry !== null && /^\d+$/.test(retry.trim())
						? Number(retry) * 1000
						: 2000
				if (busy++ === 0 && wait <= MAX_RETRY_AFTER_MS) {
					await sleep(wait)
					continue
				}
				throw new MdblistError("MDBList is busy. Please try again later.", 429)
			}
			if (response.status >= 500 && attempt < 2) {
				await sleep(1000 * 2 ** attempt)
				continue
			}
			throw new MdblistError(
				"MDBList isn't responding. Please try again later.",
				response.status >= 500 ? 503 : 502,
			)
		}
	}

	async function readOnce(
		apiKey: string,
		spec: RouteSpec,
		filter?: string,
	): Promise<RouteRead> {
		const rows = Object.fromEntries(
			BUCKETS.map((b) => [b, []]),
		) as unknown as Record<Bucket, JsonRecord[]>
		let coverage: Coverage = "complete"
		const totals: number[] = []
		const cursors = new Set<string>()
		let cursor: string | undefined
		let count = 0
		for (let page = 0; ; page++) {
			if (page >= MAX_PAGES)
				throw new MdblistError(
					"This MDBList account has more pages than GoodWatch reads in one import.",
					400,
				)
			const { body, headers } = await request(apiKey, spec.path, {
				...spec.params,
				...(filter ? { mediatype: filter } : {}),
				limit: String(pageSize),
				...(cursor ? { cursor } : {}),
			})
			const data = record(body)
			if (!data || !spec.buckets.some((bucket) => Array.isArray(data[bucket])))
				throw new MdblistError(
					"MDBList sent an unreadable list. Please try again.",
				)
			let pageRows = 0
			for (const [name, value] of Object.entries(data)) {
				if ((BUCKETS as readonly string[]).includes(name)) {
					if (value === null || value === undefined) continue
					if (!Array.isArray(value))
						throw new MdblistError(
							"MDBList sent an unreadable list. Please try again.",
						)
					if (!spec.buckets.includes(name as Bucket) && value.length) {
						coverage = worse(coverage, "unknown")
						continue
					}
					for (const row of value) {
						pageRows++
						const item = record(row)
						if (item) rows[name as Bucket].push(item)
						else coverage = worse(coverage, "unknown")
					}
				} else if (name !== "pagination") coverage = worse(coverage, "unknown")
			}
			count += pageRows
			if (count > IMPORT_MAX_ROWS)
				throw new MdblistError(
					"That account produces more than 50,000 import items.",
					400,
				)
			const pagination =
				data.pagination === undefined ? {} : record(data.pagination)
			if (!pagination) coverage = worse(coverage, "unknown")
			const matched = integerHeader(headers, "X-Matched-Items")
			if (matched === undefined) {
				if (spec.counts) coverage = worse(coverage, "unknown")
			} else if (Number.isNaN(matched)) coverage = worse(coverage, "unknown")
			else if (matched !== pageRows) coverage = worse(coverage, "partial")
			if (spec.counts) {
				const total = integerHeader(headers, "X-Total-Items")
				if (total === undefined || Number.isNaN(total))
					coverage = worse(coverage, "unknown")
				else totals.push(total)
			}
			if (pagination?.total !== undefined) {
				if (typeof pagination.total === "number") totals.push(pagination.total)
				else coverage = worse(coverage, "unknown")
			}
			const next =
				typeof pagination?.next_cursor === "string" && pagination.next_cursor
					? pagination.next_cursor
					: undefined
			const header = headers.get("X-Has-More")?.trim().toLowerCase()
			const fromHeader =
				header === "true" ? true : header === "false" ? false : undefined
			const fromBody =
				typeof pagination?.has_more === "boolean"
					? pagination.has_more
					: undefined
			if (
				fromHeader !== undefined &&
				fromBody !== undefined &&
				fromHeader !== fromBody
			)
				coverage = worse(coverage, "unknown")
			const more = fromHeader ?? fromBody
			if (next) {
				if (cursors.has(next) || more === false)
					throw new MdblistError(
						`MDBList stopped before the end of ${spec.noun}. Please try again.`,
					)
				cursors.add(next)
				cursor = next
				continue
			}
			if (more === true)
				throw new MdblistError(
					`MDBList stopped before the end of ${spec.noun}. Please try again.`,
				)
			if (more === undefined) coverage = worse(coverage, "unknown")
			break
		}
		if (totals.some((total) => total !== count))
			coverage = worse(coverage, "partial")
		return { rows, coverage }
	}

	async function read(apiKey: string, spec: RouteSpec): Promise<RouteRead> {
		const combined = await readOnce(apiKey, spec)
		let coverage = combined.coverage
		for (const type of spec.crossCheck ?? []) {
			const bucket = `${type}s` as Bucket
			const filtered = await readOnce(apiKey, spec, type)
			coverage = worse(coverage, filtered.coverage)
			const a = combined.rows[bucket].map(identity).sort()
			const b = filtered.rows[bucket].map(identity).sort()
			if (a.length !== b.length || a.some((value, index) => value !== b[index]))
				coverage = worse(coverage, "partial")
			for (const other of BUCKETS)
				if (other !== bucket && filtered.rows[other].length)
					coverage = worse(coverage, "partial")
		}
		return { rows: combined.rows, coverage }
	}

	return {
		async readAccount(apiKey: string): Promise<ParsedImport> {
			const observations: ImportObservation[] = []
			const warnings: ImportWarning[] = [
				importInfo(
					"MDBList half-step ratings round up to whole numbers: 7.5 becomes 8.",
				),
			]
			const check = (read: RouteRead, noun: string) => {
				if (read.coverage === "partial")
					warnings.push(
						importActionable(
							`MDBList's count of ${noun} didn't match what GoodWatch read. Review this partial import or connect again.`,
						),
					)
				else if (read.coverage === "unknown")
					warnings.push(
						importActionable(
							`MDBList couldn't confirm that GoodWatch read ${noun === "your Watchlist" ? "your whole Watchlist" : `all ${noun}`}. Some items may be missing; review this import or connect again.`,
						),
					)
			}

			const watchlist = await read(apiKey, {
				path: "/watchlist/items",
				buckets: BUCKETS,
				counts: true,
				crossCheck: ["movie", "show", "season", "episode"],
				noun: "your Watchlist",
			})
			check(watchlist, "your Watchlist")
			for (const bucket of ["movies", "shows"] as const)
				for (const row of watchlist.rows[bucket]) {
					const base = topLevel(row, bucket === "movies" ? "movie" : "show")
					observations.push({
						key: `mdblist:want:${base.mediaType}:${sourceKey(base, row)}`,
						kind: "want",
						...base,
						addedAt: moment(row.watchlist_at),
					})
				}
			for (const bucket of ["seasons", "episodes"] as const)
				for (const row of watchlist.rows[bucket]) {
					const show = parent(row, bucket === "seasons" ? "season" : "episode")
					observations.push({
						key: `mdblist:want:${bucket}:${sourceKey(show, row)}:${JSON.stringify(coordinates(row))}`,
						kind: "unsupported",
						...show,
						problem: {
							outcome: "unsupported",
							reason: `GoodWatch adds whole shows to Want to See. This MDBList ${bucket === "seasons" ? "season" : "episode"} wasn't added.`,
						},
					})
				}

			const plays = await read(apiKey, {
				path: "/sync/watched",
				params: { plays: "all" },
				buckets: ["movies", "episodes"],
				crossCheck: ["movie", "episode"],
				noun: "your watch history",
			})
			check(plays, "your watch history")
			// The latest watch date per item. MDBList keeps a later one on the item than in its plays when a watch was
			// added without a play (owner decision Q43, October 23, 2026: that is a real extra watch).
			const items = {
				movies: await readOnce(
					apiKey,
					{
						path: "/sync/watched",
						buckets: ["movies"],
						noun: "your watched movies",
					},
					"movie",
				),
				episodes: await readOnce(
					apiKey,
					{
						path: "/sync/watched",
						buckets: ["episodes"],
						noun: "your watched episodes",
					},
					"episode",
				),
			}
			check(items.movies, "your watched movies")
			check(items.episodes, "your watched episodes")

			const latestPlay = new Map<string, number>()
			const timestamps = new Map<string, number>()
			const usedPlays = new Set<string>()
			const watch = (
				row: JsonRecord,
				bucket: "movies" | "episodes",
				key: string,
				watchedAt: string | null,
			): ImportObservation => {
				if (watchedAt)
					timestamps.set(watchedAt, (timestamps.get(watchedAt) ?? 0) + 1)
				if (bucket === "movies")
					return {
						key,
						kind: "watch",
						...nested(row.movie, "movie"),
						watchedAt,
						precision: watchedAt ? "moment" : "unknown",
						pass: 1,
					}
				const episode = record(row.episode) ?? {}
				return {
					key,
					kind: "watch",
					...nested(episode.show, "show"),
					episodeTmdbId: positiveId(record(episode.ids)?.tmdb),
					episodeTvdbId: positiveId(record(episode.ids)?.tvdb),
					episodeName:
						typeof episode.name === "string"
							? episode.name.slice(0, 500)
							: null,
					episodeNumbering: "tmdb",
					season: seasonNumber(episode.season),
					episode: positiveId(episode.number),
					watchedAt,
					precision: watchedAt ? "moment" : "unknown",
					pass: 1,
				}
			}
			for (const bucket of ["movies", "episodes"] as const)
				for (const [index, row] of plays.rows[bucket].entries()) {
					const playId =
						typeof row.play_id === "number" || typeof row.play_id === "string"
							? String(row.play_id)
							: `${bucket}:${index}`
					if (usedPlays.has(playId))
						throw new MdblistError(
							"MDBList sent the same play twice. Please try again.",
						)
					usedPlays.add(playId)
					const watchedAt = moment(row.watched_at)
					const item = itemKey(row, bucket)
					if (watchedAt && item)
						latestPlay.set(
							item,
							Math.max(latestPlay.get(item) ?? 0, Date.parse(watchedAt)),
						)
					observations.push(
						watch(row, bucket, `mdblist:watch:${playId}`, watchedAt),
					)
				}
			let latestOnly = 0
			for (const bucket of ["movies", "episodes"] as const)
				for (const row of items[bucket].rows[bucket]) {
					const item = itemKey(row, bucket)
					const last = moment(row.last_watched_at)
					if (!item || !last || Date.parse(last) <= (latestPlay.get(item) ?? 0))
						continue
					latestOnly++
					observations.push(
						watch(row, bucket, `mdblist:watch:latest:${item}:${last}`, last),
					)
				}
			if (latestOnly)
				warnings.push(
					importInfo(
						`${latestOnly.toLocaleString("en-US")} ${latestOnly === 1 ? "watch comes" : "watches come"} from MDBList's latest watched date, because MDBList's history has no play for ${latestOnly === 1 ? "it" : "them"}.`,
					),
				)
			const largestCluster = Math.max(0, ...timestamps.values())
			if (largestCluster >= 100)
				warnings.push(
					importInfo(
						`${largestCluster.toLocaleString("en-US")} watches share one MDBList timestamp. Their original dates were preserved.`,
					),
				)

			const ratings = await read(apiKey, {
				path: "/sync/ratings",
				buckets: BUCKETS,
				noun: "your ratings",
			})
			check(ratings, "your ratings")
			for (const bucket of ["movies", "shows"] as const)
				for (const row of ratings.rows[bucket]) {
					const mediaType = bucket === "movies" ? "movie" : "show"
					const base = nested(row[mediaType], mediaType)
					const score = halfStepScore(row)
					observations.push({
						key: `mdblist:rating:${mediaType}:${sourceKey(base, row)}`,
						kind: "rating",
						...base,
						score,
						addedAt: moment(row.rated_at),
						...(score === null
							? {
									problem: {
										outcome: "invalid" as const,
										reason:
											"The MDBList rating isn't a half step from 1 to 10.",
									},
								}
							: {}),
					})
				}
			let seasonRatings = 0
			for (const bucket of ["seasons", "episodes"] as const)
				for (const row of ratings.rows[bucket]) {
					seasonRatings++
					const show = parent(row, bucket === "seasons" ? "season" : "episode")
					observations.push({
						key: `mdblist:unsupported-rating:${bucket}:${sourceKey(show, row)}:${JSON.stringify(coordinates(row))}`,
						kind: "unsupported",
						...show,
						problem: {
							outcome: "unsupported",
							reason: "GoodWatch doesn't import season or episode ratings yet.",
						},
					})
				}
			if (seasonRatings)
				warnings.push(
					importInfo(
						"Season and episode ratings were kept as unsupported items.",
					),
				)

			const dropped = await read(apiKey, {
				path: "/sync/dropped",
				buckets: ["shows"],
				noun: "your dropped shows",
			})
			check(dropped, "your dropped shows")
			for (const row of dropped.rows.shows) {
				const base = nested(row.show ?? row, "show")
				observations.push({
					key: `mdblist:dropped:show:${sourceKey(base, row)}`,
					kind: "show_status",
					...base,
					showStatus: "dropped",
				})
			}
			const droppedSeasons = await read(apiKey, {
				path: "/sync/seasons/dropped",
				buckets: ["seasons"],
				noun: "your dropped seasons",
			})
			check(droppedSeasons, "your dropped seasons")
			for (const row of droppedSeasons.rows.seasons) {
				const show = parent(row, "season")
				observations.push({
					key: `mdblist:dropped:season:${sourceKey(show, row)}:${JSON.stringify(coordinates(row))}`,
					kind: "unsupported",
					...show,
					problem: {
						outcome: "unsupported",
						reason:
							"GoodWatch doesn't track dropped seasons, so this season was left as it is.",
					},
				})
			}

			warnings.push(
				importInfo(
					"MDBList custom lists, collection, liked lists, and favorite people aren't part of this import.",
				),
			)
			const parsed: ParsedImport = { source: "mdblist", observations, warnings }
			// A title could repeat the key; nothing that contains it may reach the preview.
			if (JSON.stringify(parsed).includes(apiKey))
				throw new MdblistError(
					"MDBList sent data GoodWatch can't import safely. Please contact GoodWatch support.",
				)
			return parsed
		},
	}
}
export type MdblistClient = ReturnType<typeof createMdblistClient>

type Base = Pick<
	ImportObservation,
	"mediaType" | "title" | "year" | "tmdbId" | "imdbId"
>

/** A Watchlist row: IDs and title on the row itself. The generic `id` is never taken as a TMDB ID. */
function topLevel(row: JsonRecord, mediaType: "movie" | "show"): Base {
	const ids = record(row.ids)
	return {
		mediaType,
		title: title(row.title),
		year: year(row.release_year) ?? year(row.year),
		tmdbId: positiveId(ids?.tmdb),
		imdbId: imdb(ids?.imdb) ?? imdb(row.imdb_id),
	}
}

/** A sync row: the title sits in a nested movie or show object, as in Trakt. */
function nested(value: unknown, mediaType: "movie" | "show"): Base {
	const item = record(value) ?? {}
	const ids = record(item.ids)
	return {
		mediaType,
		title: title(item.title),
		year: year(item.year),
		tmdbId: positiveId(ids?.tmdb),
		imdbId: imdb(ids?.imdb),
	}
}

/** The parent show of a season or episode row; the row's own IDs belong to the season or episode. */
function parent(row: JsonRecord, kind: "season" | "episode"): Base {
	const inner = record(row[kind])
	return nested(inner?.show ?? row.show, "show")
}

function coordinates(row: JsonRecord) {
	const season = record(row.season)
	const episode = record(row.episode)
	return {
		season: seasonNumber(season?.number ?? episode?.season),
		episode: positiveId(episode?.number),
	}
}

function sourceKey(base: Base, row: JsonRecord) {
	if (base.tmdbId) return `tmdb:${base.tmdbId}`
	if (base.imdbId) return `imdb:${base.imdbId}`
	const ids = record(row.ids) ?? record(record(row.movie ?? row.show)?.ids)
	const mdblist = ids?.mdblist
	return typeof mdblist === "string" && mdblist
		? `mdblist:${mdblist.slice(0, 100)}`
		: `title:${base.title}:${base.year ?? ""}`
}

/** One movie, or one episode of one show, across the plays and the per-item rows. */
function itemKey(row: JsonRecord, bucket: "movies" | "episodes") {
	if (bucket === "movies") {
		const base = nested(row.movie, "movie")
		return base.tmdbId || base.imdbId ? `movie:${sourceKey(base, row)}` : null
	}
	const episode = record(row.episode)
	const show = nested(episode?.show, "show")
	const season = seasonNumber(episode?.season)
	const number = positiveId(episode?.number)
	if ((!show.tmdbId && !show.imdbId) || season === null || number === null)
		return null
	return `episode:${sourceKey(show, row)}:${season}:${number}`
}

/** For the per-type comparison: the same row reads the same in both reads. */
function identity(row: JsonRecord) {
	if (typeof row.play_id === "number" || typeof row.play_id === "string")
		return `play:${row.play_id}`
	// IDs and coordinates only: fields like a Watchlist rank can differ between reads.
	const inner = record(row.movie ?? row.show ?? row.season ?? row.episode)
	const ids = record(row.ids) ?? record(inner?.ids) ?? {}
	const show = record(inner?.show ?? row.show)
	return JSON.stringify([
		Object.entries(ids).sort(),
		Object.entries(record(show?.ids) ?? {}).sort(),
		coordinates(row),
		row.title ?? inner?.title ?? null,
	])
}

/** `rating_precise` (1 to 10 in half steps) rounded half up, as the TMDB import does; else a whole `rating`. */
function halfStepScore(row: JsonRecord) {
	const precise = row.rating_precise
	if (precise !== undefined && precise !== null)
		return typeof precise === "number" &&
			precise >= 1 &&
			precise <= 10 &&
			Number.isInteger(precise * 2)
			? Math.round(precise)
			: null
	const whole = row.rating
	return typeof whole === "number" &&
		Number.isInteger(whole) &&
		whole >= 1 &&
		whole <= 10
		? whole
		: null
}
