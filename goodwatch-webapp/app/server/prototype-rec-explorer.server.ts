// PROTOTYPE - throwaway. Read-only pool for /prototype/rec-explorer (#180).
// ~2,500 popular films and shows with their title analysis (74-attribute fingerprint), cached per country,
// plus the viewer's taste inputs: the signed-in member's ratings, Wishlist, watch history, skips, and
// saved services (?as=me, the default when signed in), or the Taste prototype's demo member (?as=demo).
// Only SELECTs. Nothing is written anywhere.
import { getUserSettings } from "~/server/user-settings.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { type Compact, type ExplorerData, type Who, encodeFp } from "~/ui/prototype-rec-explorer/model"
import { DEMO_RATINGS, DEMO_SERVICES, type Service, type Signal } from "~/ui/prototype-rec-taste/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { query } from "~/utils/crate"
import { duplicateProviderMapping, getShorterProviderLabel, ignoredProviders } from "~/utils/streaming-links"

const MOVIES = 1800
const SHOWS = 700
const MAX_EXTRA = 600
// Subscription services worth showing as logos, besides the person's own.
const COMMON_SERVICES = [8, 9, 337, 350, 1899, 531, 30, 283, 15, 384]

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	score: number | null
	fp: Record<string, number> | null
	sa: string[] | null
}

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score, fingerprint_scores AS fp, streaming_availabilities AS sa`

// Kept per country in memory: the full service id list per title, trimmed per request.
type Stored = Omit<Compact, "a"> & { all: number[] }

const toStored = (type: "movie" | "show", r: Row, country: string, extra = false): Stored => {
	const prefix = `${country}_`
	return {
		k: `${type}-${r.tmdb_id}`,
		t: r.title,
		y: r.release_year ?? 0,
		p: r.poster_path ?? "",
		b: r.backdrop_path ?? "",
		g: (r.genres ?? []).slice(0, 3),
		s: r.score == null ? 0 : Math.floor(r.score),
		f: encodeFp(VALID_FINGERPRINT_KEYS.map((k) => r.fp?.[k] ?? 0)),
		all: (r.sa ?? []).filter((x) => x.startsWith(prefix)).map((x) => Number(x.slice(prefix.length))),
		...(extra ? { x: 1 as const } : {}),
	}
}

const pools = new Map<string, Promise<Stored[]>>()
const loadPool = (country: string) => {
	let p = pools.get(country)
	if (!p) {
		p = Promise.all([
			query<Row>(
				`SELECT ${COLS} FROM movie WHERE poster_path IS NOT NULL AND fingerprint_scores IS NOT NULL
				 AND goodwatch_overall_score_voting_count >= 5000 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${MOVIES}`,
			),
			query<Row>(
				`SELECT ${COLS} FROM show WHERE poster_path IS NOT NULL AND fingerprint_scores IS NOT NULL
				 AND goodwatch_overall_score_voting_count >= 1500 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${SHOWS}`,
			),
		])
			.then(([movies, shows]) => [...movies.map((r) => toStored("movie", r, country)), ...shows.map((r) => toStored("show", r, country))])
			.catch((e) => {
				pools.delete(country)
				throw e
			})
		pools.set(country, p)
	}
	return p
}

const brand = (name: string) =>
	getShorterProviderLabel(name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")

type KeyRow = { tmdb_id: number; media_type: string }
const key = (r: KeyRow) => `${r.media_type === "tv" ? "show" : r.media_type}-${r.tmdb_id}`

async function memberSignals(userId: string) {
	const [scores, wish, watched, skipped] = await Promise.all([
		query<KeyRow & { score: number }>("SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ? LIMIT 5000", [userId]),
		query<KeyRow>("SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ? LIMIT 5000", [userId]),
		query<KeyRow>("SELECT tmdb_id, media_type FROM user_watch_state WHERE user_id = ? AND state <> 'not_started' LIMIT 5000", [userId]),
		query<KeyRow>("SELECT tmdb_id, media_type FROM user_skipped WHERE user_id = ? LIMIT 5000", [userId]),
	])
	// A later, stronger signal wins: rating over seen over Want to See over skip.
	const signals: Record<string, Signal> = {}
	for (const r of skipped) signals[key(r)] = { kind: "no" }
	for (const r of wish) signals[key(r)] = { kind: "want" }
	for (const r of watched) signals[key(r)] = { kind: "seen" }
	for (const r of scores) if (r.score) signals[key(r)] = { kind: "score", score: r.score }
	return signals
}

export async function getExplorer(request: Request): Promise<ExplorerData> {
	const url = new URL(request.url)
	const userId = await getUserIdFromRequest({ request }).catch(() => undefined)
	const asMe = !!userId && url.searchParams.get("as") !== "demo"
	const settings = (asMe ? await getUserSettings({ userId }).catch(() => ({})) : {}) as { country_default?: string; streaming_providers_default?: string }
	const country = url.searchParams.get("country") ?? (asMe ? settings.country_default : undefined) ?? "DE"
	const saved = String(settings.streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter(Boolean)
	const base = asMe && saved.length ? saved : DEMO_SERVICES
	const mine = new Set(base.flatMap((id) => (id in duplicateProviderMapping ? [id, ...duplicateProviderMapping[id]] : [id])))

	const [pool, signals] = await Promise.all([loadPool(country), asMe ? memberSignals(userId as string) : Promise.resolve({ ...DEMO_RATINGS })])

	// The person's own titles outside the popular pool still shape their taste, so load them too.
	const have = new Set(pool.map((r) => r.k))
	const missing = Object.keys(signals)
		.filter((k) => !have.has(k))
		.slice(0, MAX_EXTRA)
	const extras: Stored[] = []
	for (const type of ["movie", "show"] as const) {
		const ids = missing.filter((k) => k.startsWith(`${type}-`)).map((k) => Number(k.split("-")[1]))
		if (!ids.length) continue
		const rows = await query<Row>(`SELECT ${COLS} FROM ${type} WHERE fingerprint_scores IS NOT NULL AND poster_path IS NOT NULL AND tmdb_id IN (${ids.map(() => "?").join(",")})`, ids)
		for (const r of rows) extras.push(toStored(type, r, country, true))
	}

	// Logos: the person's services first, then the common subscription services in this country.
	const relevant = new Set([...mine, ...COMMON_SERVICES])
	for (const id of ignoredProviders) relevant.delete(id)
	const svcRows = await query<{ tmdb_id: number; name: string; logo_path: string }>(
		`SELECT tmdb_id, name, logo_path FROM streaming_service WHERE tmdb_id IN (${[...relevant].join(",")})`,
	)
	const seen = new Set<number>()
	const services: Service[] = svcRows
		.filter((s) => !seen.has(s.tmdb_id) && seen.add(s.tmdb_id))
		.map((s) => ({ id: s.tmdb_id, name: brand(s.name), logo: `https://www.themoviedb.org/t/p/original${s.logo_path}`, mine: mine.has(s.tmdb_id) }))
		.sort((a, b) => Number(b.mine) - Number(a.mine))

	const rows: Compact[] = [...pool, ...extras].map(({ all, ...r }) => ({ ...r, a: all.filter((id) => relevant.has(id)) }))
	const who: Who = { mode: asMe ? "me" : "demo", name: asMe ? "You" : "Demo member", country, demoServices: !(asMe && saved.length), signedIn: !!userId }
	return { rows, services, signals, keys: [...VALID_FINGERPRINT_KEYS], who }
}
