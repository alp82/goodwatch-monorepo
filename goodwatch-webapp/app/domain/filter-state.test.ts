import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	FILTER_NAMES,
	MIN_MATCHES,
	clearSecondaryFilters,
	defaultFilterState,
	dropFilter,
	filterQuery,
	filterStateFromParams,
	filterStateToParams,
	secondaryFilterCount,
	sortFromParams,
	stateAsApplied,
} = await import("./filter-state.ts")

const defaults = { onMyServices: false, notSeenYet: false }
const parse = (query: string) =>
	filterStateFromParams(new URLSearchParams(query), defaults)

test("the taste match filter reads from and writes to `match`", () => {
	assert.deepEqual([...MIN_MATCHES], [0, 70, 80, 90])
	assert.ok(FILTER_NAMES.includes("minMatch"))
	assert.equal(defaultFilterState(defaults).minMatch, 0)
	assert.equal(parse("").minMatch, 0)
	for (const min of [70, 80, 90] as const) {
		const state = parse(`match=${min}`)
		assert.equal(state.minMatch, min)
		assert.equal(filterStateToParams(state, defaults).get("match"), String(min))
		assert.deepEqual(
			filterStateFromParams(filterStateToParams(state, defaults), defaults),
			state,
		)
	}
	// 0 is left out, and so is anything that isn't an option.
	assert.equal(
		filterStateToParams(parse("match=0"), defaults).has("match"),
		false,
	)
	assert.equal(parse("match=85").minMatch, 0)
	assert.equal(parse("match=abc").minMatch, 0)
	// Writing over existing parameters removes a `match` that no longer applies.
	const params = filterStateToParams(
		parse(""),
		defaults,
		new URLSearchParams("match=80&q=heat"),
	)
	assert.equal(params.toString(), "q=heat")
})

test("the taste match filter is a filter of the Filters sheet", () => {
	const state = parse("match=80&score=70")
	assert.equal(secondaryFilterCount(state), 2)
	assert.equal(dropFilter(state, "minMatch").minMatch, 0)
	assert.equal(dropFilter(state, "minMatch").minScore, 70)
	assert.equal(clearSecondaryFilters(state).minMatch, 0)
	assert.match(filterQuery(state, "match", defaults), /match=80/)
})

test("Best match is a sort, browsing and searching", () => {
	const sort = (query: string, searching: boolean) =>
		sortFromParams(new URLSearchParams(query), searching)
	assert.equal(sort("sort=match", false), "match")
	assert.equal(sort("sort=match", true), "match")
	assert.equal(sort("", false), "popular")
	assert.equal(sort("", true), "relevance")
	assert.equal(sort("sort=relevance", false), "popular")
	assert.match(filterQuery(parse(""), "match", defaults), /sort=match/)
})

test("the age limit and content overrides read from and write to `age`, `hide`, and `ok`", () => {
	assert.ok(FILTER_NAMES.includes("ageLimit"))
	assert.ok(FILTER_NAMES.includes("content"))
	assert.equal(parse("").ageLimit, undefined)
	assert.equal(parse("").content, undefined)
	// 0 is a limit, not off.
	assert.equal(parse("age=0").ageLimit, 0)
	assert.equal(filterStateToParams(parse("age=0"), defaults).get("age"), "0")
	for (const bad of ["age=", "age=19", "age=-1", "age=1.5", "age=abc"])
		assert.equal(parse(bad).ageLimit, undefined)

	const state = parse("age=12&hide=disturbing,drugs&ok=violence")
	assert.equal(state.ageLimit, 12)
	assert.deepEqual(state.content, {
		violence: "show",
		disturbing: "hide",
		drugs: "hide",
	})
	const params = filterStateToParams(state, defaults)
	assert.equal(params.toString(), "age=12&hide=disturbing%2Cdrugs&ok=violence")
	assert.deepEqual(filterStateFromParams(params, defaults), state)
	assert.match(filterQuery(state, "popular", defaults), /age=12&hide=/)

	// An override is kept as given, also one equal to what the limit sets, reading and writing; unknown kinds go.
	const same = parse("age=12&hide=violence,disturbing&ok=drugs,nope")
	assert.deepEqual(same.content, {
		violence: "hide",
		disturbing: "hide",
		drugs: "show",
	})
	assert.equal(
		filterStateToParams(same, defaults).toString(),
		"age=12&hide=violence%2Cdisturbing&ok=drugs",
	)
	assert.deepEqual(parse("ok=violence,sex").content, {
		violence: "show",
		sex: "show",
	})
	assert.equal(
		filterStateToParams(
			{ ...parse("age=16"), content: { violence: "show", sex: "hide" } },
			defaults,
		).toString(),
		"age=16&hide=sex&ok=violence",
	)
	// A kind named in both is hidden.
	assert.deepEqual(parse("hide=disturbing&ok=disturbing").content, {
		disturbing: "hide",
	})
	// Writing over existing parameters removes the ones that no longer apply.
	assert.equal(
		filterStateToParams(
			parse(""),
			defaults,
			new URLSearchParams("age=12&hide=disturbing&ok=sex&q=heat"),
		).toString(),
		"q=heat",
	)
	// The old age rating parameters stay ignored.
	const old = parse("minAgeRating=6&maxAgeRating=12")
	assert.equal(old.ageLimit, undefined)
	assert.equal(old.legacy, undefined)
})

