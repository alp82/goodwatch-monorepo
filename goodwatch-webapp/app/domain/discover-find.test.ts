import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	applyFindSetting,
	findValues,
	keepBest,
	nameScore,
	normalizeFind,
	settingKey,
} = await import("./discover-find.ts")

const NOW = 2026
const US = [
	{ age: 0, label: "G", show: "TV-G" },
	{ age: 8, label: "PG", show: "TV-PG" },
	{ age: 14, label: "PG-13", show: "TV-14" },
	{ age: 17, label: "R", show: "TV-MA" },
]
const DE = [0, 6, 12, 16, 18].map((age) => ({ age, label: `FSK ${age}` }))
const IN = [
	{ age: 0, label: "U" },
	{ age: 7, label: "UA 7+" },
	{ age: 13, label: "UA 13+" },
	{ age: 16, label: "UA 16+" },
	{ age: 18, label: "A" },
]

type Ladder = { age: number; label: string; show?: string }[]
const labels = (text: string, ladder: Ladder | null = US) =>
	findValues(text, { now: NOW, ladder }).map((reading) => reading.label)

test("each input reads as the settings it names, likeliest first", () => {
	const table: [string, string[]][] = [
		["12", ["Up to PG-13 · TV-14"]],
		["1999", ["Released in 1999", "From 1999", "Up to 1999", "The 1990s"]],
		["90s", ["The 1990s"]],
		["'90s", ["The 1990s"]],
		["the 90s", ["The 1990s"]],
		["late 90s", ["Late 1990s"]],
		["early 2000s", ["Early 2000s"]],
		["1990-1999", ["The 1990s"]],
		["1990-99", ["The 1990s"]],
		["1990 to 2005", ["Released 1990 to 2005"]],
		["from 1999", ["From 1999"]],
		["before 2000", ["Before 2000"]],
		["in 1999", ["Released in 1999", "The 1990s"]],
		["90 min", ["Movies under 90 min", "Movies 90 min or more"]],
		["2h30", ["Movies under 2 h 30", "Movies 2 h 30 or more"]],
		["over 2 hours", ["Movies 2 h or more"]],
		["under 90", ["Movies under 90 min"]],
		["about 45 min", ["Episodes about 45 min"]],
		["100h", ["Under 100 h to finish", "100 h or more to finish"]],
		["under 30 hours", ["Under 30 h to finish"]],
		["$100m", ["Budget $100M+", "Box office $100M+"]],
		["budget 50m", ["Budget $50M+"]],
		["1b box office", ["Box office $1B+"]],
		["$1b box office", ["Box office $1B+"]],
		["300m", ["Budget $300M+", "Box office $250M+"]],
		["under $5m", ["Budget under $5M", "Box office under $10M"]],
		["pg-13", ["Up to PG-13 · TV-14"]],
		["12a", ["Up to PG-13 · TV-14"]],
		["fsk 16", ["Up to R · TV-MA"]],
		["tv-ma", ["Up to R · TV-MA"]],
		["r", ["Up to R · TV-MA"]],
		["a", []],
		[
			"80",
			["GoodWatch 80+", "IMDb 8.0+", "Tomatometer 80%+", "Popcornmeter 80%+"],
		],
		["80%", ["Tomatometer 80%+", "Popcornmeter 80%+"]],
		["8.0", ["IMDb 8.0+", "Metacritic user score 8.0+"]],
		// The shared score scale has 60, 70, 80 and 90 only, and Find doesn't snap.
		["7.5", []],
		["95", []],
		["8", ["Up to PG · TV-PG", "8+ seasons"]],
		["8 seasons", ["8+ seasons"]],
		["3+ seasons", ["3+ seasons"]],
		["up to 3 seasons", ["Up to 3 seasons"]],
		["one season", ["One season"]],
		// Minutes up to 240; "300m" reads as money.
		["100m", ["Movies under 100 min", "Movies 100 min or more"]],
		// Not values: names are Find's other half.
		["cozy", []],
		["netflix", []],
	]
	for (const [text, expected] of table)
		assert.deepEqual(labels(text), expected, `"${text}"`)
})

