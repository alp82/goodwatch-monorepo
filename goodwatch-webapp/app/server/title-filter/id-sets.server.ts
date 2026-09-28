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
import type { LegacyFilters } from "~/domain/filter-state"
import { fingerprintFilterConditions } from "~/server/discover.server"
import { query } from "~/utils/crate"
import { MEDIA_COLLECTION, recommend } from "~/utils/qdrant"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { MIN_VOTES } from "./order.server"

const KEEP_SECONDS = 30 * 60
// Bump when a set's meaning changes, so cached sets of the old meaning are never read.
const CACHE_PREFIX = "title-filter:v1"
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
 * Discover's eligible titles (as that SQL has it). Null when none of them applies.
 */
export function legacyTitles(
	legacy: LegacyFilters,
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
	const minYear = number(legacy.minYear)
	if (minYear !== null) {
		conditions.push("m.release_year >= ?")
		params.push(minYear)
	}
	const maxYear = number(legacy.maxYear)
	if (maxYear !== null) {
		conditions.push("m.release_year <= ?")
		params.push(maxYear)
	}
	if (!conditions.length) return null
	return cachedKeys("legacy", { conditions, params }, async () => {
		const found = await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const rows = await query<{ tmdb_id: number }>(
					`SELECT m.tmdb_id FROM ${type} m
					 WHERE m.goodwatch_overall_score_voting_count >= ${MIN_VOTES} AND m.poster_path IS NOT NULL
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