test("the age limit sets what content hides, and overrides survive a change of the limit", async () => {
	const {
		changedContent,
		defaultHiddenKinds,
		hiddenContentBits,
		hiddenKinds,
		showAllContent,
		withContentChoice,
	} = await import("./age-content.ts")
	const all = ["violence", "sex", "disturbing", "language", "drugs"]
	assert.deepEqual(defaultHiddenKinds(undefined), [])
	assert.deepEqual(defaultHiddenKinds(0), all)
	assert.deepEqual(defaultHiddenKinds(6), all)
	assert.deepEqual(defaultHiddenKinds(7), ["violence", "sex"])
	assert.deepEqual(defaultHiddenKinds(12), ["violence", "sex"])
	assert.deepEqual(defaultHiddenKinds(13), [])
	assert.deepEqual(defaultHiddenKinds(18), [])

	// Violence is OK and disturbing scenes aren't, whatever the limit.
	const content = { violence: "show", disturbing: "hide" } as const
	assert.deepEqual(hiddenKinds(12, content), ["sex", "disturbing"])
	assert.deepEqual(hiddenKinds(6, content), [
		"sex",
		"disturbing",
		"language",
		"drugs",
	])
	assert.deepEqual(hiddenKinds(16, content), ["disturbing"])
	assert.deepEqual(hiddenKinds(undefined, content), ["disturbing"])
	assert.equal(hiddenContentBits(12, content), 0b00110)
	assert.equal(hiddenContentBits(undefined, undefined), 0)

	// Changing the limit keeps the overrides, in the state and in the URL, also where the limit sets the same.
	const state = parse("age=12&ok=violence&hide=disturbing")
	const younger = { ...state, ageLimit: 6 }
	assert.deepEqual(hiddenKinds(younger.ageLimit, younger.content), [
		"sex",
		"disturbing",
		"language",
		"drugs",
	])
	assert.equal(
		filterStateToParams(younger, defaults).toString(),
		"age=6&hide=disturbing&ok=violence",
	)
	assert.equal(
		filterStateToParams({ ...state, ageLimit: 16 }, defaults).toString(),
		"age=16&hide=disturbing&ok=violence",
	)

	// Setting a kind back to what the limit sets removes the override.
	assert.deepEqual(withContentChoice(12, content, "violence", "hide"), {
		disturbing: "hide",
	})
	assert.deepEqual(withContentChoice(12, undefined, "sex", "show"), {
		sex: "show",
	})
	assert.equal(withContentChoice(12, undefined, "sex", "hide"), undefined)
	// The other kinds' overrides stay, also one the limit sets anyway.
	assert.deepEqual(withContentChoice(6, { drugs: "hide" }, "sex", "show"), {
		drugs: "hide",
		sex: "show",
	})
	// What shows as changed leaves out the overrides the limit sets anyway.
	assert.equal(changedContent(16, { violence: "show" }), undefined)
	assert.deepEqual(changedContent(12, { violence: "hide", drugs: "hide" }), {
		drugs: "hide",
	})
	assert.deepEqual(showAllContent(12), { violence: "show", sex: "show" })
	assert.equal(showAllContent(16), undefined)
})

test("the age limit and content are filters of the Filters sheet", () => {
	const state = parse("age=12&ok=violence&hide=disturbing&score=70")
	assert.equal(secondaryFilterCount(state), 4)
	// Without the limit the overrides stay; the one that showed violence no longer counts as a change.
	const noLimit = dropFilter(state, "ageLimit")
	assert.equal(noLimit.ageLimit, undefined)
	assert.deepEqual(noLimit.content, { violence: "show", disturbing: "hide" })
	assert.equal(secondaryFilterCount(noLimit), 2)
	// Switched on again, violence is still OK.
	assert.deepEqual(
		filterStateFromParams(
			filterStateToParams({ ...noLimit, ageLimit: 12 }, defaults),
			defaults,
		),
		state,
	)
	// Content at its widest shows every kind under the limit.
	const widest = dropFilter(state, "content")
	assert.equal(widest.ageLimit, 12)
	assert.deepEqual(widest.content, { violence: "show", sex: "show" })
	assert.equal(
		dropFilter(parse("hide=disturbing"), "content").content,
		undefined,
	)
	const cleared = clearSecondaryFilters(state)
	assert.equal(cleared.ageLimit, undefined)
	assert.equal(cleared.content, undefined)
})

