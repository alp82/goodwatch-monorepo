// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { titleQuestions, MAX_QUESTIONS, MIN_QUESTIONS } = await import("./titleQuestions.ts")
const { fingerprintAnswers } = await import("./fingerprintQuestions.ts")
const { seasonSummary } = await import("./season-summary.ts")
const { matrix, toyStory, breakingBad } = await import("./fingerprint/titles.test-support.ts")

type Fingerprint = typeof matrix.fingerprint
type Scores = Fingerprint["scores"]

// A neutral fingerprint: every trait 5, every area tier 2, no viewing guide entries. It raises no "how it feels" question.
const neutralScores = Object.fromEntries(Object.keys(matrix.fingerprint.scores).map((k) => [k, 5])) as Scores
const fingerprint = (scores: Partial<Scores> = {}, rest: Partial<Fingerprint> = {}): Fingerprint => ({
	...matrix.fingerprint,
	scores: { ...neutralScores, ...scores },
	pillars: { Energy: 2, Heart: 2, Humor: 2, World: 2, Craft: 2, Style: 2 },
	socialSuitability: [],
	viewingContext: [],
	...rest,
})

const media = (overrides: Record<string, unknown> = {}, details: Record<string, unknown> = {}) =>
	({
		mediaType: "movie",
		details: {
			tmdb_id: 1,
			title: "Example",
			genres: [],
			keywords: [],
			tropes: [],
			tropes_count: 0,
			age_certifications: [],
			goodwatch_overall_score_normalized_percent: 72,
			imdb_user_score_original: 7.1,
			original_language_code: "en",
			...details,
		},
		fingerprint: null,
		streaming_availabilities: [{ streaming_service_id: 8, streaming_type: "flatrate", stream_url: "" }],
		streaming_services: [{ tmdb_id: 8, name: "Netflix", logo: "/n.png", order_default: 1 }],
		...overrides,
	}) as never

const ids = (m: never, extras = {}) => titleQuestions(m, "US", extras).map((q) => q.id)
const answer = (m: never, id: string, extras = {}) => titleQuestions(m, "US", extras).find((q) => q.id === id)
// Enough to clear the floor: stream, worth, and the tropes question.
const tropes = { tropes: ["A", "B", "C"], tropes_count: 40 }

test("a title with fewer than three questions gets no section", () => {
	assert.equal(MIN_QUESTIONS, 3)
	assert.deepEqual(ids(media()), [])
	assert.deepEqual(ids(media({}, tropes)), ["stream", "worth", "tropes"])
})

test("a title asks at most seven questions, in the section's order", () => {
	const m = media(
		{ fingerprint: fingerprint({ scare: 9, hopefulness: 1, bleakness: 9 }, { pillars: { Energy: 2, Heart: 2, Humor: 4, World: 2, Craft: 2, Style: 2 } }) },
		{
			...tropes,
			genres: ["Horror", "Comedy"],
			age_certifications: ["US_PG-13"],
			budget: 10e6,
			revenue: 80e6,
			original_language_code: "ko",
		},
	)
	const asked = ids(m, { collection: [{ tmdb_id: 1, title: "Example" }, { tmdb_id: 2, title: "Example 2" }] })
	assert.equal(asked.length, MAX_QUESTIONS)
	assert.deepEqual(asked, ["stream", "worth", "sequel", "kids", "scare", "laugh", "boxoffice"])
})

test("the streaming answer names the services as Where to Watch does, an Amazon Channel included", () => {
	const m = media(
		{
			streaming_availabilities: [
				{ streaming_service_id: 1825, streaming_type: "flatrate", stream_url: "" },
				{ streaming_service_id: 506, streaming_type: "flatrate", stream_url: "" },
				{ streaming_service_id: 387, streaming_type: "flatrate", stream_url: "" },
				{ streaming_service_id: 386, streaming_type: "flatrate", stream_url: "" },
				{ streaming_service_id: 3, streaming_type: "rent", stream_url: "" },
			],
			streaming_services: [
				{ tmdb_id: 1825, name: "HBO Max Amazon Channel", logo: "", order_default: 11 },
				{ tmdb_id: 506, name: "TBS", logo: "", order_default: 20 },
				{ tmdb_id: 387, name: "Peacock Premium+", logo: "", order_default: 30 },
				{ tmdb_id: 386, name: "Peacock", logo: "", order_default: 31 },
				{ tmdb_id: 3, name: "Google Play Movies", logo: "", order_default: 40 },
			],
			streaming_countries: { counts: { US: [4, 1, 0], DE: [2, 0, 0], FR: [1, 0, 0], JP: [0, 1, 0] }, top: { flatrate: [], rent: [], buy: [] } },
		},
		tropes,
	)
	assert.equal(
		answer(m, "stream")?.a,
		"In the United States, Example streams on HBO Max, TBS, and Peacock. You can rent or buy it from Google Play Movies. It also streams in 2 other countries.",
	)
})

