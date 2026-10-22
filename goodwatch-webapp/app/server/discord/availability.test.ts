import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateAvailability } from "../../utils/availability-evidence.ts"
const now = Date.UTC(2026, 9, 23)
const selection = {
	mediaType: "movie" as const,
	tmdbId: 42,
	country: "DE",
	serviceIds: [],
}
const evidence = (offers: object[] = []) => ({
	version: 1,
	media_tmdb_id: 42,
	media_type: "movie",
	country_code: "DE",
	unknown_contributions: false,
	checks: ["tmdb_web", "tmdb_api"].map((source) => ({
		source,
		snapshot_id: source,
		checked_at: now,
		last_attempt_at: now,
		state: "usable",
		reason: null,
		mapping_complete: true,
		offer_types: ["flatrate", "free", "ads", "rent", "buy"],
		offers: offers.map((offer) => ({ ...offer, snapshot_id: source })),
	})),
})
test("country-wide offers work without saved services; default behavior stays unchanged", () => {
	const raw = evidence([{ service_id: 42, offer_type: "flatrate" }])
	assert.equal(evaluateAvailability(raw, selection, now).state, "unknown")
	assert.equal(
		evaluateAvailability(raw, { ...selection, allServices: true }, now).state,
		"watchable",
	)
	assert.equal(
		evaluateAvailability(evidence(), { ...selection, allServices: true }, now)
			.state,
		"no_match",
	)
	assert.equal(
		evaluateAvailability(null, { ...selection, allServices: true }, now).state,
		"unknown",
	)
})
