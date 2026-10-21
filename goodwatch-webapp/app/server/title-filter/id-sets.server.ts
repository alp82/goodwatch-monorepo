// The filters that aren't facts in the title snapshot resolve to sets of title keys before filtering: Similar to (the
// similar-titles recommend path), cast and crew (a Crate credit read), the legacy Discover filters (today's Discover
// SQL conditions), and On my services while the country's availability index loads (the titles'
// `streaming_availabilities` column, as Discover filters today). Each set is cached in Redis for 30 minutes per
// parameter set.
//
// TITLE_FILTER_REDIS_URL points the cache at a single Redis (for development); without it, it uses the webapp's Redis
// cluster, and without a connected cluster nothing is cached.
import { createHash } from "node:crypto"
import Redis from "ioredis"
import type { FilterState, LegacyFilters } from "~/domain/filter-state"
import { fingerprintFilterConditions } from "~/server/discover.server"
import { query } from "~/utils/crate"
import { MEDIA_COLLECTION, recommend } from "~/utils/qdrant"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { MIN_VOTES } from "./order.server"

import {
	rangeScoreConditions,
	type RangeScoreFilter,
} from "./range-score-conditions.server"

const KEEP_SECONDS = 30 * 60
// Bump when a set's meaning changes, so cached sets of the old meaning are never read.
const CACHE_PREFIX = "title-filter:v2"
const SIMILAR_LIMIT = 5000
const CREDITS_LIMIT = 5000
const LEGACY_LIMIT = 100_000

interface CacheRedis {
	get(key: string): Promise<string | null>
	set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>
}

let singleRedis: Redis | undefined
async function cacheRedis(): Promise<CacheRedis | null> {
	const url = process.env.TITLE_FILTER_REDIS_URL
	if (url) {
		singleRedis ??= new Redis(url, { maxRetriesPerRequest: 1 })
		return singleRedis
	}
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}

// Concurrent requests for one set share one load.
const loading = new Map<string, Promise<TitleKey[]>>()

async function cachedKeys(
	kind: string,
	params: unknown,
	load: () => Promise<TitleKey[]>,
): Promise<Set<TitleKey>> {
	const id = createHash("sha256")
		.update(JSON.stringify(params))
		.digest("base64url")
	const key = `${CACHE_PREFIX}:${kind}:${id}`
	let pending = loading.get(key)
	if (!pending) {
		pending = (async () => {
			const redis = await cacheRedis()
			try {
				const hit = await redis?.get(key)
				if (hit) return JSON.parse(hit) as TitleKey[]
			} catch (error) {
				console.error(`Title filter: reading ${key} failed`, error)
			}
			const keys = await load()
			redis
				?.set(key, JSON.stringify(keys), "EX", KEEP_SECONDS)
				.catch((error) =>
					console.error(`Title filter: caching ${key} failed`, error),
				)
			return keys
		})().finally(() => loading.delete(key))
		loading.set(key, pending)
	}
	return new Set(await pending)
}

/** Titles similar to one title: the similar-titles recommend path over Discover's eligible titles. */
export function similarTitles(seed: TitleKey): Promise<Set<TitleKey>> {
	return cachedKeys("similar", seed, async () => {
		const results = await recommend({
			collectionName: MEDIA_COLLECTION,
			positive: [seed],
			using: "fingerprint_v1",
			filter: {
				must: [
					{
						key: "goodwatch_overall_score_voting_count",
						range: { gte: MIN_VOTES },
					},
				],
				must_not: [{ is_empty: { key: "poster_path" } }],
			},
			limit: SIMILAR_LIMIT,
			withPayload: false,
			hnswEf: 128,
			exact: false,
		})
		return results
			.map((result) => Number(result.id))
			.filter((id) => Number.isFinite(id))
	})
}

/** All listed production countries count, including each country in a co-production. No language fallback. */
export function productionCountryTitles(
	country: string,
): Promise<Set<TitleKey>> {
	return cachedKeys("production-country", country, async () => {
		const found = await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const limit = 1_000_000
				const rows = await query<{ tmdb_id: number }>(
					`SELECT tmdb_id FROM ${type} WHERE ? = ANY(production_country_codes) LIMIT ${limit}`,
					[country],
				)
				if (rows.length >= limit)
					throw new Error("Production country title set exceeds its read limit")
				return rows.map((row) => titleKey(type, Number(row.tmdb_id)))
			}),
		)
		return found.flat()
	})
}

/** Titles one person appears in or worked on (TMDB person id). */
export function personTitles(personId: number): Promise<Set<TitleKey>> {
	return cachedKeys("person", personId, async () => {
		const [cast, crew] = await Promise.all(
			["person_appeared_in", "person_worked_on"].map((table) =>
				query<{ media_type: string; media_tmdb_id: number }>(
					`SELECT media_type, media_tmdb_id FROM ${table} WHERE person_tmdb_id = ? LIMIT ${CREDITS_LIMIT}`,
					[personId],
				),
			),
		)
		return [
			...new Set(
				[...cast, ...crew].map((row) =>
					titleKey(
						row.media_type === "show" ? "show" : "movie",
						Number(row.media_tmdb_id),
					),
				),
			),
		]
	})
}