test("a title that streams only elsewhere says where it isn't", () => {
	const m = media(
		{
			streaming_availabilities: [],
			streaming_countries: { counts: { DE: [2, 0, 0] }, top: { flatrate: [], rent: [], buy: [] } },
		},
		tropes,
	)
	assert.equal(answer(m, "stream")?.a, "It streams in 1 other country, but not in the United States.")
})

test("worth watching names the score as the ring shows it, rounded down", () => {
	assert.match(answer(media({}, { ...tropes, goodwatch_overall_score_normalized_percent: 89.6 }), "worth")?.a ?? "", /GoodWatch score of 89 /)
})

test("worth watching gives the scores in one sentence and the critics' and audiences' split only when it's 10 points or more", () => {
	const close = media({}, { ...tropes, rotten_tomatoes_tomato_score_original: 75, imdb_user_score_original: 7.1 })
	assert.equal(answer(close, "worth")?.a, "Mostly, it's well received, with a GoodWatch score of 72 (IMDb 7.1 and Rotten Tomatoes 75%).")
	const split = media({}, { ...tropes, rotten_tomatoes_tomato_score_original: 90, imdb_user_score_original: 6.0 })
	assert.match(answer(split, "worth")?.a ?? "", /Critics rate it higher \(90 out of 100\) than audiences \(60\)\.$/)
})

test("a box office answer only for a clear hit or a flop", () => {
	const at = (budget: number, revenue: number) => answer(media({}, { ...tropes, budget, revenue }), "boxoffice")
	// 1.6 times the budget used to be "Roughly broke even".
	assert.equal(at(500_000e1, 8_229_100), undefined)
	assert.deepEqual(
		[at(185e6, 1_004_558_444)?.q, at(185e6, 1_004_558_444)?.a],
		["Was Example a box office hit?", "Yes, a big one: it cost about $185 million to make and earned $1.0 billion worldwide, 5.4 times its budget."],
	)
	assert.deepEqual(
		[at(100e6, 45e6)?.q, at(100e6, 45e6)?.a],
		["Was Example a box office flop?", "Yes: it cost about $100 million to make and earned $45 million worldwide, 45% of its budget."],
	)
	// Below a million the figures aren't reliable.
	assert.equal(at(500_000, 2_000_000), undefined)
})

test("a comedy with little humor doesn't describe its humor kinds", () => {
	const m = media(
		{ fingerprint: fingerprint({ wit_wordplay: 6 }, { pillars: { Energy: 2, Heart: 2, Humor: 1, World: 2, Craft: 2, Style: 2 } }) },
		{ ...tropes, genres: ["Comedy"] },
	)
	assert.equal(answer(m, "laugh")?.a, "Not much for a comedy: the title analysis gives its humor 1 of 4.")
})

test("a funny title names its humor kinds with their scores", () => {
	const m = media(
		{ fingerprint: fingerprint({ satire_parody: 8, dark_humor: 7 }, { pillars: { Energy: 2, Heart: 2, Humor: 3, World: 2, Craft: 2, Style: 2 } }) },
		tropes,
	)
	assert.equal(answer(m, "laugh")?.a, "Yes: the humor is mostly satire (8 of 10) and dark humor (7 of 10).")
})

test("a horror title that unsettles more than it frightens says so", () => {
	const m = media({ fingerprint: fingerprint({ scare: 4, uncanny: 9, tension: 7 }) }, { ...tropes, genres: ["Horror"] })
	assert.equal(
		answer(m, "scare")?.a,
		"It's more unsettling than scary: the title analysis rates it 9 of 10 for uncanny and 7 for tension, but 4 for scares.",
	)
})

test("a middling fingerprint asks nothing about how the title feels", () => {
	assert.deepEqual(fingerprintAnswers(media({ fingerprint: fingerprint() })), [])
	// Plot and characters within 2 points: no "Both, in balance".
	const balanced = media({ fingerprint: fingerprint({ intrigue: 8, character_depth: 7 }) })
	assert.ok(!fingerprintAnswers(balanced).some((a) => a.id === "drive"))
})

test("at most two questions about how it feels, the genre's own question first", () => {
	const m = media(
		{ fingerprint: fingerprint({ hopefulness: 0, bleakness: 10, romance: 9, scare: 7 }) },
		{ ...tropes, genres: ["Horror"] },
	)
	const all = fingerprintAnswers(m).map((a) => a.id)
	assert.equal(all[0], "scare")
	assert.ok(all.length > 2)
	const asked = ids(m).filter((id) => ["laugh", "drive", "halfWatch", "date", "scare", "feelGood"].includes(id))
	assert.deepEqual(asked, all.slice(0, 2))
})

