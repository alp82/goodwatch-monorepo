import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { FILTER_NAMES, MIN_MATCHES, defaultFilterState, stateAsApplied } =
	await import("~/domain/filter-state")
const { CONTENT_KINDS } = await import("~/domain/age-content")
const {
	CONTENT_LABELS,
	DISCOVER_SORTS,
	FILTER_ACCENTS,
	MATCH_LABELS,
	RATE_MORE,
	activeChips,
	compactCount,
	discoverSorts,
	recoveryLabel,
	sortShown,
	tasteStateOf,
} = await import("./labels.ts")
const { SORT_OPTIONS, sortOptionsFor } = await import("~/ui/watch-next/labels")

const state = defaultFilterState({ onMyServices: false, notSeenYet: false })

test("Best match is the first sort, browsing and searching, and taste marks it", () => {
	assert.deepEqual(
		discoverSorts(false).map((s) => s.key),
		["match", "popular", "top", "newest"],
	)
	assert.deepEqual(
		discoverSorts(true).map((s) => s.key),
		["match", "relevance", "popular", "top", "newest"],
	)
	const [match, ...rest] = discoverSorts(false)
	assert.equal(match.label, "Best match")
	assert.equal(match.taste, true)
	assert.ok(!match.disabled)
	assert.ok(rest.every((s) => !s.taste && !s.disabled))
})

test("without taste Best match shows but can't be picked, with the reason", () => {
	const rateMore = discoverSorts(false, "rateMore")[0]
	assert.equal(rateMore.disabled, true)
	assert.equal(rateMore.hint, RATE_MORE)
	// A guest who has to sign up gets the prompt under the list; the line stays.
	const signUp = discoverSorts(true, "signUp")[0]
	assert.equal(signUp.disabled, true)
	assert.equal(signUp.hint, DISCOVER_SORTS.match.hint)
	assert.ok(
		discoverSorts(false, "rateMore")
			.slice(1)
			.every((s) => !s.disabled),
	)
})

test("the control shows the sort in use when Best match can't sort", () => {
	assert.equal(sortShown("match", false, "ready"), "match")
	assert.equal(sortShown("match", false, "rateMore"), "popular")
	assert.equal(sortShown("match", true, "signUp"), "relevance")
	assert.equal(sortShown("top", false, "rateMore"), "top")
})

test("the taste state follows the results", () => {
	assert.equal(tasteStateOf(null), "ready")
	const results = (
		hasTaste: boolean,
		status: "ready" | "needsTaste" | "signUp",
	) => tasteStateOf({ hasTaste, forYou: { status } })
	assert.equal(results(true, "ready"), "ready")
	assert.equal(results(false, "needsTaste"), "rateMore")
	assert.equal(results(false, "signUp"), "signUp")
	// Taste match off for the viewer: no taste, whatever the ratings say.
	assert.equal(results(false, "ready"), "rateMore")
})

test("Watch next says what Discover says for the sorts they share", () => {
	const byKey = Object.fromEntries(SORT_OPTIONS.map((s) => [s.key, s]))
	for (const key of ["match", "newest", "top", "popular"] as const) {
		assert.equal(byKey[key].label, DISCOVER_SORTS[key].label)
		assert.equal(byKey[key].hint, DISCOVER_SORTS[key].hint)
	}
	assert.equal(SORT_OPTIONS.length, 6)
	assert.equal(sortOptionsFor({ available: true, prompt: null }), SORT_OPTIONS)
	const rateMore = sortOptionsFor({ available: false, prompt: "rateMore" })
	assert.deepEqual(
		rateMore.filter((s) => s.disabled).map((s) => s.key),
		["match"],
	)
	assert.equal(rateMore[0].hint, RATE_MORE)
	const signUp = sortOptionsFor({ available: false, prompt: "signUpToLearn" })
	assert.equal(signUp[0].disabled, true)
	assert.equal(signUp[0].hint, DISCOVER_SORTS.match.hint)
})

