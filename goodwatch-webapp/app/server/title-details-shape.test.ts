import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "./title-filter/test-alias.ts"
const { trimTitleDetails, toCastMembers } = await import(
	"./title-details-shape.ts"
)
const { COMMON_DETAILS_FIELDS, MOVIE_DETAILS_FIELDS, SHOW_DETAILS_FIELDS } =
	await import("./title-details-fields.ts")
const { featuredTropes, SOURCE_KEYWORDS } = await import(
	"../ui/details/titleQuestions.ts"
)

const rawFixture = () => ({
	details: {
		tmdb_id: 42,
		title: "",
		original_title: "Original",
		genres: null,
		tropes: Array.from({ length: 35 }, (_, i) => `Trope ${i}`),
		keywords: ["unrelated", ...SOURCE_KEYWORDS],
		adult: true,
		fingerprint_scores: null,
	},
	actors: [{ id: 99 }],
	availability_evidence: { discard: true },
	images: {
		backdrops: [{ file_path: "one", width: 400 }, { file_path: "two" }],
		posters: [],
	},
	videos: {
		clips: null,
		trailers: [
			{ key: "b", name: "B" },
			{ key: "a", name: "A" },
		],
		featurettes: [],
	},
	streaming_availabilities: [2, 1].map((id) => ({
		streaming_service_id: id,
		streaming_type: "flatrate" as const,
		stream_url: `${id}`,
		price_dollar: 9,
	})),
	streaming_services: [2, 1].map((id) => ({
		tmdb_id: id,
		name: `${id}`,
		logo: "x",
		order_default: id,
		extra: true,
	})),
	seasons: [{ season_number: 2, episode_count: 10, name: "second" }],
	movie_series: { id: 7, movie_ids: [1, 2], name: "series" },
})

test("trim caches only the permitted shape, keeping array order and null video lists", () => {
	for (const mediaType of ["movie", "show"] as const) {
		const raw = rawFixture()
		// The DB may return null for absent columns.
		const result = trimTitleDetails(
			raw as unknown as Parameters<typeof trimTitleDetails>[0],
			mediaType,
		)
		assert.deepEqual(
			Object.keys(result).sort(),
			[
				"mediaType",
				"fingerprint",
				"details",
				"cast",
				"cast_total",
				"crew",
				"credits",
				"images",
				"videos",
				"streaming_availabilities",
				"streaming_services",
				mediaType === "movie" ? "movie_series" : "seasons",
			].sort(),
		)
		assert.deepEqual(
			Object.keys(result.details).sort(),
			[
				...COMMON_DETAILS_FIELDS,
				...(mediaType === "movie" ? MOVIE_DETAILS_FIELDS : SHOW_DETAILS_FIELDS),
				"tropes_count",
			].sort(),
		)
		assert.equal(result.details.title, "Original")
		assert.deepEqual(result.details.genres, [])
		assert.deepEqual(result.details.keywords, SOURCE_KEYWORDS)
		assert.equal(result.details.tropes_count, 35)
		assert.deepEqual(
			result.details.tropes,
			featuredTropes({ details: raw.details } as unknown as typeof result),
		)
		assert.equal(raw.details.tropes.length, 35)
		assert.deepEqual(result.images, { backdrops: [{ file_path: "one" }] })
		assert.deepEqual(result.videos, {
			clips: null,
			trailers: [{ key: "b" }, { key: "a" }],
			featurettes: [],
		})
		assert.deepEqual(
			result.streaming_availabilities,
			[2, 1].map((id) => ({
				streaming_service_id: id,
				streaming_type: "flatrate",
				stream_url: `${id}`,
			})),
		)
		assert.deepEqual(
			result.streaming_services,
			[2, 1].map((id) => ({
				tmdb_id: id,
				name: `${id}`,
				logo: "x",
				order_default: id,
			})),
		)
		assert.deepEqual(result.cast, [])
		if (result.mediaType === "movie")
			assert.deepEqual(result.movie_series, { id: 7, movie_ids: [1, 2] })
		else
			assert.deepEqual(result.seasons, [
				{ season_number: 2, episode_count: 10 },
			])
	}
})
test("trim keeps the age ratings of the request's country and the fallback country, and the fingerprint parts that are read", () => {
	const raw = {
		details: {
			tmdb_id: 42,
			title: "Title",
			genres: ["Drama"],
			age_certifications: ["DE_16", "US_R", "FR_12", "USX_1"],
			fingerprint_scores: { romance: 5 },
			fingerprint_highlight_keys: ["romance"],
			essence_tags: ["Tag"],
			essence_text: "Long text nobody reads",
			suitability_adults: true,
			context_is_thought_provoking: true,
		},
	} as unknown as Parameters<typeof trimTitleDetails>[0]
	const german = trimTitleDetails(structuredClone(raw), "movie", "de")
	assert.deepEqual(german.details.age_certifications, ["DE_16", "US_R"])
	const unknown = trimTitleDetails(structuredClone(raw), "movie")
	assert.deepEqual(unknown.details.age_certifications, ["US_R"])
	assert.ok(german.fingerprint)
	assert.deepEqual(Object.keys(german.fingerprint).sort(), [
		"essenceTags",
		"highlightKeys",
		"pillars",
		"scores",
		"socialSuitability",
		"viewingContext",
	])
	assert.deepEqual(german.fingerprint.essenceTags, ["Tag"])
	for (const entry of [
		...german.fingerprint.socialSuitability,
		...german.fingerprint.viewingContext,
	])
		assert.deepEqual(Object.keys(entry), ["name"])
	assert.ok(german.fingerprint.socialSuitability.length > 0)
	assert.ok(german.fingerprint.viewingContext.length > 0)
})
test("the cached cast is the whole cast up to 24 people, and 23 when the title has more", () => {
	const rows = Array.from({ length: 24 }, (_, index) => ({
		id: index + 1,
		name: `Person ${index + 1}`,
		character: `Role ${index + 1}`,
		profile_path: "/photo.jpg",
		order_default: index,
	}))
	const raw = (cast_total: number) =>
		({
			details: { tmdb_id: 42, title: "Title" },
			cast_rows: rows,
			cast_total,
		}) as unknown as Parameters<typeof trimTitleDetails>[0]
	const whole = trimTitleDetails(raw(24), "show")
	assert.equal(whole.cast.length, 24)
	assert.equal(whole.cast_total, 24)
	const capped = trimTitleDetails(raw(2655), "show")
	assert.equal(capped.cast.length, 23)
	assert.equal(capped.cast.at(-1)?.id, 23)
	assert.equal(capped.cast_total, 2655)
})
test("cast folding uses first billing order, merges distinct characters, and requires photos", () => {
	const row = (
		id: number,
		order_default: number,
		character = "",
		profile_path: string | null = "photo",
	) => ({ id, order_default, character, profile_path, name: `${id}` })
	assert.deepEqual(
		toCastMembers([
			row(1, 5, "a"),
			row(2, 1, "b"),
			row(1, 0, "c"),
			row(1, 2, "a"),
			row(3, 2, "", null),
			row(4, 2, "", ""),
			row(5, 1),
		]),
		[
			{ id: 2, name: "2", characters: ["b"], profile_path: "photo" },
			{ id: 5, name: "5", characters: [], profile_path: "photo" },
			{ id: 1, name: "1", characters: ["a", "c"], profile_path: "photo" },
		],
	)
	assert.deepEqual(toCastMembers(null), [])
})

