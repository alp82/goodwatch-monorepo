// PROTOTYPE - throwaway. Data for the living room start page prototype (#178): a curated lineup of titles
// with their scores, fingerprints, and streaming, the member's real recommendations when signed in, and a
// few canned natural-language searches. Read-only; every source is an existing cached function.
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import { getTrendingMovies } from "~/server/trending.server"
import { getUserRecommendations } from "~/server/user-recommendations.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { PillarTiers } from "~/server/utils/fingerprint"
import { combinedSearch } from "~/server/combined-search/search.server"
import { getUserFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"

export interface LRService {
	id: number
	name: string
	logo: string
	kind: "stream" | "free" | "rent" | "buy"
}

export interface LRTitle {
	key: string
	tmdbId: number
	type: "movie" | "show"
	title: string
	year: string
	tagline: string
	genres: string[]
	runtime: number | null
	seasons: number | null
	poster: string | null
	backdrop: string | null
	gw: number | null
	gwVotes: number | null
	imdb: number | null
	imdbVotes: number | null
	metacritic: number | null
	rt: number | null
	rtAudience: number | null
	tmdb: number | null
	pillars: PillarTiers | null
	scores: Record<string, number> | null
	highlights: string[]
	essence: string
	essenceTags: string[]
	suits: string[]
	contexts: string[]
	services: LRService[]
}

export interface LRRec {
	key: string
	title: string
	year: string
	poster: string | null
	backdrop: string | null
	gw: number | null
	match: number
	tags: string[]
}

export interface LRData {
	country: string
	signedIn: boolean
	lineup: LRTitle[]
	recs: LRRec[]
	trending: { key: string; title: string; poster: string }[]
}

// Picked for spread: every pillar leads somewhere, movies and shows, old and new, loud and quiet.
const LINEUP: Array<{ id: string; type: "movie" | "show" }> = [
	{ id: "693134", type: "movie" }, // Dune: Part Two
	{ id: "329865", type: "movie" }, // Arrival
	{ id: "496243", type: "movie" }, // Parasite
	{ id: "136315", type: "show" }, // The Bear
	{ id: "129", type: "movie" }, // Spirited Away
	{ id: "546554", type: "movie" }, // Knives Out
	{ id: "95396", type: "show" }, // Severance
	{ id: "346648", type: "movie" }, // Paddington 2
		{ id: "1396", type: "show" }, // Breaking Bad
	{ id: "545611", type: "movie" }, // Everything Everywhere All at Once
	{ id: "2316", type: "show" }, // The Office
	{ id: "27205", type: "movie" }, // Inception
]

const KIND: Record<string, LRService["kind"] | undefined> = {
	flatrate: "stream",
	flatrate_and_buy: "stream",
	free: "free",
	ads: "free",
	rent: "rent",
	buy: "buy",
}

const brand = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6)

function toTitle(media: MovieResult | ShowResult): LRTitle {
	const d = media.details as any
	const fp = d.fingerprint ?? media.fingerprint ?? null
	const byService = new Map<number, LRService["kind"]>()
	const rank = { stream: 0, free: 1, rent: 2, buy: 3 }
	for (const sa of media.streaming_availabilities ?? []) {
		const kind = KIND[sa.streaming_type]
		if (!kind) continue
		const prev = byService.get(sa.streaming_service_id)
		if (!prev || rank[kind] < rank[prev]) byService.set(sa.streaming_service_id, kind)
	}
	const services = (media.streaming_services ?? [])
		.filter((s) => byService.has(s.tmdb_id))
		.map((s) => ({ id: s.tmdb_id, name: s.name, logo: s.logo, kind: byService.get(s.tmdb_id)! }))
		.sort((a, b) => rank[a.kind] - rank[b.kind])
		// Variants of one service ("with Ads", store channels) share a logo; show it once.
		.filter((s, i, all) => all.findIndex((o) => o.logo === s.logo || brand(o.name) === brand(s.name)) === i)
		.slice(0, 8)
	return {
		key: `${media.mediaType}:${d.tmdb_id}`,
		tmdbId: d.tmdb_id,
		type: media.mediaType,
		title: d.title,
		year: String(d.release_year ?? ""),
		tagline: d.tagline ?? "",
		genres: d.genres ?? [],
		runtime: d.runtime ?? d.episode_run_time?.[0] ?? null,
		seasons: d.number_of_seasons ?? null,
		poster: d.poster_path ?? null,
		backdrop: d.backdrop_path ?? null,
		gw: d.goodwatch_overall_score_normalized_percent ?? null,
		gwVotes: d.goodwatch_overall_score_voting_count ?? null,
		imdb: d.imdb_user_score_original ?? null,
		imdbVotes: d.imdb_user_score_rating_count ?? null,
		metacritic: d.metacritic_meta_score_original ?? null,
		rt: d.rotten_tomatoes_tomato_score_original ?? null,
		rtAudience: d.rotten_tomatoes_audience_score_original ?? null,
		tmdb: d.tmdb_user_score_original ?? null,
		pillars: fp?.pillars ?? null,
		scores: fp?.scores ?? null,
		highlights: fp?.highlightKeys ?? [],
		essence: fp?.essenceText ?? "",
		essenceTags: fp?.essenceTags ?? [],
		suits: (fp?.socialSuitability ?? []).map((s: { name: string }) => s.name),
		contexts: (fp?.viewingContext ?? []).map((s: { name: string }) => s.name),
		services,
	}
}