test("a count is short enough for a fixed slot", () => {
	const cases: [number, string][] = [
		[0, "0"],
		[7, "7"],
		[999, "999"],
		[1000, "1.0k"],
		[1249, "1.2k"],
		[9949, "9.9k"],
		[9950, "10k"],
		[12_345, "12k"],
		[48_600, "49k"],
		[999_499, "999k"],
		[1_200_000, "1.2M"],
	]
	for (const [n, short] of cases) assert.equal(compactCount(n), short)
	for (const [n] of cases) assert.ok(compactCount(n).length <= 4)
})

test("the taste match filter has a label per option, a chip, and its recovery wording", () => {
	assert.deepEqual(Object.keys(MATCH_LABELS).map(Number), [...MIN_MATCHES])
	assert.equal(MATCH_LABELS[0], "Any match")
	assert.equal(MATCH_LABELS[80], "80% and up")

	assert.deepEqual(activeChips(state), [])
	const chips = activeChips({ ...state, minMatch: 80 })
	assert.equal(chips.length, 1)
	assert.equal(chips[0].label, "Match 80%+")
	assert.equal(chips[0].group, "minMatch")
	assert.equal(chips[0].remove({ ...state, minMatch: 80 }).minMatch, 0)

	const filtered = { ...state, minMatch: 80 as const }
	assert.equal(recoveryLabel("minMatch", 12, filtered), "12 below 80% match")
	assert.equal(
		recoveryLabel("minMatch", 12_345, filtered),
		"12,345 below 80% match",
	)
	assert.equal(recoveryLabel("minMatch", 12, filtered, true), "12 more")
})

test("every filter group has its own accent, and amber is the taste match's", () => {
	assert.deepEqual(Object.keys(FILTER_ACCENTS).sort(), [...FILTER_NAMES].sort())
	assert.equal(FILTER_ACCENTS.years.dot, FILTER_ACCENTS.released.dot)
	assert.equal(FILTER_ACCENTS.runtime.dot, "bg-sky-400")
	assert.equal(FILTER_ACCENTS.sourceScores.dot, "bg-yellow-400")
	assert.equal(FILTER_ACCENTS.scoreGap.dot, "bg-rose-400")
	assert.equal(FILTER_ACCENTS.minMatch.dot, "bg-amber-400")
})

const FSK = [0, 6, 12, 16, 18].map((age) => ({ age, label: `FSK ${age}` }))

test("every kind of content has its words", () => {
	assert.deepEqual(Object.keys(CONTENT_LABELS), [...CONTENT_KINDS])
	assert.deepEqual(
		CONTENT_KINDS.map((kind) => CONTENT_LABELS[kind].full),
		[
			"Graphic violence",
			"Sex & nudity",
			"Disturbing scenes",
			"Strong language",
			"Drugs & alcohol",
		],
	)
	assert.deepEqual(
		CONTENT_KINDS.map((kind) => CONTENT_LABELS[kind].short),
		[
			"violence",
			"sex & nudity",
			"disturbing scenes",
			"strong language",
			"drugs",
		],
	)
	// The filter search still finds disturbing scenes by "scary".
	assert.ok(CONTENT_LABELS.disturbing.words.split(" ").includes("scary"))
})

test("the age limit and every changed kind have a chip", () => {
	const limited = {
		...state,
		ageLimit: 12,
		content: { violence: "show", disturbing: "hide" } as const,
	}
	const chips = activeChips(limited, {
		ageStep: (age) => FSK.find((step) => step.age === age)?.label,
	})
	assert.deepEqual(
		chips.map((chip) => [chip.group, chip.label]),
		[
			["ageLimit", "Age limit FSK 12"],
			["content", "Violence OK"],
			["content", "No disturbing scenes"],
		],
	)
	// Without the ladder the chip says the age.
	assert.equal(activeChips(limited)[0].label, "Age limit 12")
	assert.equal(activeChips({ ...state, ageLimit: 0 })[0].label, "Age limit 0")

	// Removing the limit keeps both choices. The one that showed violence has no chip then: nothing hides it anyway.
	const off = chips[0].remove(limited)
	assert.equal(off.ageLimit, undefined)
	assert.deepEqual(off.content, { violence: "show", disturbing: "hide" })
	assert.deepEqual(
		activeChips(off).map((chip) => chip.label),
		["No disturbing scenes"],
	)
	assert.deepEqual(chips[1].remove(limited).content, { disturbing: "hide" })
	assert.deepEqual(chips[2].remove(limited).content, { violence: "show" })
	assert.equal(chips[2].remove(limited).ageLimit, 12)

	// What the limit hides by itself has no chip, and neither has a choice that says the same.
	assert.equal(activeChips({ ...state, ageLimit: 6 }).length, 1)
	const same = { ...state, ageLimit: 6, content: { drugs: "hide" } as const }
	assert.deepEqual(
		activeChips(same).map((chip) => chip.label),
		["Age limit 6"],
	)
	// At a limit that shows drugs by itself, the same choice is a change again.
	assert.deepEqual(
		activeChips({ ...same, ageLimit: 16 }).map((chip) => chip.label),
		["Age limit 16", "No drugs"],
	)
	// Without the viewer's ladder neither applies: no chips at all.
	assert.deepEqual(activeChips(stateAsApplied(limited, null)), [])
	const hidden = activeChips({ ...state, content: { drugs: "hide" } })
	assert.deepEqual(
		hidden.map((chip) => chip.label),
		["No drugs"],
	)
	assert.equal(hidden[0].remove(state).content, undefined)
})

