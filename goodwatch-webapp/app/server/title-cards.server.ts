// Title cards: what a poster card shows for one page of titles. Display fields (title, poster, backdrop, year,
// runtime, GoodWatch score, tagline) come from Crate by primary key, at most one page at a time, and are cached per
// title in Redis for 6 hours. Everything personal is added in memory: taste match and reasons, the subscription
// services that carry the title in the viewer's country, and the Seen and Want to See flags.

import { servicesFor } from "~/server/availability-index.server"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import type { FingerprintKey, Taste } from "~/server/taste/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"

export interface TitleCardService {
	id: number
	name: string
	logoPath: string
	/** One of the viewer's services. */
	mine: boolean
}

export interface TitleCard {
	key: TitleKey
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	year: number | null
	/** Minutes: a film's runtime, a show's episode runtime. */
	runtime: number | null
	posterPath: string | null
	backdropPath: string | null
	tagline: string | null
	/** GoodWatch score, 0 to 100. */
	score: number | null
	/** Taste match, 50 to 99; null without a fingerprint or without taste. */
	match: number | null
	reasons: FingerprintKey[]
	/** Subscription services carrying the title in the viewer's country, the viewer's first; null while it loads. */
	services: TitleCardService[] | null
	seen: boolean
	wantToSee: boolean
}

type DisplayFields = Pick<
	TitleCard,
	| "title"
	| "year"
	| "runtime"
	| "posterPath"
	| "backdropPath"
	| "tagline"
	| "score"
>

// At most one page of titles per call, so one statement per media type stays a small primary-key read.
export const MAX_CARDS = 60
const CACHE_SECONDS = 6 * 60 * 60
// Bump when DisplayFields changes.
const cacheKey = (key: TitleKey) => `title-card:v1:${key}`
const PROVIDERS_KEEP_MS = 6 * 60 * 60 * 1000

interface Row {
	tmdb_id: number
	title: string | null
	release_year: number | null
	runtime: number | null
	poster_path: string | null
	backdrop_path: string | null
	tagline: string | null
	score: number | null
}

async function readCached(
	keys: TitleKey[],
): Promise<Map<TitleKey, DisplayFields>> {
	const found = new Map<TitleKey, DisplayFields>()
	const { getRedisCluster } = await import("~/utils/cache")
	const redis = getRedisCluster()
	if (!redis || !keys.length) return found
	try {
		// One GET per key: the keys live in different cluster slots.
		const values = await Promise.all(
			keys.map((key) => redis.get(cacheKey(key))),
		)
		values.forEach((value, i) => {
			if (value) found.set(keys[i], JSON.parse(value) as DisplayFields)
		})
	} catch (error) {
		console.error("Title cards: cache read failed, reading Crate", error)
	}
	return found
}

async function writeCached(fields: Map<TitleKey, DisplayFields>) {
	const { getRedisCluster } = await import("~/utils/cache")
	const redis = getRedisCluster()
	if (!redis || !fields.size) return
	await Promise.all(
		[...fields].map(([key, value]) =>
			redis.set(cacheKey(key), JSON.stringify(value), "EX", CACHE_SECONDS),
		),
	).catch((error) => console.error("Title cards: cache write failed", error))
}

async function readCrate(
	keys: TitleKey[],
): Promise<Map<TitleKey, DisplayFields>> {
	const byType = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const { mediaType, tmdbId } = parseTitleKey(key)
		byType[mediaType].push(tmdbId)
	}
	const found = new Map<TitleKey, DisplayFields>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = byType[type]
			if (!ids.length) return
			const rows = await query<Row>(
				`SELECT tmdb_id, title, release_year,
				 ${type === "movie" ? "runtime" : "episode_runtime[1]"} AS runtime,
				 poster_path, backdrop_path, tagline,
				 goodwatch_overall_score_normalized_percent AS score
				 FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})
				 LIMIT ${ids.length}`,
				ids,
			)
			for (const row of rows) {
				found.set(titleKey(type, Number(row.tmdb_id)), {
					title: row.title ?? "",
					year: row.release_year ?? null,
					runtime: row.runtime ?? null,
					posterPath: row.poster_path ?? null,
					backdropPath: row.backdrop_path ?? null,
					tagline: row.tagline || null,
					score: row.score ?? null,
				})
			}
		}),
	)
	return found
}

/** Display fields for up to MAX_CARDS titles, from the Redis cache and then Crate. Titles Crate lacks are left out. */
export async function getDisplayFields(
	keys: TitleKey[],
): Promise<Map<TitleKey, DisplayFields>> {
	const unique = [...new Set(keys)].slice(0, MAX_CARDS)
	const found = await readCached(unique)
	const missing = unique.filter((key) => !found.has(key))
	if (missing.length) {
		const read = await readCrate(missing)
		for (const [key, value] of read) found.set(key, value)
		void writeCached(read)
	}
	return found
}

let providers: {
	at: number
	byId: Promise<Map<number, { name: string; logoPath: string }>>
} | null = null

function providerNames() {
	if (!providers || Date.now() - providers.at > PROVIDERS_KEEP_MS) {
		const byId = getStreamingProviders({ country: "US" }).then(
			(list) =>
				new Map(
					list.map((p) => [p.id, { name: p.name, logoPath: p.logo_path }]),
				),
		)
		byId.catch(() => {
			providers = null
		})
		providers = { at: Date.now(), byId }
	}
	return providers.byId
}

/**
 * Cards for the keys, in the keys' order: display fields from Crate (cached), taste match and reasons, services in
 * the viewer's country, and the viewer's flags. At most MAX_CARDS; titles without display fields are left out.
 */
export async function getTitleCards(
	keys: TitleKey[],
	ctx: ViewerContext,
	taste: Taste,
): Promise<TitleCard[]> {
	const wanted = [...new Set(keys)].slice(0, MAX_CARDS)
	if (!wanted.length) return []
	const [fields, names] = await Promise.all([
		getDisplayFields(wanted),
		providerNames().catch(
			() => new Map<number, { name: string; logoPath: string }>(),
		),
	])
	const present = wanted.filter((key) => fields.has(key))
	const matches = taste.match(present)
	const services = servicesFor(ctx.country, present)
	const mine = new Set(ctx.services)
	return present.map((key, i) => {
		const { mediaType, tmdbId } = parseTitleKey(key)
		const carried = services[i]
		return {
			key,
			mediaType,
			tmdbId,
			...(fields.get(key) as DisplayFields),
			match: matches[i],
			reasons: matches[i] === null ? [] : taste.reasons(key),
			services: carried
				? carried
						.flatMap((id) => {
							const named = names.get(id)
							return named ? [{ id, ...named, mine: mine.has(id) }] : []
						})
						.sort((a, b) => Number(b.mine) - Number(a.mine))
				: null,
			seen: ctx.seen.has(key),
			wantToSee: ctx.wishlist.has(key),
		}
	})
}
