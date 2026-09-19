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