test("fingerprint inputs survive processing but do not leak into details", async () => {
	const { VALID_FINGERPRINT_KEYS, buildFingerprint } = await import(
		"./utils/fingerprint.ts"
	)
	const scores = Object.fromEntries(
		VALID_FINGERPRINT_KEYS.map((key) => [key, 5]),
	) as import("./utils/fingerprint.ts").CoreScores
	const dna: import("./utils/fingerprint.ts").DNAAnalysis = {
		scores,
		highlightKeys: ["crime"],
		genres: ["Drama"],
		essenceTags: ["test"],
		essenceText: "Essence",
		content_advisories: ["Violence"],
		context_is_background_friendly: false,
		context_is_binge_friendly: true,
		context_is_comfort_watch: false,
		context_is_drop_in_friendly: false,
		context_is_pure_escapism: false,
		context_is_thought_provoking: true,
		suitability_adults: true,
		suitability_date_night: false,
		suitability_family: false,
		suitability_friends: true,
		suitability_group_party: false,
		suitability_intergenerational: false,
		suitability_kids: false,
		suitability_partner: true,
		suitability_public_viewing_safe: true,
		suitability_solo_watch: true,
		suitability_teens: true,
	}
	const {
		scores: fingerprint_scores,
		highlightKeys: fingerprint_highlight_keys,
		essenceTags: essence_tags,
		essenceText: essence_text,
		...flags
	} = dna
	const result = trimTitleDetails(
		{
			details: {
				...flags,
				fingerprint_scores,
				fingerprint_highlight_keys,
				essence_tags,
				essence_text,
				tmdb_id: 42,
				title: "Title",
				tropes: [],
			},
			cast_lead_rows: [{ id: 1, name: "No photo" }],
			credits: {
				directors: [{ id: 2, name: "Director" }],
				composers: [],
				executive_producers: [],
			},
		},
		"movie",
	)
	const built = buildFingerprint(dna)
	assert.deepEqual(result.fingerprint, {
		scores: built.scores,
		highlightKeys: built.highlightKeys,
		essenceTags: built.essenceTags,
		socialSuitability: built.socialSuitability.map(
			({ name }: { name: string }) => ({ name }),
		),
		viewingContext: built.viewingContext.map(({ name }: { name: string }) => ({
			name,
		})),
		pillars: built.pillars,
	})
	assert.deepEqual(result.details.content_advisories, ["Violence"])
	assert.deepEqual(result.credits.actors, [{ id: 1, name: "No photo" }])
	assert.deepEqual(result.credits.directors, [{ id: 2, name: "Director" }])
	assert.equal("fingerprint_scores" in result.details, false)
	assert.equal("essence_text" in result.details, false)
	assert.equal("suitability_adults" in result.details, false)
})
