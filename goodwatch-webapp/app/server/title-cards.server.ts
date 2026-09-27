// What a title card shows, for one page of titles: display fields from Crate plus what is personal to the viewer
// (taste match and its reasons, the services that carry the title in the viewer's country, Seen, and Want to See).
//
// Display fields are read for at most MAX_KEYS titles in one Crate statement by primary key and cached per title in
// Redis for 6 hours, so a page usually needs no Crate read at all. Everything personal is computed in memory on every
// call and never cached.
//
// TITLE_CARDS_REDIS_URL points the cache at a single Redis (for development); without it, it uses the webapp's Redis
// cluster. Without a Redis connection, every call reads Crate.
import Redis from "ioredis"
import { servicesFor } from "~/server/availability-index.server"
import type { FingerprintKey, Taste } from "~/server/taste/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { MediaType } from "~/types/user-data"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

export const MAX_KEYS = 60
const REASONS = 2
const CACHE_TTL_SECONDS = 6 * 60 * 60
const SERVICE_NAMES_TTL_MS = 24 * 60 * 60 * 1000
// Bump when the cached fields change.
const cacheKey = (key: TitleKey) => `title-card:v1:${key}`

/** The fields a card displays, the same for everyone. */
export interface TitleDisplay {
	key: TitleKey
	tmdb_id: number
	media_type: MediaType
	title: string
	poster_path: string | null
	backdrop_path: string | null
	release_year: number | null
	/** Minutes; for shows, the usual episode length. */
	runtime: number | null
	tagline: string | null
	goodwatch_overall_score_normalized_percent: number | null
	goodwatch_overall_score_voting_count: number | null
}

export interface CardService {
	id: number
	name: string
	logo_path: string
}

export interface TitleCard extends TitleDisplay {
	/** 50 to 99; null without a fingerprint for the title or without taste. */
	match: number | null
	/** The fingerprint attributes that most drive the match, strongest first; empty without a match. */
	reasons: FingerprintKey[]
	/** Subscription services that carry the title in the viewer's country, the viewer's own first; null while that
	 * country's availability is still loading. */
	services: CardService[] | null
	/** Scored or watched. */
	seen: boolean
	wantToSee: boolean
}

/**
 * The cards for up to MAX_KEYS titles, in the order of `keys`. Titles that don't exist in the catalog are left out.
 */
export async function getTitleCards(
	keys: TitleKey[],
	viewer: ViewerContext,
	taste: Taste,
): Promise<TitleCard[]> {
	if (keys.length > MAX_KEYS)
		throw new Error(`getTitleCards takes at most ${MAX_KEYS} titles`)
	const unique = [...new Set(keys)]
	const [displays, providers] = await Promise.all([
		readDisplays(unique),
		serviceNames(),
	])
	const found = unique.filter((key) => displays.has(key))
	const matches = taste.match(found)
	const services = servicesFor(viewer.country, found)
	const own = new Set(viewer.services)

	const cards = new Map<TitleKey, TitleCard>()
	found.forEach((key, i) => {
		const display = displays.get(key) as TitleDisplay
		const match = matches[i]
		cards.set(key, {
			...display,
			match,
			reasons: match === null ? [] : taste.reasons(key, REASONS),
			services: cardServices(services[i], own, providers),
			seen: viewer.seen.has(key),
			wantToSee: viewer.wishlist.has(key),
		})
	})
	return keys.flatMap((key) => cards.get(key) ?? [])
}

function cardServices(
	ids: number[] | null,
	own: ReadonlySet<number>,
	providers: ReadonlyMap<number, CardService>,
): CardService[] | null {
	if (!ids) return null
	return ids
		.flatMap((id) => providers.get(id) ?? [])
		.sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)))
}

// Names and logos of the services, the same in every country: about a thousand rows, kept in memory for a day. A
// failed read keeps the previous names (or none) and retries on the next call.
let names: { byId: Map<number, CardService>; until: number } | null = null
let loadingNames: Promise<Map<number, CardService>> | null = null

