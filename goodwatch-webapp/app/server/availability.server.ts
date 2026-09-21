import { query } from "~/utils/crate"
import { cached } from "~/utils/cache"
import { availabilityEvidenceSchema, type AvailabilityEvidence } from "~/utils/availability-evidence"
import { canonicalTitleId } from "~/utils/title-identity"

type Scope = { mediaType: "movie" | "show"; tmdbId: number; country: string }

/** Raw evidence only: cache lifetime never extends eligibility. */
export async function getAvailabilityEvidence(scope: Scope, options?: { bypassCache: boolean }): Promise<AvailabilityEvidence | null> {
	const params = { ...scope, tmdbId: canonicalTitleId(scope.mediaType, scope.tmdbId), country: scope.country.toUpperCase() }
	if (!Number.isSafeInteger(params.tmdbId) || params.tmdbId <= 0 || !/^[A-Z]{2}$/.test(params.country)) return null
	const { payload } = options?.bypassCache ? await readEvidence(params) : await cached({ name: "availability-evidence-v1", params, ttlMinutes: 30, target: readEvidence })
	try {
		const parsed = availabilityEvidenceSchema.safeParse(payload ? JSON.parse(payload) : null)
		if (!parsed.success || parsed.data.media_tmdb_id !== params.tmdbId || parsed.data.media_type !== params.mediaType || parsed.data.country_code !== params.country) return null
		return parsed.data
	} catch { return null }
}

async function readEvidence({ mediaType, tmdbId, country }: Scope): Promise<{ payload: string | null }> {
	try {
		const rows = await query<{ payload: string }>(
			"SELECT payload FROM streaming_evidence WHERE media_tmdb_id = ? AND media_type = ? AND country_code = ? LIMIT 1",
			[tmdbId, mediaType, country],
		)
		return { payload: rows[0]?.payload ?? null }
	} catch (error) {
		// Additive rollout and corrupt rows degrade to unknown; transport/DB failures
		// remain visible in the query logger. Never fall back to title timestamps.
		console.warn("Availability evidence unavailable", error instanceof Error ? error.message : "query failure")
		return { payload: null }
	}
}

/** One query per media type for list checks; per-title lookups and caching are too slow for 100 titles. */
export async function getAvailabilityEvidenceBatch(scopes: Scope[]): Promise<Map<string, AvailabilityEvidence>> {
	const found = new Map<string, AvailabilityEvidence>()
	const groups = new Map<string, { mediaType: Scope["mediaType"]; country: string; ids: Set<number> }>()
	for (const scope of scopes) {
		const tmdbId = canonicalTitleId(scope.mediaType, scope.tmdbId), country = scope.country.toUpperCase()
		if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0 || !/^[A-Z]{2}$/.test(country)) continue
		const key = `${scope.mediaType}:${country}`
		if (!groups.has(key)) groups.set(key, { mediaType: scope.mediaType, country, ids: new Set() })
		groups.get(key)?.ids.add(tmdbId)
	}
	await Promise.all([...groups.values()].map(async ({ mediaType, country, ids }) => {
		try {
			const rows = await query<{ payload: string }>(
				`SELECT payload FROM streaming_evidence WHERE media_type = ? AND country_code = ? AND media_tmdb_id IN (${[...ids].map(() => "?").join(",")})`,
				[mediaType, country, ...ids],
			)
			for (const row of rows) {
				try {
					const parsed = availabilityEvidenceSchema.safeParse(JSON.parse(row.payload))
					if (!parsed.success || parsed.data.media_type !== mediaType || parsed.data.country_code !== country || !ids.has(parsed.data.media_tmdb_id)) continue
					found.set(`${mediaType}-${parsed.data.media_tmdb_id}`, parsed.data)
				} catch {}
			}
		} catch (error) {
			// Same degradation as the single lookup: missing evidence evaluates to unknown.
			console.warn("Availability evidence unavailable", error instanceof Error ? error.message : "query failure")
		}
	}))
	return found
}
