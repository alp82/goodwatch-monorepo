import "react"
import test from "node:test"
import assert from "node:assert/strict"
import "./title-filter/test-alias.ts"
const { presentTitleTemplates, formatMediaTemplate, mediaTemplateResources } =
	await import("./media-templates.server.ts")
const { titleQuestions } = await import("../ui/details/titleQuestions.ts")
const { pillarLine, pillarBrief, pillarSentence } = await import(
	"../ui/fingerprint/fingerprintText.ts"
)
const fixture = () =>
	({
		mediaType: "show",
		details: {
			tmdb_id: 1396,
			title: "Breaking Bad",
			genres: [],
			keywords: [],
			tropes: [],
			age_certifications: [],
			number_of_seasons: 5,
			number_of_episodes: 62,
			original_language_code: "en",
			streaming_country_codes: ["US", "DE"],
			goodwatch_overall_score_normalized_percent: 90,
		},
		fingerprint: null,
		streaming_availabilities: [],
		streaming_services: [],
	} as unknown as Parameters<typeof presentTitleTemplates>[0])

test("localized FAQ facts preserve episode/season counts and country, source remains unchanged", () => {
	const source = fixture(),
		snapshot = JSON.stringify(source)
	const projected = presentTitleTemplates(source, "DE", "de")
	const faq = titleQuestions(projected, "DE").find((q) => q.id === "length")
	assert.equal(faq?.a, "5 Staffeln; 62 Folgen.")
	assert.equal(faq?.language, "de")
	assert.equal(projected.templateProse?.country, "DE")
	assert.equal(JSON.stringify(source), snapshot)
	assert.equal(
		titleQuestions(projected, "US").find((q) => q.id === "length")?.language,
		undefined,
	)
})
test("canonical English policy and unsupported locale retain original response", () => {
	const source = fixture()
	assert.equal(presentTitleTemplates(source, "US", "en"), source)
	assert.equal(presentTitleTemplates(source, "US", "invalid"), source)
})
test("all locales interpolate only named placeholders; missing values are rejected", () => {
	for (const locale of Object.keys(mediaTemplateResources.locales)) {
		assert.ok(
			formatMediaTemplate(locale, "seasons", {
				seasons: 5,
				episodes: 62,
			}).includes("62"),
		)
		assert.throws(
			() => formatMediaTemplate(locale, "seasons", { seasons: 5 }),
			/placeholder/,
		)
	}
})
test("fingerprint consumers use projected content while canonical getters retain English", () => {
	const prose = {
		language: "de",
		revision: "v1",
		sourceRevision: "hash",
		country: "DE",
		questions: [],
		fingerprint: {
			line: "Hohe Energie",
			skip: [],
			briefs: { Energy: { verdict: "Hoch", note: "", drivers: [] } },
			sentences: { Energy: "Energie: Hoch (3/4)." },
		},
	}
	const t = {
		title: "Title",
		year: "",
		genres: [],
		mediaType: "show" as const,
		fingerprint: {
			scores: {},
			pillars: { Energy: 3, Heart: 0, Humor: 0, World: 0, Craft: 0, Style: 0 },
			socialSuitability: [],
			viewingContext: [],
		},
		prose,
	} as unknown as Parameters<typeof pillarLine>[0]
	assert.equal(pillarLine(t), "Hohe Energie")
	assert.equal(pillarBrief(t, "Energy").verdict, "Hoch")
	assert.equal(pillarSentence(t, "Energy"), "Energie: Hoch (3/4).")
	assert.notEqual(pillarLine({ ...t, prose: undefined }), "Hohe Energie")
})