// Process cache for the loader: without it every page load ran about 40 queries (12 title lookups, trending,
// recommendations), which flooded the dev server's log and slowed the whole machine during prototyping.
const loaderCache = new Map<string, { at: number; value: Promise<any> }>()
function memo<T>(key: string, ttl: number, run: () => Promise<T>): Promise<T> {
	const hit = loaderCache.get(key)
	if (hit && Date.now() - hit.at < ttl) return hit.value
	const value = run()
	loaderCache.set(key, { at: Date.now(), value })
	value.catch(() => loaderCache.delete(key))
	return value
}

export async function getLivingRoom(request: Request): Promise<LRData> {
	const { locale } = getLocaleFromRequest(request)
	const url = new URL(request.url)
	const country = url.searchParams.get("country") ?? locale.country
	const user = await getUserFromRequest({ request })
	const language = "en"

	const [lineup, recs, trending] = await Promise.all([
		memo(`lineup:${country}`, 30 * 60_000, () => Promise.all(
			LINEUP.map(async ({ id, type }) => {
				try {
					const media =
						type === "movie"
							? await getDetailsForMovie({ movieId: id, country, language })
							: await getDetailsForShow({ showId: id, country, language })
					return toTitle(media)
				} catch (e) {
					console.error("[prototype living room] details failed", type, id, e)
					return null
				}
			}),
		)),
		user?.id
			? memo(`recs:${user.id}`, 5 * 60_000, () => getUserRecommendations({ userId: user.id, limit: 24 }).catch(() => []))
			: Promise.resolve([]),
		memo(`trending:${country}`, 30 * 60_000, () => getTrendingMovies({ type: "default", country, language }).catch(() => [])),
	])

	return {
		country,
		signedIn: !!user,
		lineup: lineup.filter((t): t is LRTitle => !!t && !!t.poster),
		recs: recs.slice(0, 24).map((r) => ({
			key: `${r.media_type}:${r.tmdb_id}`,
			title: r.title,
			year: r.release_year,
			poster: r.poster_path,
			backdrop: r.backdrop_path,
			gw: r.goodwatch_overall_score_normalized_percent ?? null,
			match: Math.round(r.match_percentage),
			tags: r.essence_tags?.slice(0, 3) ?? [],
		})),
		trending: (trending as any[])
			.filter((t) => t.poster_path)
			.slice(0, 24)
			.map((t) => ({ key: `movie:${t.tmdb_id}`, title: t.title, poster: t.poster_path })),
	}
}

// Canned searches for the search channel. Run once per process and kept, so tuning in never pays for a
// new reading. Results are the real ranked titles.
export const CANNED_SEARCHES = [
	"a cozy mystery for a rainy sunday",
	"mind-bending sci-fi that makes you cry",
	"feel-good comedy to watch with my parents",
	"slow-burn thriller set in winter",
]

export interface LRSearch {
	q: string
	reading: { text: string; kind: string }[]
	rows: { key: string; title: string; year: string; poster: string | null }[]
}

const searchCache = new Map<string, Promise<LRSearch>>()

