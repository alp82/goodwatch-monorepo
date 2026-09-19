import { z } from "zod"

export const AVAILABILITY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
export const INCLUDED_OFFER_TYPES = ["flatrate", "free", "ads"] as const
const offerType = z.enum(["flatrate", "free", "ads", "rent", "buy"])
const offer = z.object({
	service_id: z.number().int().positive(),
	offer_type: offerType,
	snapshot_id: z.string().min(1),
	stream_url: z.string().nullable().optional(),
	price_dollar: z.number().finite().nullable().optional(),
	quality: z.string().nullable().optional(),
	tmdb_link: z.string().nullable().optional(),
})
const check = z.object({
	source: z.enum(["tmdb_web", "tmdb_api"]),
	snapshot_id: z.string().min(1),
	checked_at: z.number().finite().int().nullable(),
	last_attempt_at: z.number().finite().nullable(),
	state: z.enum(["usable", "unknown"]),
	reason: z.string().nullable(),
	offer_types: z.array(offerType),
	mapping_complete: z.boolean(),
	offers: z.array(offer),
})
export const availabilityEvidenceSchema = z.object({
	version: z.literal(1),
	media_tmdb_id: z.number().int().positive(),
	media_type: z.enum(["movie", "show"]),
	country_code: z.string().regex(/^[A-Z]{2}$/),
	checks: z.array(check).length(2),
	unknown_contributions: z.boolean(),
}).superRefine((evidence, context) => {
	if (new Set(evidence.checks.map(item => item.source)).size !== 2 || evidence.checks.some(item => item.offers.some(offer => offer.snapshot_id !== item.snapshot_id || !item.offer_types.includes(offer.offer_type)))) {
		context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid source snapshot references" })
	}
})
export type AvailabilityEvidence = z.infer<typeof availabilityEvidenceSchema>
export type AvailabilityOffer = z.infer<typeof offer> & { source: "tmdb_web" | "tmdb_api"; checked_at: number }
export type AvailabilitySelection = {
	mediaType: "movie" | "show"
	tmdbId: number
	country: string
	serviceIds: number[]
	includePaid?: boolean
}
export type Watchability = {
	state: "watchable" | "no_match" | "unknown"
	reason: string
	evaluatedAt: number
	expiresAt: number | null
	offers: AvailabilityOffer[]
}

/** Pure and browser-safe: call again as time passes, including after cache hits. */
export function evaluateAvailability(raw: unknown, selection: AvailabilitySelection, now = Date.now()): Watchability {
	const result = (state: Watchability["state"], reason: string, offers: AvailabilityOffer[] = [], expiresAt: number | null = null): Watchability => ({ state, reason, offers, evaluatedAt: now, expiresAt })
	if (!selection.country || !selection.serviceIds.length) return result("unknown", "needs_selection")
	if (!Number.isFinite(now)) return result("unknown", "invalid_time")
	const parsed = availabilityEvidenceSchema.safeParse(raw)
	if (!parsed.success) return result("unknown", raw == null ? "missing_evidence" : "invalid_evidence")
	const evidence = parsed.data
	if (evidence.media_type !== selection.mediaType || evidence.media_tmdb_id !== selection.tmdbId || evidence.country_code !== selection.country.toUpperCase()) return result("unknown", "scope_mismatch")
	const types: readonly string[] = selection.includePaid ? [...INCLUDED_OFFER_TYPES, "rent", "buy"] : INCLUDED_OFFER_TYPES
	const current = evidence.checks.filter(item => item.state === "usable" && item.mapping_complete && item.checked_at !== null &&
		// Explicit epoch milliseconds. Never guess units or accept future checks.
		item.checked_at >= 946684800000 && item.checked_at <= now && now - item.checked_at < AVAILABILITY_MAX_AGE_MS)
	const expiresAt = current.length ? Math.min(...current.map(item => (item.checked_at as number) + AVAILABILITY_MAX_AGE_MS)) : null
	let conflict = false
	const offers: AvailabilityOffer[] = []
	for (const source of current) {
		for (const candidate of source.offers) {
			if (!types.includes(candidate.offer_type) || !selection.serviceIds.includes(candidate.service_id)) continue
			if (current.some(other => other.source !== source.source && other.offer_types.includes(candidate.offer_type) && !other.offers.some(item => item.service_id === candidate.service_id && item.offer_type === candidate.offer_type))) {
				conflict = true
				continue
			}
			offers.push({ ...candidate, source: source.source, checked_at: source.checked_at as number })
		}
	}
	if (offers.length) return result("watchable", "verified_offer", offers, expiresAt)
	if (conflict) return result("unknown", "source_conflict", [], expiresAt)
	if (current.length === 2 && current.every(item => types.every(type => item.offer_types.includes(type as z.infer<typeof offerType>))) && !evidence.unknown_contributions) return result("no_match", "verified_no_match", [], expiresAt)
	return result("unknown", "incomplete_or_expired_evidence", [], expiresAt)
}
