import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { FILTER_NAMES, MIN_MATCHES, defaultFilterState, stateAsApplied } =
	await import("~/domain/filter-state")
const { CONTENT_KINDS, PLAIN_LADDER } = await import("~/domain/age-content")
const {
	CONTENT_LABELS,
	DISCOVER_SORTS,
	FILTER_ACCENTS,
	MATCH_LABELS,
	RATE_MORE,
	activeChips,
	ageContentSummary,
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
	const dots = FILTER_NAMES.map((name) => FILTER_ACCENTS[name].dot)
	assert.equal(new Set(dots).size, dots.length)
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

test("the closed Age & content control says the limit and what the person changed", () => {
	const summary = (
		ageLimit: number | undefined,
		content?: Record<string, "hide" | "show">,
	) => ageContentSummary({ ageLimit, content }, FSK)

	assert.deepEqual(summary(undefined), {
		badge: null,
		text: null,
		more: 0,
		hiding: null,
	})
	// What the limit sets by itself isn't a change, but the tooltip lists it.
	assert.deepEqual(summary(12), {
		badge: "FSK 12",
		text: null,
		more: 0,
		hiding: "Hiding violence, sex & nudity",
	})
	assert.equal(summary(12, { disturbing: "hide" }).text, "no disturbing scenes")
	assert.equal(summary(12, { violence: "show" }).text, "violence OK")
	assert.equal(summary(12, { violence: "show" }).hiding, "Hiding sex & nudity")
	assert.equal(
		summary(12, { violence: "show", disturbing: "hide" }).text,
		"2 changes",
	)
	// An override equal to what the limit sets is no change.
	assert.equal(summary(12, { violence: "hide" }).text, null)
	assert.equal(summary(18).hiding, null)

	// Age 0 is a limit, and an age that isn't a step stands for the step below it.
	assert.equal(summary(0).badge, "FSK 0")
	assert.equal(summary(0).hiding?.split(", ").length, 5)
	assert.equal(summary(14).badge, "FSK 12")
	assert.equal(ageContentSummary({ ageLimit: 16 }, PLAIN_LADDER).badge, "16+")

	// Limit off: the first hidden kind, and how many more.
	assert.deepEqual(summary(undefined, { violence: "hide" }), {
		badge: null,
		text: "no violence",
		more: 0,
		hiding: "Hiding violence",
	})
	const two = summary(undefined, { drugs: "hide", violence: "hide" })
	assert.equal(two.text, "no violence")
	assert.equal(two.more, 1)
	assert.equal(two.hiding, "Hiding violence, drugs")
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
	assert.equal(ageContentSummary(same, FSK).text, null)
	// At a limit that shows drugs by itself, the same choice is a change again.
	assert.deepEqual(
		activeChips({ ...same, ageLimit: 16 }).map((chip) => chip.label),
		["Age limit 16", "No drugs"],
	)
	assert.equal(
		ageContentSummary({ ...same, ageLimit: 16 }, FSK).text,
		"no drugs",
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