export function getCannedSearch(q: string): Promise<LRSearch> {
	let hit = searchCache.get(q)
	if (!hit) {
		hit = combinedSearch(
			q,
			{ includeAdult: false, lesserKnown: false, filters: {} },
			{ accountId: null, networkIdentity: "prototype-living-room" },
			AbortSignal.timeout(20000),
		)
			.then((batch) => ({
				q,
				reading: (batch.reading ?? []).map((c) => ({ text: c.text, kind: c.kind })).slice(0, 5),
				rows: batch.rows
					.filter((r) => r.poster)
					.slice(0, 8)
					.map((r) => ({ key: r.key, title: r.title, year: r.year, poster: r.poster })),
			}))
			.catch((e) => {
				searchCache.delete(q)
				throw e
			})
		searchCache.set(q, hit)
	}
	return hit
}

// ---------------------------------------------------------------------------------------------------------
// Tuning from the remote: moods and attribute switches rank a pool of well-known titles by fingerprint.
// The pool loads once per process; every tune after that is arithmetic, no queries and no paid readings.

export const TUNE_KEYS = [
	"adrenaline", "tension", "scare", "romance", "wholesome", "wonder", "pathos", "melancholy",
	"situational_comedy", "wit_wordplay", "dark_humor", "absurdist_humor", "mystery", "crime", "fantasy",
	"futuristic", "complexity", "slow_burn", "fast_pace", "violence", "hopefulness", "bleakness",
	"surrealism", "philosophical", "cinematography", "spectacle", "nostalgia", "coming_of_age", "catharsis", "intrigue",
] as const

export interface LRTuned {
	key: string
	title: string
	year: string
	poster: string | null
	gw: number | null
	fit: number
	top: string[]
}

interface PoolRow {
	key: string
	title: string
	year: string
	poster: string | null
	gw: number | null
	votes: number
	fp: Record<string, number>
}

let pool: Promise<PoolRow[]> | null = null
function getPool() {
	pool ??= (async () => {
		const { query } = await import("~/utils/crate")
		const load = (type: "movie" | "show", limit: number) =>
			query<{ tmdb_id: number; title: string; release_year: number; poster_path: string | null; score: number | null; votes: number; fp: Record<string, number> | null }>(
				`SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent AS score,
					goodwatch_overall_score_voting_count AS votes, fingerprint_scores AS fp
				 FROM ${type}
				 WHERE fingerprint_scores IS NOT NULL AND poster_path IS NOT NULL AND adult = false
					AND goodwatch_overall_score_voting_count >= 20000
				 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${limit}`,
			).then((rows) =>
				rows
					.filter((r) => r.fp)
					.map((r) => ({
						key: `${type}:${r.tmdb_id}`,
						title: r.title,
						year: String(r.release_year ?? ""),
						poster: r.poster_path,
						gw: r.score,
						votes: r.votes,
						fp: r.fp!,
					})),
			)
		const [m, s] = await Promise.all([load("movie", 2500), load("show", 1200)])
		return [...m, ...s]
	})().catch((e) => {
		pool = null
		throw e
	})
	return pool
}

export async function tune(include: string[], exclude: string[]): Promise<LRTuned[]> {
	const inc = include.filter((k) => (TUNE_KEYS as readonly string[]).includes(k))
	const exc = exclude.filter((k) => (TUNE_KEYS as readonly string[]).includes(k))
	const rows = await getPool()
	return rows
		.filter((r) => exc.every((k) => (r.fp[k] ?? 0) <= 3))
		.map((r) => {
			// Fit: how strongly the title carries every switched-on attribute (weakest counts most),
			// nudged by quality so a great film beats a merely matching one.
			const vals = inc.map((k) => r.fp[k] ?? 0)
			const fit = inc.length ? (Math.min(...vals) * 2 + vals.reduce((a, b) => a + b, 0) / vals.length) / 3 : 5
			const quality = (r.gw ?? 50) / 100
			return { r, fit, rank: fit * 10 + quality * 18 + Math.log10(r.votes) }
		})
		.sort((a, b) => b.rank - a.rank)
		.filter((x, i, all) => all.findIndex((o) => o.r.title === x.r.title) === i)
		.slice(0, 10)
		.map(({ r, fit }) => ({
			key: r.key,
			title: r.title,
			year: r.year,
			poster: r.poster,
			gw: r.gw,
			fit: Math.round(fit * 10),
			top: inc.length
				? [...inc].sort((a, b) => (r.fp[b] ?? 0) - (r.fp[a] ?? 0)).slice(0, 3)
				: Object.keys(r.fp).filter((k) => k !== "overall").sort((a, b) => r.fp[b] - r.fp[a]).slice(0, 3),
		}))
}