test("readings say what they set", () => {
	const settings = (text: string, ladder: Ladder | null = US) =>
		findValues(text, { now: NOW, ladder }).map((reading) => reading.setting)
	assert.deepEqual(settings("1999"), [
		{ kind: "years", years: { min: 1999, max: 1999 } },
		{ kind: "years", years: { min: 1999 } },
		{ kind: "years", years: { max: 1999 } },
		{ kind: "years", years: { min: 1990, max: 1999 } },
	])
	// The current decade runs to now, so it has no upper end.
	assert.deepEqual(settings("2020s"), [{ kind: "years", years: { min: 2020 } }])
	assert.deepEqual(settings("late 90s"), [
		{ kind: "years", years: { min: 1996, max: 1999 } },
	])
	assert.deepEqual(settings("about 45 min"), [
		{ kind: "episodeRuntime", episodeRuntime: { min: 35, max: 55 } },
	])
	assert.deepEqual(settings("60 min"), [
		{ kind: "runtime", runtime: { max: 60 } },
		{ kind: "runtime", runtime: { min: 60 } },
		{ kind: "episodeRuntime", episodeRuntime: { max: 60 } },
		{ kind: "episodeRuntime", episodeRuntime: { min: 60 } },
	])
	assert.deepEqual(settings("$100m"), [
		{ kind: "budget", millions: { min: 100 } },
		{ kind: "boxOffice", millions: { min: 100 } },
	])
	assert.deepEqual(settings("100h"), [
		{ kind: "hours", hours: { max: 100 } },
		{ kind: "hours", hours: { min: 100 } },
	])
	assert.deepEqual(settings("one season"), [
		{ kind: "seasons", seasons: { min: 1, max: 1 } },
	])
	assert.deepEqual(settings("12"), [{ kind: "ageLimit", age: 14 }])
	assert.deepEqual(settings("80").slice(0, 2), [
		{ kind: "minScore", score: 80 },
		{ kind: "sourceScore", source: "imdb", score: 80 },
	])
})

test("ages and ratings go by the list's ladder", () => {
	// Germany: the ladder's own labels; a US name stands for its age, ties to the lower step.
	assert.deepEqual(labels("fsk 16", DE), ["Up to FSK 16"])
	assert.deepEqual(labels("12", DE), ["Up to FSK 12"])
	assert.deepEqual(labels("pg-13", DE), ["Up to FSK 12"])
	// One letter matches only a label the local ladder has.
	assert.deepEqual(labels("r", DE), [])
	assert.deepEqual(labels("a", IN), ["Up to A"])
	assert.deepEqual(labels("u", IN), ["Up to U"])
	// At most 3 years off; 4 still reads as seasons.
	assert.deepEqual(labels("21", DE), ["Up to FSK 18"])
	assert.deepEqual(labels("4", [{ age: 8, label: "PG" }, ...US.slice(2)]), [
		"4+ seasons",
	])
	// Without a ladder there's no age reading; seasons still read.
	assert.deepEqual(labels("12", null), [])
	assert.deepEqual(labels("8", null), ["8+ seasons"])
})

test("readings of a hidden sub-tab are dropped before the cap", () => {
	const shown = (subTab: string) => subTab !== "budget" && subTab !== "shows"
	assert.deepEqual(
		findValues("$100m", { now: NOW, ladder: US, shown }).map((r) => r.label),
		[],
	)
	assert.deepEqual(
		findValues("8", { now: NOW, ladder: US, shown }).map((r) => r.label),
		["Up to PG · TV-PG"],
	)
	// Five score steps fit 80; the cap keeps four, so a hidden one lets the fifth in.
	assert.deepEqual(
		findValues("80", {
			now: NOW,
			ladder: US,
			shown: (subTab) => subTab === "scores",
		}).length,
		4,
	)
})

test("a reading and a name match of the same setting share a key", () => {
	assert.equal(
		settingKey({ kind: "years", years: { min: 1990, max: 1999 } }),
		"years:1990-1999",
	)
	assert.equal(
		settingKey({ kind: "runtime", runtime: { max: 90 } }),
		"runtime:-90",
	)
	assert.equal(
		settingKey({ kind: "sourceScore", source: "imdb", score: 80 }),
		"source:imdb:80",
	)
	// "Before 2000" and "Up to 1999" are one setting.
	const [before] = findValues("before 2000", { now: NOW, ladder: US })
	const upTo = findValues("1999", { now: NOW, ladder: US })[2]
	assert.equal(before.key, upTo.key)
	assert.deepEqual(
		keepBest([
			{ key: "a", score: 50, from: "name" },
			{ key: "b", score: 40, from: "name" },
			{ key: "a", score: 98, from: "value" },
		]),
		[
			{ key: "a", score: 98, from: "value" },
			{ key: "b", score: 40, from: "name" },
		],
	)
})