test("an age picks its ladder step, and a title its label", async () => {
	const { PLAIN_LADDER, ladderStepFor, ratingBadge, ratingLabel } =
		await import("./age-content.ts")
	const US = [
		{ age: 0, label: "G", show: "TV-G" },
		{ age: 8, label: "PG", show: "TV-PG" },
		{ age: 14, label: "PG-13", show: "TV-14" },
		{ age: 17, label: "R", show: "TV-MA" },
	]
	const DE = [0, 6, 12, 16, 18].map((age) => ({ age, label: `FSK ${age}` }))
	// A shared link's age that isn't a step: the highest step at or below it, or the lowest step.
	assert.equal(ladderStepFor(US, 12).label, "PG")
	assert.equal(ladderStepFor(US, 14).label, "PG-13")
	assert.equal(ladderStepFor(US, 18).label, "R")
	assert.equal(ladderStepFor(DE, 17).label, "FSK 16")
	assert.equal(
		ladderStepFor([{ age: 6, label: "6" }, ...DE.slice(2)], 0).age,
		6,
	)
	assert.deepEqual(
		PLAIN_LADDER.map((step) => step.label),
		["0+", "6+", "12+", "16+", "18+"],
	)
	// A title falls under the lowest step at or above its age; a show takes the show rating.
	assert.equal(ratingLabel(US, 13, false), "PG-13")
	assert.equal(ratingLabel(US, 13, true), "TV-14")
	assert.equal(ratingLabel(US, 18, false), "R")
	assert.equal(ratingLabel(DE, 12, true), "FSK 12")
	assert.deepEqual(ratingBadge(DE, 12, 14, false), {
		label: "FSK 12",
		estimated: false,
	})
	assert.deepEqual(ratingBadge(DE, null, 14, false), {
		label: "~14",
		estimated: true,
	})
	assert.equal(ratingBadge(DE, null, null, false), null)
})

test("a content choice survives the limits that set the same by themselves", async () => {
	const { hiddenKinds, withContentChoice } = await import("./age-content.ts")
	// Every step goes through the URL, as in the browser.
	const through = (state: ReturnType<typeof parse>) =>
		filterStateFromParams(filterStateToParams(state, defaults), defaults)
	const hidden = (state: ReturnType<typeof parse>) =>
		hiddenKinds(state.ageLimit, state.content)

	// Limit off, hide drugs.
	let state = parse("")
	state = through({
		...state,
		content: withContentChoice(state.ageLimit, state.content, "drugs", "hide"),
	})
	assert.deepEqual(hidden(state), ["drugs"])
	// The age 6 step hides drugs anyway: the choice stays, and isn't shown as a change.
	state = through({ ...state, ageLimit: 6 })
	assert.deepEqual(state.content, { drugs: "hide" })
	assert.equal(
		filterStateToParams(state, defaults).toString(),
		"age=6&hide=drugs",
	)
	assert.equal(secondaryFilterCount(state), 1)
	// The age 16 step: drugs are still hidden.
	state = through({ ...state, ageLimit: 16 })
	assert.deepEqual(hidden(state), ["drugs"])
	assert.equal(secondaryFilterCount(state), 2)
	// Only setting the kind back takes the choice away.
	state = through({
		...state,
		content: withContentChoice(state.ageLimit, state.content, "drugs", "show"),
	})
	assert.equal(state.content, undefined)
	assert.deepEqual(hidden(state), [])
})

test("without the viewer's ladder the age limit and content don't count as applied", () => {
	const ladder = {
		country: "DE",
		steps: [
			{ age: 0, label: "FSK 0" },
			{ age: 12, label: "FSK 12" },
		],
		local: true,
	}
	const state = parse("age=6&hide=drugs&ok=violence&score=70")
	assert.equal(stateAsApplied(state, ladder), state)
	assert.equal(secondaryFilterCount(stateAsApplied(state, ladder)), 3)
	// No ladder (the age filter is off for the viewer, or no ratings), or the counts haven't arrived yet.
	for (const none of [null, undefined]) {
		const applied = stateAsApplied(state, none)
		assert.equal(applied.ageLimit, undefined)
		assert.equal(applied.content, undefined)
		assert.equal(applied.minScore, 70)
		assert.equal(secondaryFilterCount(applied), 1)
	}
	// The state itself keeps them, and so does the URL.
	assert.equal(state.ageLimit, 6)
	const plain = parse("score=70")
	assert.equal(stateAsApplied(plain, null), plain)
})