// ---------------------------------------------------------------------------------------------------------
// Round 3: service buttons, service-filtered tuning, taste seeds, and title details for in-TV navigation.

const SERVICE_BRANDS: { key: string; prefix: string; label: string; color: string }[] = [
	{ key: "netflix", prefix: "Netflix", label: "Netflix", color: "#e50914" },
	{ key: "prime", prefix: "Amazon Prime Video", label: "Prime Video", color: "#1f8ef1" },
	{ key: "disney", prefix: "Disney", label: "Disney+", color: "#113ccf" },
	{ key: "max", prefix: "Max", label: "Max", color: "#002be7" },
	{ key: "apple", prefix: "Apple TV", label: "Apple TV+", color: "#1d1d1f" },
	{ key: "paramount", prefix: "Paramount", label: "Paramount+", color: "#0064ff" },
	{ key: "hulu", prefix: "Hulu", label: "Hulu", color: "#1ce783" },
	{ key: "peacock", prefix: "Peacock", label: "Peacock", color: "#000000" },
]

export interface LRServiceButton {
	key: string
	label: string
	color: string
	logo: string | null
	ids: number[]
}

let serviceButtons: Promise<LRServiceButton[]> | null = null
export function getServiceButtons() {
	serviceButtons ??= (async () => {
		const { query } = await import("~/utils/crate")
		const rows = await query<{ tmdb_id: number; name: string; logo: string | null; ord: number | null }>(
			`SELECT DISTINCT tmdb_id, name, logo_path AS logo, order_default AS ord FROM streaming_service LIMIT 5000`,
		)
		return SERVICE_BRANDS.map((b) => {
			const hits = rows
				.filter((r) => (b.key === "max" ? /^(Max|HBO Max)\b/.test(r.name) : r.name.startsWith(b.prefix)))
				.sort((x, y) => (x.ord ?? 9999) - (y.ord ?? 9999))
			return { key: b.key, label: b.label, color: b.color, logo: hits[0]?.logo ?? null, ids: [...new Set(hits.map((h) => h.tmdb_id))] }
		}).filter((b) => b.ids.length)
	})().catch((e) => {
		serviceButtons = null
		throw e
	})
	return serviceButtons
}

// Which pool titles stream (subscription, free, or with ads) on which service, per country.
const availability = new Map<string, Promise<Map<string, Set<number>>>>()
function getAvailability(country: string) {
	let hit = availability.get(country)
	if (!hit) {
		hit = (async () => {
			const { query } = await import("~/utils/crate")
			const rows = await getPool()
			const out = new Map<string, Set<number>>()
			for (const type of ["movie", "show"] as const) {
				const ids = rows.filter((r) => r.key.startsWith(`${type}:`)).map((r) => Number(r.key.split(":")[1]))
				for (let i = 0; i < ids.length; i += 500) {
					const part = ids.slice(i, i + 500)
					const res = await query<{ id: number; sid: number }>(
						`SELECT media_tmdb_id AS id, streaming_service_id AS sid FROM streaming_availability
						 WHERE media_type = ? AND country_code = ? AND streaming_type IN ('flatrate','free','ads','flatrate_and_buy')
							AND media_tmdb_id IN (${part.map(() => "?").join(",")}) LIMIT 100000`,
						[type, country, ...part],
					)
					for (const r of res) {
						const k = `${type}:${r.id}`
						const set = out.get(k) ?? new Set<number>()
						set.add(r.sid)
						out.set(k, set)
					}
				}
			}
			return out
		})().catch((e) => {
			availability.delete(country)
			throw e
		})
		availability.set(country, hit)
	}
	return hit
}

export interface TuneOptions {
	include: string[]
	exclude: string[]
	country: string
	service?: string | null
	seeds?: string[]
}