test("the fixture titles ask only questions with strong verdicts", () => {
	const withFingerprint = (t: typeof matrix) => media({ mediaType: t.mediaType, fingerprint: t.fingerprint }, { title: t.title, genres: t.genres })
	assert.deepEqual(
		Object.fromEntries(fingerprintAnswers(withFingerprint(matrix)).map((x) => [x.id, x.a])),
		{
			halfWatch: "No, it needs your attention: the title analysis rates it 9 of 10 for philosophical and 8 for complexity.",
			drive: "Mostly plot-driven: intrigue (10 of 10) and spectacle (10 of 10) carry it more than its characters do.",
		},
	)
	assert.match(
		fingerprintAnswers(withFingerprint(breakingBad)).find((x) => x.id === "feelGood")?.a ?? "",
		/^Probably not: the title analysis rates it \d+ of 10 for bleakness/,
	)
	assert.ok(fingerprintAnswers(withFingerprint(toyStory)).every((x) => x.a.match(/\d/)))
})

const grid = (seasons: [number, number][], episodes: [number, number, string, number, number][] = []) =>
	({
		seasons: seasons.map(([number, score]) => ({
			number,
			episodes: episodes.filter((e) => e[0] === number).map(([, ep, name, s, votes]) => ({ number: ep, name, score: s, votes })),
			maxEpisodeNumber: 10,
			scores: { imdb: { score, count: 1000 }, tmdb: null, tomatometer: null, popcornmeter: null, metascore: null, metacriticUser: null },
		})),
		specials: [],
	}) as never

// The summary as the show page builds it for a show named "Example".
const summarize = (g: never) => seasonSummary(g, "Example")

const show = (summary: unknown, details: Record<string, unknown> = {}) =>
	media({ mediaType: "show", season_summary: summary }, { ...tropes, ...details })

test("the season summary picks the best and lowest episodes among those with enough votes", () => {
	const summary = summarize(grid(
			[[1, 9.0], [2, 6.2]],
			[
				[1, 1, "Pilot", 8.9, 80_000],
				[1, 9, "Best", 9.9, 300_000],
				[2, 1, "Few votes", 2.0, 100],
				[2, 6, "Finale", 4.0, 300_000],
			],
		),
	)
	assert.deepEqual(summary?.seasons, [{ number: 1, score: 9 }, { number: 2, score: 6.2 }])
	assert.equal(summary?.best?.name, "Best")
	assert.equal(summary?.worst?.name, "Finale")
})

test("which season is best, when the seasons are 0.5 or more apart", () => {
	const summary = summarize(grid(
			[[1, 9.0], [2, 8.9], [3, 9.4], [4, 6.2]],
			[[3, 9, "Battle", 9.9, 300_000], [4, 6, "The End", 4.0, 300_000]],
		),
	)
	const q = answer(show(summary), "seasons")
	assert.equal(q?.q, "Which season of Example is best?")
	assert.equal(
		q?.a,
		"Season 3, with an IMDb average of 9.4. Season 4 is the weakest at 6.2. The highest-rated episode is Battle (season 3, episode 9) at 9.9, and the lowest is The End (season 4, episode 6) at 4.0.",
	)
	const close = summarize(grid([[1, 8.0], [2, 8.2], [3, 8.4]]))
	assert.equal(answer(show(close), "seasons"), undefined)
})

test("a show whose first season is the weakest asks whether it gets better", () => {
	const summary = summarize(grid([[1, 7.6], [2, 8.4], [3, 8.9]]))
	assert.deepEqual(
		[answer(show(summary), "seasons")?.q, answer(show(summary), "seasons")?.a],
		["Does Example get better after season 1?", "Yes: season 1 has an IMDb average of 7.6, and season 3 peaks at 8.9."],
	)
})

test("worth watching names a weak season only 1.5 or more below the best", () => {
	const weak = summarize(grid([[1, 9.0], [2, 9.4], [3, 7.9]]))
	assert.match(answer(show(weak), "worth")?.a ?? "", /Season 3 is the weak spot, with an IMDb average of 7.9 against 9.4 for the best season\.$/)
	const fine = summarize(grid([[1, 9.0], [2, 9.4], [3, 8.0]]))
	assert.doesNotMatch(answer(show(fine), "worth")?.a ?? "", /weak spot/)
})