/**
 * Titles that pass the legacy Discover filters, through the conditions today's Discover SQL builds for them, over
 * Discover's eligible titles, or a supplied search/Wishlist universe without the browse eligibility floor.
 * Null when none of them applies.
 */
export function legacyTitles(
	legacy: LegacyFilters,
	universe?: readonly TitleKey[],
): Promise<Set<TitleKey>> | null {
	const fingerprint = fingerprintFilterConditions(legacy)
	const conditions = [...fingerprint.conditions]
	const params = [...fingerprint.params]
	const number = (value: string | undefined) => {
		const n = Number(value)
		return value && Number.isFinite(n) ? n : null
	}
	const maxScore = number(legacy.maxScore)
	if (maxScore !== null) {
		conditions.push("m.goodwatch_overall_score_normalized_percent <= ?")
		params.push(maxScore)
	}
	if (!conditions.length) return null
	return cachedKeys("legacy", { conditions, params, universe }, async () => {
		const found = await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const ids = universe?.flatMap((key) => {
					const parsed = parseTitleKey(key)
					return parsed.mediaType === type &&
						Number.isSafeInteger(parsed.tmdbId) &&
						parsed.tmdbId > 0
						? [parsed.tmdbId]
						: []
				})
				if (ids && !ids.length) return []
				// Parsed positive integer IDs are safe SQL literals; filter values stay bound.
				const eligible = ids
					? `m.tmdb_id IN (${ids.join(",")})`
					: `m.goodwatch_overall_score_voting_count >= ${MIN_VOTES} AND m.poster_path IS NOT NULL`
				const rows = await query<{ tmdb_id: number }>(
					`SELECT m.tmdb_id FROM ${type} m
					 WHERE ${eligible}
					 AND ${conditions.join(" AND ")}
					 LIMIT ${LEGACY_LIMIT}`,
					params,
				)
				return rows.map((row) => titleKey(type, Number(row.tmdb_id)))
			}),
		)
		return found.flat()
	})
}

/**
 * Titles on any of the services in the country by the titles' `streaming_availabilities` column, for On my services
 * while the country's availability index loads. `services` are provider ids, duplicates included.
 */
export function titlesOnServicesByColumn(
	country: string,
	services: number[],
): Promise<Set<TitleKey>> {
	const patterns = [...new Set(services)]
		.sort((a, b) => a - b)
		.map((id) => `${country}_${id}`)
	if (!patterns.length) return Promise.resolve(new Set())
	return cachedKeys("services", patterns, async () => {
		const found = await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const rows = await query<{ tmdb_id: number }>(
					`SELECT tmdb_id FROM ${type}
					 WHERE ${patterns.map(() => "? = ANY(streaming_availabilities)").join(" OR ")}
					 LIMIT ${LEGACY_LIMIT}`,
					patterns,
				)
				return rows.map((row) => titleKey(type, Number(row.tmdb_id)))
			}),
		)
		return found.flat()
	})
}

/** Independent cached sets, with a hard bound that fails rather than silently dropping matching titles. */
export function rangeScoreTitles(
	state: FilterState,
	name: RangeScoreFilter,
	universe?: readonly TitleKey[],
): Promise<Set<TitleKey>> | null {
	if (!rangeScoreConditions(state, name, "movie").conditions.length) return null
	return cachedKeys(
		name,
		{ ...rangeScoreConditions(state, name, "movie"), universe },
		async () => {
			const found = await Promise.all(
				(["movie", "show"] as const).map(async (type) => {
					const { conditions, params } = rangeScoreConditions(state, name, type)
					const ids = universe?.flatMap((key) => {
						const parsed = parseTitleKey(key)
						return parsed.mediaType === type &&
							Number.isSafeInteger(parsed.tmdbId) &&
							parsed.tmdbId > 0
							? [parsed.tmdbId]
							: []
					})
					if (ids && !ids.length) return []
					const eligible = ids
						? `tmdb_id IN (${ids.join(",")})`
						: `goodwatch_overall_score_voting_count >= ${MIN_VOTES} AND poster_path IS NOT NULL`
					const limit = 1_000_000
					const rows = await query<{ tmdb_id: number }>(
						`SELECT tmdb_id FROM ${type} WHERE ${eligible} AND ${conditions.join(" AND ")} LIMIT ${limit}`,
						params,
					)
					if (rows.length >= limit)
						throw new Error(`${name} title set exceeds its read limit`)
					return rows.map((row) => titleKey(type, Number(row.tmdb_id)))
				}),
			)
			return found.flat()
		},
	)
}

/** Same offer types as the availability index, only used while that country's index loads. */
export function titlesOnAnyService(country: string): Promise<Set<TitleKey>> {
	return cachedKeys("any-service", country, async () => {
		const limit = 1_000_000
		const rows = await query<{ media_type: string; media_tmdb_id: number }>(
			`SELECT media_type, media_tmdb_id FROM streaming_availability
			 WHERE country_code = ? AND streaming_type IN ('flatrate', 'free', 'ads')
			 GROUP BY media_type, media_tmdb_id LIMIT ${limit}`,
			[country],
		)
		if (rows.length >= limit)
			throw new Error("Any service title set exceeds its read limit")
		return rows.map((row) =>
			titleKey(
				row.media_type === "show" ? "show" : "movie",
				Number(row.media_tmdb_id),
			),
		)
	})
}
