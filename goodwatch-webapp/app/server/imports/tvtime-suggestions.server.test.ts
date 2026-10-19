import assert from "node:assert/strict"
import { test } from "node:test"
import { suggestTvtimeMovie } from "./tvtime-suggestions.server.ts"
const evidence = {
	titles: ["Localized movie"],
	dates: ["2001-02-03"],
	countries: ["DE"],
}
const movie = {
	id: 42,
	title: "Another title",
	original_title: "Original",
	release_date: "2001-01-01",
	alternative_titles: {
		titles: [{ title: "Localized movie", iso_3166_1: "DE" }],
	},
	translations: { translations: [] },
	release_dates: {
		results: [
			{
				iso_3166_1: "DE",
				release_dates: [{ release_date: "2001-02-03T00:00:00Z", type: 3 }],
			},
		],
	},
}
test("strict movie suggestions record exact alternative title and same-country theatrical date proof", async () => {
	const result = await suggestTvtimeMovie(evidence, {
		get: async (path) =>
			path === "/search/movie"
				? { results: [{ id: 42 }], total_pages: 1 }
				: movie,
		catalog: async () => ({
			title: "Catalog movie",
			year: 2001,
			posterPath: null,
		}),
		now: () => 1000,
	})
	assert.equal(result.state, "suggested")
	assert.equal(result.proposal?.tmdbId, 42)
	assert.equal(result.proof?.rule, "tvtime_exact_title_release_date_v1")
	assert.equal(result.proof?.title.kind, "alternative")
	assert.deepEqual(result.proof?.date, {
		value: "2001-02-03",
		basis: "country",
		country: "DE",
		releaseType: 3,
	})
	assert.equal(result.proof?.candidateCount, 1)
	assert.equal(result.proof?.title.locale, "und")
	assert.equal(result.proof?.sourceCountry, "DE")
	assert.equal(result.proof?.verifiedCandidates, 1)
})
test("strict suggestions hold truncated searches, fuzzy titles, foreign dates, digital dates and conflicting evidence", async () => {
	const cases = [
		{
			e: evidence,
			m: movie,
			pages: 6,
			reason: "tvtime_suggestion_search_incomplete",
		},
		{
			e: evidence,
			m: {
				...movie,
				alternative_titles: {
					titles: [{ title: "Localized movie!", iso_3166_1: "DE" }],
				},
			},
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: { ...evidence, countries: ["FR"] },
			m: movie,
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: evidence,
			m: {
				...movie,
				release_dates: {
					results: [
						{
							iso_3166_1: "DE",
							release_dates: [{ release_date: "2001-02-03", type: 4 }],
						},
					],
				},
			},
			reason: "tvtime_suggestion_no_exact_match",
		},
		{
			e: { ...evidence, dates: ["2001-02-03", "2001-02-04"] },
			m: movie,
			reason: "conflicting_source_evidence",
		},
	]
	for (const c of cases) {
		const r = await suggestTvtimeMovie(c.e, {
			get: async (path) =>
				path === "/search/movie"
					? { results: [{ id: 42 }], total_pages: c.pages ?? 1 }
					: c.m,
			catalog: async () => ({
				title: "Catalog movie",
				year: 2001,
				posterPath: null,
			}),
		})
		assert.equal(r.state, "manual")
		assert.equal(r.reason, c.reason)
	}
})
test("a second exact TMDB candidate prevents a suggestion even when absent from the GoodWatch catalog", async () => {
	const r = await suggestTvtimeMovie(evidence, {
		get: async (path) =>
			path === "/search/movie"
				? { results: [{ id: 42 }, { id: 43 }], total_pages: 1 }
				: { ...movie, id: Number(path.split("/").at(-1)) },
		catalog: async (id) =>
			id === 42 ? { title: "Movie", year: 2001, posterPath: null } : null,
	})
	assert.equal(r.reason, "tvtime_suggestion_ambiguous")
})
test("a provider failure is held rather than producing a partially verified suggestion", async () => {
	const r = await suggestTvtimeMovie(evidence, {
		get: async () => {
			throw Error("offline")
		},
		catalog: async () => null,
	})
	assert.deepEqual(r, {
		state: "unavailable",
		reason: "tvtime_suggestion_unavailable",
	})
})
