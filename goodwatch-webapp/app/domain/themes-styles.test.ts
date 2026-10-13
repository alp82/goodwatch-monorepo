import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { CoreScores } from "../server/utils/fingerprint.ts"

const {
	MAX_STYLES,
	MAX_THEMES,
	STYLES,
	STYLE_BY_KEY,
	STYLE_KEYS,
	THEMES,
	THEME_BY_KEY,
	THEME_KEYS,
	maskOfKeys,
	parseKeys,
	styleMaskOf,
	stylesInMask,
	themeMaskOf,
	themesInMask,
	toggleKey,
} = await import("./themes-styles.ts")
const { VALID_FINGERPRINT_KEYS } = await import(
	"../server/utils/fingerprint.ts"
)
const islands = await import("../server/explorer/islands.server.ts")

type Scores = Partial<Record<keyof CoreScores, number>>
interface Case {
	scores?: Scores
	genres?: string[]
}

/** A title with a title analysis that scores 0 on everything but the given attributes, in the snapshot's shape. */
const ordered = (scores: Scores = {}) =>
	Uint8Array.from(
		VALID_FINGERPRINT_KEYS,
		(key) => scores[key as keyof CoreScores] ?? 0,
	)

// Per theme: titles that have it, each by one way into the rule, and titles one step short of it.
const THEME_CASES: Record<string, { has: Case[]; lacks: Case[] }> = {
	crime: { has: [{ scores: { crime: 8 } }], lacks: [{ scores: { crime: 7 } }] },
	mystery: {
		has: [{ scores: { mystery: 8 } }],
		lacks: [{ scores: { mystery: 7 } }],
	},
	war: {
		has: [{ scores: { warfare: 7 } }],
		lacks: [{ scores: { warfare: 6 } }],
	},
	politics: {
		has: [{ scores: { political: 7 } }],
		lacks: [{ scores: { political: 6 } }],
	},
	true: {
		has: [{ scores: { biographical: 6 } }],
		lacks: [{ scores: { biographical: 5 } }],
	},
	// The past without war: a war title's history is War's.
	history: {
		has: [{ scores: { historical: 8, warfare: 5 } }],
		lacks: [
			{ scores: { historical: 7 } },
			{ scores: { historical: 10, warfare: 6 } },
		],
	},
	growing: {
		has: [{ scores: { coming_of_age: 8 } }],
		lacks: [{ scores: { coming_of_age: 7 } }],
	},
	family: {
		has: [{ scores: { family_dynamics: 8 } }],
		lacks: [{ scores: { family_dynamics: 7 } }],
	},
	mind: {
		has: [{ scores: { psychological: 8 } }],
		lacks: [{ scores: { psychological: 7 } }],
	},
	showbiz: {
		has: [{ scores: { showbiz: 6 } }],
		lacks: [{ scores: { showbiz: 5 } }],
	},
	sports: {
		has: [{ scores: { sports: 6 } }],
		lacks: [{ scores: { sports: 5 } }],
	},
	money: {
		has: [{ scores: { class_and_capitalism: 7 } }],
		lacks: [{ scores: { class_and_capitalism: 6 } }],
	},
	future: {
		has: [
			{ scores: { futuristic: 7 } },
			{ scores: { technology_and_humanity: 7 } },
		],
		lacks: [{ scores: { futuristic: 6, technology_and_humanity: 6 } }],
	},
	fantasy: {
		has: [{ scores: { fantasy: 7 } }],
		lacks: [{ scores: { fantasy: 6 } }],
	},
}

const STYLE_CASES: Record<string, { has: Case[]; lacks: Case[] }> = {
	// The two forms go by genre alone, whatever the scores say.
	animated: {
		has: [{ genres: ["Animation"] }, { genres: ["Comedy", "Animation"] }],
		lacks: [{ genres: ["Comedy"] }, { genres: [] }],
	},
	documentary: {
		has: [
			{ genres: ["Documentary"] },
			{ genres: ["Reality"] },
			{ genres: ["Talk"] },
			{ genres: ["News"] },
		],
		lacks: [{ genres: ["Drama", "History"] }],
	},
	spectacle: {
		has: [{ scores: { spectacle: 8 } }],
		lacks: [{ scores: { spectacle: 7 } }],
	},
	stylized: {
		has: [{ scores: { visual_stylization: 8 } }],
		lacks: [{ scores: { visual_stylization: 7 } }],
	},
	// Sound counts one step less than music.
	music: {
		has: [
			{ scores: { music_centrality: 7 } },
			{ scores: { sound_centrality: 8 } },
		],
		lacks: [{ scores: { music_centrality: 6, sound_centrality: 7 } }],
	},
	slow: {
		has: [{ scores: { slow_burn: 8 } }],
		lacks: [{ scores: { slow_burn: 7 } }],
	},
	fast: {
		has: [{ scores: { fast_pace: 8 } }],
		lacks: [{ scores: { fast_pace: 7 } }],
	},
	talky: {
		has: [{ scores: { dialogue_centrality: 8 } }],
		lacks: [{ scores: { dialogue_centrality: 7 } }],
	},
	nonlinear: {
		has: [{ scores: { non_linear_narrative: 7 } }],
		lacks: [{ scores: { non_linear_narrative: 6 } }],
	},
	// Violence counts one step less than the grotesque.
	graphic: {
		has: [{ scores: { grotesque: 8 } }, { scores: { violence: 9 } }],
		lacks: [{ scores: { grotesque: 7, violence: 8 } }],
	},
}