test("a movie in a collection says where it sits", () => {
	const collection = [
		{ tmdb_id: 272, title: "Batman Begins", canonical_title: "Batman Begins", release_year: 2005 },
		{ tmdb_id: 1, title: "Example", release_year: 2008 },
		{ tmdb_id: 49026, title: "The Dark Knight Rises", release_year: 2012 },
	]
	const q = answer(media({}, tropes), "sequel", { collection })
	assert.equal(q?.q, "Is Example a sequel?")
	assert.equal(q?.a, "Yes: it's movie 2 of 3 in its series, after Batman Begins (2005) and before The Dark Knight Rises (2012).")
	assert.deepEqual(q?.titles?.map((t) => [t.path, t.current]), [
		["/movie/272-batman-begins", false],
		["/movie/1-example", true],
		["/movie/49026-the-dark-knight-rises", false],
	])
	const first = answer(media({}, tropes), "sequel", { collection: [collection[1], collection[2]] })
	assert.equal(first?.q, "Is there a sequel to Example?")
	assert.equal(answer(media({}, tropes), "sequel", { collection: [collection[0], collection[2]] }), undefined)
})

test("okay for kids only for a middle rating or a kids' title", () => {
	const at = (cert: string, guide: string[] = []) =>
		answer(
			media({ fingerprint: fingerprint({}, { socialSuitability: guide.map((name) => ({ name })) }) }, { ...tropes, age_certifications: [`US_${cert}`], content_advisories: ["Violence"] }),
			"kids",
		)?.a
	assert.equal(at("PG-13", ["Teens", "Adults"]), "Not for young kids: it's rated PG-13 in the United States for violence, and the viewing guide lists it for teens and adults.")
	assert.equal(at("R"), undefined)
	assert.equal(at("G"), undefined)
	assert.equal(at("G", ["Kids"]), "Yes: it's rated G in the United States for violence, and the viewing guide lists it for kids.")
})

test("how long a show takes to watch, only with an episode length", () => {
	const at = (details: Record<string, unknown>) => answer(show(null, { number_of_seasons: 8, number_of_episodes: 73, ...details }), "binge")?.a
	assert.equal(
		at({ episode_runtime: [57], first_air_date: "2011-04-17", last_air_date: "2019-05-19" }),
		"About 69 hours: 73 episodes in 8 seasons of about 57 minutes each, aired from 2011 to 2019.",
	)
	assert.equal(at({ episode_runtime: [] }), undefined)
})

test("the language question only for a title not made in English", () => {
	assert.equal(answer(media({}, tropes), "language"), undefined)
	assert.equal(
		answer(media({}, { ...tropes, original_language_code: "ko", spoken_language_codes: ["ko", "en"] }), "language")?.a,
		"No, it was made in Korean, with some English.",
	)
})

test("the tropes question only from 20 TV Tropes entries", () => {
	assert.equal(answer(media({}, { tropes: ["A"], tropes_count: 19 }), "tropes"), undefined)
	assert.equal(answer(media({}, tropes), "tropes")?.a, "TV Tropes lists 40 tropes for it, including A, B, and C.")
})

test("no question restates a fixed sentence or asks about the source", () => {
	const m = media({}, { ...tropes, keywords: ["based on novel or book"] })
	const qa = titleQuestions(m, "US")
	assert.ok(!qa.some((q) => /based on/i.test(q.q)))
	for (const sentence of [
		"All links in Where to Watch go to these licensed services.",
		"The GoodWatch score combines critic and audience ratings.",
		"Pick any of them in Where to Watch to see the local services.",
	])
		assert.ok(!qa.some((q) => q.a.includes(sentence)))
})

test("the area details header, the area's slider, and the FAQ humor meter use the same level word for every tier", async () => {
	const { AREAS, areaLevelWord } = await import("./fingerprint/areas.ts")
	const { readScale, scalesOf } = await import("./fingerprint/scales.ts")
	for (const area of AREAS)
		for (const tier of [0, 1, 2, 3, 4]) {
			const t = {
				...matrix,
				fingerprint: {
					...matrix.fingerprint,
					pillars: { ...matrix.fingerprint.pillars, [area]: tier },
				},
			}
			const slider = scalesOf(area).find((sc) => sc.name === area)
			assert.ok(slider, `${area} has a slider`)
			const header = areaLevelWord(area, tier)
			assert.equal(readScale(slider, t).word, header, `${area} tier ${tier}`)
			if (area !== "Humor") continue
			// A comedy asks the laugh question at every tier.
			const laugh = fingerprintAnswers(media({ fingerprint: t.fingerprint }, { genres: ["Comedy"] })).find((answer) => answer.id === "laugh")
			assert.deepEqual(laugh?.visual, { kind: "meter", tier, area: "Humor", word: header })
		}
})