async function serviceNames(): Promise<Map<number, CardService>> {
	if (names && names.until > Date.now()) return names.byId
	loadingNames ??= query<CardService>(
		`SELECT tmdb_id AS id, name, logo_path FROM streaming_service
		  WHERE tmdb_id NOT IN (${ignoredProviders.join(",")})`,
	)
		.then((rows) => {
			const byId = new Map(rows.map((row) => [row.id, row]))
			names = { byId, until: Date.now() + SERVICE_NAMES_TTL_MS }
			return byId
		})
		.catch((error) => {
			console.error("Title cards: no streaming service names", error)
			return names?.byId ?? new Map<number, CardService>()
		})
		.finally(() => {
			loadingNames = null
		})
	return loadingNames
}

// ---------------------------------------------------------------- display fields

/**
 * Display fields alone, for up to MAX_KEYS titles, from the same cache and Crate read as the cards: for callers that
 * need a picture or a name but nothing personal (Watch next's mood pictures). Titles Crate lacks are left out.
 */
export async function getDisplayFields(
	keys: TitleKey[],
): Promise<Map<TitleKey, TitleDisplay>> {
	if (keys.length > MAX_KEYS)
		throw new Error(`getDisplayFields takes at most ${MAX_KEYS} titles`)
	return readDisplays([...new Set(keys)])
}

async function readDisplays(
	keys: TitleKey[],
): Promise<Map<TitleKey, TitleDisplay>> {
	const displays = new Map<TitleKey, TitleDisplay>()
	if (!keys.length) return displays
	const redis = await cardsRedis()
	if (redis) {
		const cached = await Promise.all(
			keys.map((key) => redis.get(cacheKey(key)).catch(() => null)),
		)
		cached.forEach((raw, i) => {
			if (raw) displays.set(keys[i], JSON.parse(raw) as TitleDisplay)
		})
	}
	const missing = keys.filter((key) => !displays.has(key))
	if (!missing.length) return displays

	const read = await readFromCrate(missing)
	for (const display of read) displays.set(display.key, display)
	if (redis)
		for (const display of read)
			redis
				.set(
					cacheKey(display.key),
					JSON.stringify(display),
					"EX",
					CACHE_TTL_SECONDS,
				)
				.catch((error) =>
					console.error("Title cards: cache write failed", error),
				)
	return displays
}

type DisplayRow = Omit<TitleDisplay, "key">

async function readFromCrate(keys: TitleKey[]): Promise<TitleDisplay[]> {
	const movies: number[] = []
	const shows: number[] = []
	for (const key of keys) {
		const { mediaType, tmdbId } = parseTitleKey(key)
		;(mediaType === "movie" ? movies : shows).push(tmdbId)
	}
	// One statement by primary key. Crate arrays start at 1, so episode_runtime[1] is a show's first episode length.
	const rows = await query<DisplayRow>(
		`SELECT 'movie' AS media_type, tmdb_id, title, poster_path, backdrop_path, release_year, runtime, tagline,
		        goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count
		   FROM movie WHERE tmdb_id = ANY(?)
		 UNION ALL
		 SELECT 'show' AS media_type, tmdb_id, title, poster_path, backdrop_path, release_year,
		        episode_runtime[1] AS runtime, tagline,
		        goodwatch_overall_score_normalized_percent, goodwatch_overall_score_voting_count
		   FROM show WHERE tmdb_id = ANY(?)`,
		// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
		[movies as never, shows as never],
	)
	return rows.map((row) => ({
		key: titleKey(row.media_type, row.tmdb_id),
		...row,
	}))
}

interface CardsRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		expiry: "EX",
		seconds: number,
	): Promise<unknown>
}

let singleRedis: Redis | undefined

async function cardsRedis(): Promise<CardsRedis | null> {
	const url = process.env.TITLE_CARDS_REDIS_URL
	if (url) {
		singleRedis ??= new Redis(url, { maxRetriesPerRequest: 1 })
		return singleRedis
	}
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}