test("each chosen theme and style is a chip that removes itself, after the moods", () => {
	const chosen = {
		...state,
		moods: ["funny" as const],
		themes: ["war" as const, "true" as const],
		styles: ["slow" as const],
		genres: ["Drama"],
	}
	const chips = activeChips(chosen)
	assert.deepEqual(
		chips.map((chip) => [chip.group, chip.key, chip.label]),
		[
			["moods", "mood-funny", "Funny"],
			["themes", "theme-war", "War"],
			["themes", "theme-true", "True stories"],
			["styles", "style-slow", "Slow burn"],
			["genres", "genre-Drama", "Drama"],
		],
	)
	assert.deepEqual(chips[1].remove(chosen).themes, ["true"])
	assert.deepEqual(chips[1].remove(chosen).styles, ["slow"])
	assert.deepEqual(chips[3].remove(chosen).styles, [])
	assert.deepEqual(chips[3].remove(chosen).themes, ["war", "true"])
	// A mood and a theme with the same key are two chips with keys of their own.
	const both = activeChips({
		...state,
		moods: ["history"],
		themes: ["history"],
	})
	assert.deepEqual(
		both.map((chip) => chip.key),
		["mood-history", "theme-history"],
	)
	assert.equal(new Set(both.map((chip) => chip.group)).size, 2)
})

test("the recovery says what other themes or styles would show", () => {
	assert.equal(recoveryLabel("themes", 12, state), "12 in other themes")
	assert.equal(recoveryLabel("styles", 1_234, state), "1,234 in other styles")
	assert.equal(recoveryLabel("themes", 12, state, true), "12 more")
	assert.equal(recoveryLabel("styles", 12, state, true), "12 more")
	assert.equal(FILTER_ACCENTS.themes.dot, "bg-orange-400")
	assert.equal(FILTER_ACCENTS.styles.dot, "bg-green-400")
})

test("preference chips group more than two titles and retain poster previews", () => {
	const names = {
		title: (key: number) => `Title ${key}`,
		poster: (key: number) => `/${key}.jpg`,
	}
	const chips = activeChips(
		{ ...state, loved: [1, 2, 3], disliked: [4, 5] },
		names,
	)
	assert.equal(chips[0].label, "Loved: 3 titles")
	assert.deepEqual(
		chips[0].preview?.map((t) => t.title),
		["Title 1", "Title 2", "Title 3"],
	)
	assert.equal(chips[1].preview?.[0].poster, "/4.jpg")
	assert.equal(chips.length, 3)
	assert.equal(chips[0].remove({ ...state, loved: [1, 2, 3] }).loved, undefined)
})

test("production country chips name the country and remove only that choice", () => {
	const chosen = { ...state, productionCountries: ["US", "GB"] }
	const chips = activeChips(chosen)
	assert.deepEqual(
		chips.map((c) => c.label),
		["Produced in United States", "Produced in United Kingdom"],
	)
	assert.deepEqual(chips[0].remove(chosen).productionCountries, ["GB"])
})