test("there are 14 themes and 10 styles, each rule under its key and in the keys' order", () => {
	assert.equal(THEME_KEYS.length, 14)
	assert.equal(STYLE_KEYS.length, 10)
	assert.deepEqual(
		THEMES.map((theme) => theme.id),
		[...THEME_KEYS],
	)
	assert.deepEqual(
		STYLES.map((style) => style.id),
		[...STYLE_KEYS],
	)
	assert.deepEqual(
		THEMES.map((theme) => theme.name),
		[
			"Crime",
			"Mystery",
			"War",
			"Politics",
			"True stories",
			"History",
			"Growing up",
			"Family",
			"The mind",
			"Showbiz",
			"Sports",
			"Money",
			"Future",
			"Fantasy",
		],
	)
	assert.deepEqual(
		STYLES.map((style) => style.name),
		[
			"Animated",
			"Documentary",
			"Spectacle",
			"Stylized",
			"Music",
			"Slow burn",
			"Fast-paced",
			"Talky",
			"Nonlinear",
			"Graphic",
		],
	)
	for (const key of THEME_KEYS) assert.equal(THEME_BY_KEY[key].id, key)
	for (const key of STYLE_KEYS) assert.equal(STYLE_BY_KEY[key].id, key)
	for (const rule of [...THEMES, ...STYLES])
		assert.match(rule.color, /^#[0-9a-f]{6}$/)
	// The masks are 16 bits wide in the title snapshot.
	assert.ok(THEME_KEYS.length <= 16 && STYLE_KEYS.length <= 16)
	assert.deepEqual(Object.keys(THEME_CASES), [...THEME_KEYS])
	assert.deepEqual(Object.keys(STYLE_CASES), [...STYLE_KEYS])
})

test("every theme: a title at the rule's threshold has it and no other, one step short has none", () => {
	for (const [bit, key] of THEME_KEYS.entries()) {
		for (const title of THEME_CASES[key].has) {
			const mask = themeMaskOf(ordered(title.scores), title.genres ?? [])
			assert.equal(mask, 1 << bit, `${key} ${JSON.stringify(title)}`)
			assert.deepEqual(themesInMask(mask), [key])
			// The same answer for a fingerprint by key, as Crate stores it.
			assert.equal(
				themeMaskOf({ ...scoresByKey(), ...title.scores }, title.genres ?? []),
				mask,
			)
		}
		for (const title of THEME_CASES[key].lacks)
			assert.equal(
				themeMaskOf(ordered(title.scores), title.genres ?? []),
				0,
				`${key} ${JSON.stringify(title)}`,
			)
	}
})

test("every style: a title at the rule's threshold has it and no other, one step short has none", () => {
	for (const [bit, key] of STYLE_KEYS.entries()) {
		for (const title of STYLE_CASES[key].has) {
			const mask = styleMaskOf(ordered(title.scores), title.genres ?? [])
			assert.equal(mask, 1 << bit, `${key} ${JSON.stringify(title)}`)
			assert.deepEqual(stylesInMask(mask), [key])
			assert.equal(
				styleMaskOf({ ...scoresByKey(), ...title.scores }, title.genres ?? []),
				mask,
			)
		}
		for (const title of STYLE_CASES[key].lacks)
			assert.equal(
				styleMaskOf(ordered(title.scores), title.genres ?? []),
				0,
				`${key} ${JSON.stringify(title)}`,
			)
	}
})

const scoresByKey = (): Scores =>
	Object.fromEntries(VALID_FINGERPRINT_KEYS.map((key) => [key, 0]))

test("a title has several themes and styles at once, and genres never give a theme", () => {
	const fingerprint = ordered({
		crime: 9,
		mystery: 8,
		psychological: 10,
		slow_burn: 8,
		dialogue_centrality: 9,
	})
	assert.deepEqual(themesInMask(themeMaskOf(fingerprint, ["Animation"])), [
		"crime",
		"mystery",
		"mind",
	])
	assert.deepEqual(stylesInMask(styleMaskOf(fingerprint, ["Animation"])), [
		"animated",
		"slow",
		"talky",
	])
	assert.equal(themeMaskOf(ordered(), ["Crime", "War", "History"]), 0)
})

test("a missing score counts as 0, and a title without a title analysis has no theme and no style", () => {
	const MISSING = 255
	const some = ordered({ crime: 9, spectacle: 9 })
	// The score a rule reads is missing: the title is short of it, the rest still counts.
	const crime = VALID_FINGERPRINT_KEYS.indexOf("crime")
	const withoutCrime = Uint8Array.from(some, (v, k) =>
		k === crime ? MISSING : v,
	)
	assert.equal(themeMaskOf(withoutCrime, []), 0)
	assert.deepEqual(stylesInMask(styleMaskOf(withoutCrime, [])), ["spectacle"])
	// Fewer than 10 scores: no title analysis, so not even the genre styles.
	const bare = new Uint8Array(VALID_FINGERPRINT_KEYS.length).fill(MISSING)
	bare[crime] = 10
	assert.equal(themeMaskOf(bare, ["Animation"]), 0)
	assert.equal(styleMaskOf(bare, ["Animation", "Documentary"]), 0)
	assert.equal(themeMaskOf({ crime: 10 }, []), 0)
	assert.equal(styleMaskOf({ spectacle: 10 }, ["Animation"]), 0)
	assert.equal(themeMaskOf(null, ["Animation"]), 0)
	assert.equal(styleMaskOf(undefined, null), 0)
	// Ten scores are enough, and missing genres are none.
	const ten = new Uint8Array(VALID_FINGERPRINT_KEYS.length).fill(MISSING)
	for (let k = 0; k < 9; k++) ten[k === crime ? 9 : k] = 0
	ten[crime] = 8
	assert.deepEqual(themesInMask(themeMaskOf(ten, null)), ["crime"])
})

test("the chosen keys of a URL: known keys only, each once, in the given order, three at most", () => {
	assert.equal(MAX_THEMES, 3)
	assert.equal(MAX_STYLES, 3)
	const themes = (value: string | null) =>
		parseKeys(THEME_KEYS, value, MAX_THEMES)
	assert.deepEqual(themes("war,future"), ["war", "future"])
	assert.deepEqual(themes(" war , nope,, war,crime "), ["war", "crime"])
	assert.deepEqual(themes("war,future,crime,mind"), ["war", "future", "crime"])
	assert.deepEqual(themes(""), [])
	assert.deepEqual(themes(null), [])
	// A style is not a theme, and the other way round.
	assert.deepEqual(themes("slow,animated"), [])
	assert.deepEqual(parseKeys(STYLE_KEYS, "animated,slow,war", MAX_STYLES), [
		"animated",
		"slow",
	])
})

test("the mask of the chosen keys has the snapshot's bits", () => {
	assert.equal(maskOfKeys(THEME_KEYS, []), 0)
	assert.equal(maskOfKeys(THEME_KEYS, ["crime"]), 1)
	assert.equal(maskOfKeys(THEME_KEYS, ["war", "fantasy"]), (1 << 2) | (1 << 13))
	assert.equal(maskOfKeys(STYLE_KEYS, ["animated", "graphic"]), 1 | (1 << 9))
	// A title fits a choice when it shares a bit with it.
	const title = themeMaskOf(ordered({ warfare: 8 }), [])
	assert.ok(title & maskOfKeys(THEME_KEYS, ["crime", "war"]))
	assert.equal(title & maskOfKeys(THEME_KEYS, ["crime", "future"]), 0)
})

test("a fourth pick is refused and changes nothing; an unpick always works", () => {
	const three = ["war", "future", "crime"] as const
	assert.deepEqual(toggleKey(["war"], "future", MAX_THEMES), {
		chosen: ["war", "future"],
		refused: false,
	})
	assert.deepEqual(toggleKey(three, "mind", MAX_THEMES), {
		chosen: [...three],
		refused: true,
	})
	assert.deepEqual(toggleKey(three, "future", MAX_THEMES), {
		chosen: ["war", "crime"],
		refused: false,
	})
})

test("the Explorer's Theme and Style islands are these rules, in this order", () => {
	assert.equal(islands.THEMES.length, THEMES.length)
	assert.equal(islands.STYLES.length, STYLES.length)
	islands.THEMES.forEach((island, j) => assert.equal(island, THEMES[j]))
	islands.STYLES.forEach((island, j) => assert.equal(island, STYLES[j]))
})
