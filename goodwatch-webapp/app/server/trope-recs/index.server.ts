/**
 * GET /api/trope-recs?kind=all|movie|show&trope=<profile trope ID>
 * Session member only, always own data (no member-ID parameter).
 * Returns { pending, refreshing, kind, trope, tropes, titles }; cold builds return 202,
 * Retry-After: 2. Limits: 120 For you / 60 single-trope titles. Rank is one-based;
 * d is rounded definingness x100. No excerpt text is included.
 * GET /api/trope-recs/excerpts?trope=<ID>&keys=movie-1,show-2 loads <=16 examples.
 * GET /api/trope-recs/tropes returns only { pending, tropes } (no candidate index), for links and switches.
 * Descriptions use /u/:handle/tropes/descriptions with the member's own handle.
 * See docs/implementation/trope-recs.md for sources, caches and ranking.
 */
import { createHash } from "node:crypto"
import { DEFAULT_VISIBILITY } from "~/domain/profile"
import { readProfileCatalog } from "~/server/profile/catalog.server"
import {
	readCandidateCatalog,
	resolveCandidateReferences,
} from "./build-reader.server"
import { processRole } from "~/server/role.server"
import { loadProfileTropes } from "~/server/profile/tropes.server"
import { getUserData } from "~/server/userData.server"
import { cached } from "~/utils/cache"
import { titlePath } from "~/utils/helpers"
import type { MediaKey } from "~/types/user-data"
import { buildCandidateIndex } from "./candidates"
import { sharedIndex, resultCache, warmIndex } from "./cache"
import {
	type Kind,
	type Recommendation,
	memberTropes,
	memberExclusions,
	rankRecommendations,
} from "./ranking"

const index = sharedIndex(
	() =>
		buildCandidateIndex(
			readCandidateCatalog,
			resolveCandidateReferences,
			titlePath,
		),
	Date.now,
	() =>
		console.error(
			"Trope recommendations: candidate index build failed; retrying later",
		),
)
warmIndex(index, processRole())
const results = resultCache<Recommendation[]>()
const ownSight = { viewer: "owner", visibility: DEFAULT_VISIBILITY } as const
async function readWatchLogKeys({
	userId,
}: { userId: string }): Promise<{ keys: MediaKey[] }> {
	const rows = await readProfileCatalog<{
		media_type: "movie" | "show"
		tmdb_id: number
	}>(
		"SELECT media_type, tmdb_id FROM user_watch_log WHERE user_id = ? GROUP BY media_type, tmdb_id",
		[userId],
	)
	return { keys: rows.map((r): MediaKey => `${r.media_type}-${r.tmdb_id}`) }
}
/**
 * The member's top positive tropes alone: no candidate index, no member data. Pending while the profile snapshot is
 * built (the read starts that build). For the For you switch, the profile's links and the title page's trope names.
 */
export async function loadMemberTropes(userId: string) {
	const pool = await loadProfileTropes(userId, ownSight, userId, {
		wait: false,
		descriptions: false,
	})
	return pool
		? { pending: false, tropes: memberTropes(pool) }
		: { pending: true, tropes: [] }
}

/** Authenticated callers only. Reuses the profile snapshot loader, including its background refresh. */
export async function loadTropeRecommendations(
	userId: string,
	kind: Kind,
	trope?: string,
) {
	const shared = index()
	const { pool, data, log } = await memberInputs(userId)
	const tropes = pool ? memberTropes(pool) : []
	if (pool && trope !== undefined && !tropes.some((t) => t.id === trope))
		throw new RangeError("Trope is not in the member profile")
	const base = {
		kind,
		trope: trope ?? null,
		tropes,
		refreshing: shared.pending || !!pool?.refreshing,
	}
	if (!shared.current || !pool)
		return { ...base, pending: true, titles: [] as Recommendation[] }
	// Existing member-data resets apply before checking cached results. Include actual keys, not counts.
	const excluded = memberExclusions(data, log.keys)
	const signature = createHash("sha256")
		.update(
			JSON.stringify([
				userId,
				kind,
				trope,
				shared.current.version,
				pool.version,
				tropes,
				[...excluded].sort(),
				Object.keys(data.wishlist).sort(),
			]),
		)
		.digest("hex")
	let titles = results.get(signature)
	if (!titles) {
		titles = results.set(
			signature,
			rankRecommendations(
				shared.current.value,
				tropes,
				data,
				kind,
				trope,
				excluded,
			),
		)
	}
	return { ...base, pending: false, titles }
}

async function memberInputs(userId: string) {
	const [pool, data, log] = await Promise.all([
		loadProfileTropes(userId, ownSight, userId, {
			wait: false,
			descriptions: false,
		}),
		getUserData({ user_id: userId }),
		cached({
			name: "trope-recs-watch-log-v1",
			ttlMinutes: 0.25,
			staleMinutes: 0,
			target: readWatchLogKeys,
			params: { userId },
		}),
	])
	return { pool, data, log }
}

/** Authorization uses membership, never the truncated ranked recommendation lists. */
export async function recommendationExcerptContext(
	userId: string,
	trope: string,
) {
	const shared = index()
	const { pool, data, log } = await memberInputs(userId)
	if (pool && !memberTropes(pool).some((t) => t.id === trope))
		throw new RangeError("Trope is not in the member profile")
	return {
		pending: !shared.current || !pool,
		index: shared.current?.value,
		excluded: memberExclusions(data, log.keys),
	}
}