// Round 3 tuning: attributes, an optional service, and optional taste seeds (titles someone loved).
export async function tune3(o: TuneOptions): Promise<LRTuned[]> {
	const keys = TUNE_KEYS as readonly string[]
	const inc = o.include.filter((k) => keys.includes(k))
	const exc = o.exclude.filter((k) => keys.includes(k))
	const rows = await getPool()
	let allowed: ((key: string) => boolean) | null = null
	if (o.service) {
		const [buttons, avail] = await Promise.all([getServiceButtons(), getAvailability(o.country)])
		const ids = new Set(buttons.find((b) => b.key === o.service)?.ids ?? [])
		allowed = (key) => [...(avail.get(key) ?? [])].some((sid) => ids.has(sid))
	}
	const seedRows = (o.seeds ?? []).map((k) => rows.find((r) => r.key === k)).filter(Boolean) as PoolRow[]
	const dims = Object.keys(seedRows[0]?.fp ?? {}).filter((k) => k !== "overall")
	const centroid: Record<string, number> = {}
	for (const d of dims) centroid[d] = seedRows.reduce((a, r) => a + (r.fp[d] ?? 0), 0) / (seedRows.length || 1)
	const cos = (fp: Record<string, number>) => {
		let dot = 0
		let na = 0
		let nb = 0
		for (const d of dims) {
			dot += (fp[d] ?? 0) * centroid[d]
			na += (fp[d] ?? 0) ** 2
			nb += centroid[d] ** 2
		}
		return na && nb ? dot / Math.sqrt(na * nb) : 0
	}
	const seedSet = new Set(o.seeds ?? [])
	return rows
		.filter((r) => !seedSet.has(r.key))
		.filter((r) => exc.every((k) => (r.fp[k] ?? 0) <= 3))
		.filter((r) => !allowed || allowed(r.key))
		.map((r) => {
			const vals = inc.map((k) => r.fp[k] ?? 0)
			const fit = inc.length ? (Math.min(...vals) * 2 + vals.reduce((a, b) => a + b, 0) / vals.length) / 3 : 5
			const taste = seedRows.length ? cos(r.fp) : 0
			const quality = (r.gw ?? 50) / 100
			const rank = (inc.length ? fit * 10 : 0) + (seedRows.length ? (taste - 0.8) * 400 : 0) + quality * 18 + Math.log10(r.votes)
			return { r, fit, taste, rank }
		})
		.sort((a, b) => b.rank - a.rank)
		.filter((x, i, all) => all.findIndex((y) => y.r.title === x.r.title) === i)
		.slice(0, 12)
		.map(({ r, fit, taste }) => ({
			key: r.key,
			title: r.title,
			year: r.year,
			poster: r.poster,
			gw: r.gw,
			fit: seedRows.length ? Math.round(taste * 100) : Math.round(fit * 10),
			top: (inc.length ? [...inc] : dims.length ? dims : Object.keys(r.fp).filter((k) => k !== "overall"))
				.sort((a, b) => (seedRows.length ? (r.fp[b] ?? 0) * centroid[b] - (r.fp[a] ?? 0) * centroid[a] : (r.fp[b] ?? 0) - (r.fp[a] ?? 0)))
				.slice(0, 3),
		}))
}

// Titles to rate on the TV: famous enough that most people have seen a few. Only ones in the pool (they need
// a fingerprint to seed taste).
const DECK = [
	"movie:155", "show:1396", "movie:27205", "movie:13", "show:1668", "movie:597", "movie:603", "show:66732",
	"movie:129", "movie:862", "show:2316", "movie:680", "movie:299534", "show:1399", "movie:313369", "movie:419430",
	"show:97546", "movie:278", "movie:346698", "movie:872585", "show:93405", "movie:11631", "movie:671", "movie:120",
	"show:136315", "movie:808", "movie:109445", "movie:578", "show:67070", "movie:546554", "movie:76341",
	"show:76331", "movie:545611", "movie:361743", "show:100088", "movie:346648", "movie:496243", "show:65494",
]
export async function getRateDeck(): Promise<LRTuned[]> {
	const rows = await getPool()
	const byKey = new Map(rows.map((r) => [r.key, r]))
	return DECK.map((k) => byKey.get(k))
		.filter((r): r is PoolRow => !!r)
		.map((r) => ({ key: r.key, title: r.title, year: r.year, poster: r.poster, gw: r.gw, fit: 0, top: [] }))
}

export async function getTitle(key: string, country: string): Promise<LRTitle | null> {
	const [type, id] = key.split(":")
	if (!/^\d+$/.test(id ?? "")) return null
	const media =
		type === "movie"
			? await getDetailsForMovie({ movieId: id, country, language: "en" })
			: type === "show"
				? await getDetailsForShow({ showId: id, country, language: "en" })
				: null
	return media ? toTitle(media) : null
}