test("streaming country is labelled separately from production countries", () => {
	const chips = activeChips({
		...state,
		streamingCountry: "DE",
		productionCountries: ["US"],
	})
	assert.deepEqual(
		chips.map((c) => c.label),
		["Streaming in Germany", "Produced in United States"],
	)
	assert.deepEqual(
		chips[0].remove({
			...state,
			streamingCountry: "DE",
			productionCountries: ["US"],
		}).productionCountries,
		["US"],
	)
})

test("manually selected services provide names and logos for hover previews", () => {
	const chips = activeChips(
		{ ...state, services: [8, 9], onMyServices: false },
		{
			service: (id) => (id === 8 ? "Netflix" : "Prime Video"),
			serviceLogo: (id) => `/${id}.jpg`,
		},
	)
	assert.deepEqual(chips[0].preview, [
		{ title: "Netflix", poster: "/8.jpg", logo: true },
		{ title: "Prime Video", poster: "/9.jpg", logo: true },
	])
})

test("range, source, gap and any-service chips use the agreed wording and remove their own value", () => {
	const chosen = {
		...state,
		years: { min: 1990, max: 2005 },
		runtime: { min: 90, max: 120 },
		sourceScores: { imdb: 80, rtCritics: 90, rtAudience: 85, metacritic: 75 },
		scoreGap: "agree" as const,
		anyService: true,
		streamingCountry: "DE",
	}
	const chips = activeChips(chosen)
	assert.deepEqual(
		chips.map((c) => c.label),
		[
			"1990–2005",
			"90–120 min",
			"IMDb 8.0+",
			"Rotten Tomatoes 90%+",
			"RT audience 85%+",
			"Metacritic 75+",
			"Critics and audiences agree",
			"Streaming in Germany",
		],
	)
	assert.deepEqual(
		chips.find((c) => c.key === "source-imdb")!.remove(chosen).sourceScores,
		{ rtCritics: 90, rtAudience: 85, metacritic: 75 },
	)
	assert.equal(
		chips.find((c) => c.key === "anyService")!.remove(chosen).anyService,
		undefined,
	)
	for (const [fields, label] of [
		[{ years: { min: 1990 } }, "From 1990"],
		[{ years: { max: 2005 } }, "Until 2005"],
		[{ runtime: { max: 90 } }, "Up to 90 min"],
		[{ runtime: { min: 0, max: 90 } }, "Up to 90 min"],
		[{ runtime: { min: 120 } }, "At least 120 min"],
		[{ scoreGap: "critics" as const }, "Critics liked it more"],
		[{ scoreGap: "audience" as const }, "Audiences liked it more"],
		[{ anyService: true }, "On any service"],
	] as const)
		assert.equal(activeChips({ ...state, ...fields })[0].label, label)
	for (const [filter, wording] of [
		["years", "from other years"],
		["runtime", "of other lengths"],
		["sourceScores", "with lower source scores"],
		["scoreGap", "without critics vs audiences"],
	] as const)
		assert.equal(recoveryLabel(filter, 12, chosen), `12 ${wording}`)
})

test("all-of tag chips join picks with and; any-of chips retain their individual labels", () => {
	const picks = {
		...state,
		moods: ["funny", "feelgood"] as typeof state.moods,
		genres: ["Drama", "Comedy"],
	}
	const chips = activeChips({ ...picks, allOf: ["moods", "genres"] })
	assert.equal(
		chips.find((chip) => chip.group === "moods")?.label,
		"Funny and Feel-good",
	)
	assert.equal(
		chips.find((chip) => chip.group === "genres")?.label,
		"Drama and Comedy",
	)
	assert.deepEqual(chips[0].remove(picks).moods, [])
	assert.deepEqual(
		activeChips(picks)
			.filter((chip) => chip.group === "moods")
			.map((chip) => chip.label),
		["Funny", "Feel-good"],
	)
})

test("all-of recoveries describe titles missing any required tag", () => {
	for (const [group, singular] of [
		["moods", "mood"],
		["themes", "theme"],
		["styles", "style"],
		["genres", "genre"],
	] as const) {
		const filtered = { ...state, allOf: [group] }
		assert.equal(
			recoveryLabel(group, 12, filtered),
			`12 without every ${singular}`,
		)
		assert.equal(recoveryLabel(group, 12, filtered, true), "12 more")
	}
})