test("names match by the whole name, its start, a word, every word, inside, then extra words", () => {
	assert.equal(nameScore("netflix", "Netflix"), 100)
	assert.equal(nameScore("net", "Netflix"), 85)
	assert.equal(nameScore("gems", "Hidden gems"), 70)
	assert.equal(nameScore("hid gem", "Hidden gems"), 65)
	assert.equal(nameScore("flix", "Netflix"), 50)
	assert.equal(
		nameScore("watchlist", "On your wishlist", "wishlist watchlist"),
		35,
	)
	assert.equal(nameScore("box office", "$1B+", "box office revenue"), 35)
	assert.equal(nameScore("feel-good", "Cozy", "feel-good"), 35)
	// Names need two letters; inside a name needs three.
	assert.equal(nameScore("n", "Netflix"), 0)
	assert.equal(nameScore("fl", "Netflix"), 0)
	assert.equal(nameScore("Amélie", "amelie"), 100)
	assert.equal(normalizeFind("  Late   ’90s "), "late 90s")
})

test("shared scales retain the catalog's reviewed steps and popularity seams", async () => {
	const {
		SCORE_STEPS,
		SOURCE_SCORE_STEPS,
		VOTES_STEPS,
		VOTES_SCALE,
		VOTES_PRESETS,
		POPULARITY_RANK_STEPS,
		RANK_SCALE,
		POPULARITY_RANK_PRESETS,
		RANK_PRESETS,
	} = await import("./title-scales.ts")
	assert.equal(SOURCE_SCORE_STEPS, SCORE_STEPS)
	assert.equal(VOTES_SCALE.stops, VOTES_STEPS)
	assert.equal(RANK_SCALE.stops, POPULARITY_RANK_STEPS)
	assert.equal(RANK_PRESETS, POPULARITY_RANK_PRESETS)
	assert.deepEqual(
		VOTES_PRESETS.map((p) => p.range),
		[
			{ max: 9999 },
			{ min: 10000, max: 99999 },
			{ min: 100000 },
			{ min: 1000000 },
		],
	)
	assert.deepEqual(
		RANK_PRESETS.map((p) => p.range),
		[{ max: 1000 }, { min: 1001, max: 10000 }, { min: 10001 }],
	)
	assert.deepEqual(
		findValues("8.0", { now: NOW, ladder: US }).map((r) => r.setting),
		[
			{ kind: "sourceScore", source: "imdb", score: 80 },
			{ kind: "sourceScore", source: "metacriticUsers", score: 80 },
		],
	)
	assert.equal(
		settingKey({ kind: "episodeRuntime", episodeRuntime: { max: 35 } }),
		"episodeRuntime:-35",
	)
})

test("Find applies Budget and Shows readings to filter state", async () => {
	const { defaultFilterState } = await import("./filter-state.ts")
	const cases = [
		["budget 50m", "budget", { min: 50 }],
		["$1b box office", "boxOffice", { min: 1000 }],
		["hit", "returns", "hit"],
		["box office flop", "returns", "flop"],
		["one season", "seasons", { min: 1, max: 1 }],
		["still running", "showStatus", "running"],
		["ended", "showStatus", "ended"],
		["canceled", "showStatus", "canceled"],
		["under 30 hours", "hours", { max: 30 }],
	] as const
	for (const [text, field, expected] of cases) {
		const [reading] = findValues(text, { now: NOW, ladder: US })
		assert.ok(reading, text)
		const state = applyFindSetting(
			defaultFilterState({ onMyServices: false, notSeenYet: false }),
			reading.setting,
			NOW,
		)
		assert.deepEqual(state[field], expected, text)
		assert.equal(reading.key, settingKey(reading.setting))
		assert.deepEqual(findValues(text, { ladder: US, shown: () => false }), [])
	}
})
