import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const {
	ratingCountryFor,
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
	resolveFilterChange,
} = await import("./filter-state.ts")

const defaults = { onMyServices: false, notSeenYet: false }
const parse = (query: string) =>
	filterStateFromParams(new URLSearchParams(query), defaults)

test("guest shared links hide member-only filters without changing Not seen yet", () => {
	for (const notSeenYet of [false, true]) {
		const guestDefaults = { ...defaults, notSeenYet }
		for (const query of [
			"wishlist=1",
			"seen=1&wishlist=1&match=outside",
			"seen=1&unseen=1&seen=1&wishlist=1&match=outside",
			"unseen=0&seen=1&wishlist=1&match=outside",
		]) {
			const params = new URLSearchParams(query)
			const state = filterStateFromParams(params, guestDefaults, false)
			const expectedUnseen = params.has("unseen")
				? params.get("unseen") === "1"
				: notSeenYet
			assert.equal(state.notSeenYet, expectedUnseen, query)
			assert.equal(state.seenBefore, undefined, query)
			const applied = stateAsApplied(state, null, false)
			assert.equal(applied.seenBefore, undefined)
			assert.equal(applied.onWishlist, undefined)
			assert.equal(applied.outsideUsual, undefined)
			assert.equal(applied.notSeenYet, expectedUnseen)
			assert.equal(secondaryFilterCount(applied), 0)
		}
	}
	const state = parse("seen=1&wishlist=1&match=outside&score=70&age=12")
	const ladder = {
		country: "DE",
		steps: [{ age: 12, label: "FSK 12" }],
		local: true,
	}
	assert.equal(stateAsApplied(state, ladder, true), state)
	const guest = stateAsApplied(state, ladder, false)
	assert.equal(guest.ageLimit, 12)
	assert.equal(guest.minScore, 70)
	assert.equal(secondaryFilterCount(guest), 2)
	assert.equal(secondaryFilterCount(stateAsApplied(state, null, false)), 1)
	assert.equal(state.seenBefore, true)
	assert.equal(state.onWishlist, true)
	assert.equal(state.outsideUsual, true)
})

test("the taste match filter reads from and writes to `match`", () => {
	assert.deepEqual([...MIN_MATCHES], [0, 60, 70, 80, 90])
	assert.ok(FILTER_NAMES.includes("minMatch"))
	assert.equal(defaultFilterState(defaults).minMatch, 0)
	assert.equal(parse("").minMatch, 0)
	for (const min of [60, 70, 80, 90] as const) {
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
	assert.equal(stateAsApplied(state, ladder, true), state)
	assert.equal(secondaryFilterCount(stateAsApplied(state, ladder, true)), 3)
	// No ladder (the age filter is off for the viewer, or no ratings), or the counts haven't arrived yet.
	for (const none of [null, undefined]) {
		const applied = stateAsApplied(state, none, true)
		assert.equal(applied.ageLimit, undefined)
		assert.equal(applied.content, undefined)
		assert.equal(applied.minScore, 70)
		assert.equal(secondaryFilterCount(applied), 1)
	}
	// The state itself keeps them, and so does the URL.
	assert.equal(state.ageLimit, 6)
	const plain = parse("score=70")
	assert.equal(stateAsApplied(plain, null, true), plain)
})

test("themes and styles read from and write to `themes` and `styles`, three of each at most", () => {
	assert.ok(FILTER_NAMES.includes("themes"))
	assert.ok(FILTER_NAMES.includes("styles"))
	assert.deepEqual(defaultFilterState(defaults).themes, [])
	assert.deepEqual(defaultFilterState(defaults).styles, [])
	assert.deepEqual(parse("").themes, [])
	assert.deepEqual(parse("").styles, [])

	const state = parse("themes=war,future&styles=animated,slow")
	assert.deepEqual(state.themes, ["war", "future"])
	assert.deepEqual(state.styles, ["animated", "slow"])
	const params = filterStateToParams(state, defaults)
	assert.equal(params.toString(), "themes=war%2Cfuture&styles=animated%2Cslow")
	assert.deepEqual(filterStateFromParams(params, defaults), state)
	assert.match(
		filterQuery(state, "popular", defaults),
		/themes=war%2Cfuture&styles=animated%2Cslow/,
	)

	// Three at most, in the order given; a key named twice counts once.
	assert.deepEqual(parse("themes=war,future,crime,mind").themes, [
		"war",
		"future",
		"crime",
	])
	assert.deepEqual(parse("styles=slow,slow,fast,talky,graphic").styles, [
		"slow",
		"fast",
		"talky",
	])
	// An unknown key is dropped, and so is a key of the other group or of the moods.
	assert.deepEqual(parse("themes=war,nope,slow,funny").themes, ["war"])
	assert.deepEqual(parse("styles=war,slow,feelgood").styles, ["slow"])
	assert.deepEqual(parse("themes=nope").themes, [])
	assert.equal(
		filterStateToParams(parse("themes=nope&styles=,"), defaults).toString(),
		"",
	)
	// A mood and a theme can share a key: each parameter reads its own.
	const shared = parse("moods=crime,history&themes=crime,history")
	assert.deepEqual(shared.moods, ["crime", "history"])
	assert.deepEqual(shared.themes, ["crime", "history"])
	// Writing over existing parameters removes the ones that no longer apply.
	assert.equal(
		filterStateToParams(
			parse(""),
			defaults,
			new URLSearchParams("themes=war&styles=slow&q=heat"),
		).toString(),
		"q=heat",
	)
})

test("themes and styles are filters of the Filters sheet", () => {
	const state = parse("themes=war,future&styles=slow&moods=funny&score=70")
	// Every chosen theme and style counts, as every mood does.
	assert.equal(secondaryFilterCount(state), 5)
	assert.deepEqual(dropFilter(state, "themes").themes, [])
	assert.deepEqual(dropFilter(state, "themes").styles, ["slow"])
	assert.deepEqual(dropFilter(state, "styles").styles, [])
	assert.deepEqual(dropFilter(state, "styles").themes, ["war", "future"])
	assert.deepEqual(dropFilter(state, "moods").themes, ["war", "future"])
	const cleared = clearSecondaryFilters(state)
	assert.deepEqual(cleared.themes, [])
	assert.deepEqual(cleared.styles, [])
	assert.equal(secondaryFilterCount(cleared), 0)
})

test("inline preferences preserve arbitrary lists, reject invalid ids, and clear with filters", () => {
	const loved = Array.from({ length: 45 }, (_, i) => i + 1)
	const state = parse(`loved=${loved.join(",")},1,-2,nope&disliked=46,47,47`)
	assert.deepEqual(state.loved, loved)
	assert.deepEqual(state.disliked, [46, 47])
	assert.deepEqual(
		parse(filterStateToParams(state, defaults).toString()),
		state,
	)
	assert.equal(secondaryFilterCount(state), 47)
	assert.equal(dropFilter(state, "loved").loved, undefined)
	assert.equal(clearSecondaryFilters(state).disliked, undefined)
	assert.deepEqual(parse("loved=1,2&disliked=2").loved, [1])
})

test("preferences expose typed TMDB ids while existing internal-key links still work", () => {
	const state = parse("loved=show:1416,movie:603&disliked=2000000004586")
	assert.deepEqual(state.loved, [2000000001416, 1000000000603])
	const params = filterStateToParams(state, defaults)
	assert.equal(params.get("loved"), "show:1416,movie:603")
	assert.equal(params.get("disliked"), "show:4586")
	assert.deepEqual(parse(params.toString()), state)
})

test("production countries round-trip, normalize, clear, and have no selection limit", () => {
	const state = parse("productionCountries=us, GB,us,nope,123,DE")
	assert.deepEqual(state.productionCountries, ["US", "GB", "DE"])
	assert.deepEqual(
		parse(filterStateToParams(state, defaults).toString()),
		state,
	)
	assert.equal(secondaryFilterCount(state), 3)
	assert.equal(
		dropFilter(state, "productionCountries").productionCountries,
		undefined,
	)
	assert.equal(clearSecondaryFilters(state).productionCountries, undefined)
})

test("manual services and streaming country travel together without changing production countries", () => {
	const state = parse(
		"services=8,337&streamingCountry=de&productionCountries=US,GB",
	)
	assert.equal(state.onMyServices, false)
	assert.deepEqual(state.services, [8, 337])
	assert.equal(state.streamingCountry, "DE")
	assert.deepEqual(state.productionCountries, ["US", "GB"])
	assert.deepEqual(
		parse(filterStateToParams(state, defaults).toString()),
		state,
	)
	assert.equal(dropFilter(state, "services").streamingCountry, undefined)
	assert.equal(clearSecondaryFilters(state).streamingCountry, undefined)
	assert.equal(parse("streamingCountry=bad").streamingCountry, undefined)
})

test("new filter URLs round trip and old range names become first-class filters", () => {
	for (const query of [
		"years=1990-2005",
		"years=1990-",
		"years=-2005",
		"runtime=0-90",
		"runtime=120-",
		"sources=imdb:80,rtCritics:90&gap=agree",
		"gap=critics",
		"gap=audience",
		"services=any&streamingCountry=DE",
	]) {
		const state = parse(query)
		assert.deepEqual(
			parse(filterStateToParams(state, defaults).toString()),
			state,
		)
	}
	const old = new URLSearchParams(
		"minYear=1990&maxYear=2005&minRuntime=0&maxRuntime=90&maxScore=80",
	)
	const state = filterStateFromParams(old, defaults)
	assert.deepEqual(state.years, { min: 1990, max: 2005 })
	assert.deepEqual(state.runtime, { min: 0, max: 90 })
	assert.deepEqual(state.legacy, { maxScore: "80" })
	const next = filterStateToParams(state, defaults, old)
	assert.equal(next.get("years"), "1990-2005")
	assert.equal(next.get("runtime"), "0-90")
	for (const name of ["minYear", "maxYear", "minRuntime", "maxRuntime"])
		assert.equal(next.has(name), false)
	assert.equal(parse("years=1990-&released=recent").released, "any")
	assert.deepEqual(parse("years=-2005&minYear=1990").years, { max: 2005 })
	for (const value of [
		"-",
		"-5-90",
		"90-0",
		"1.5-2",
		"NaN-",
		"9007199254740992-",
	])
		assert.equal(parse(`runtime=${value}`).runtime, undefined)
	assert.deepEqual(
		parse("sources=unknown:90,imdb:101,rtAudience:0,metacritic:75")
			.sourceScores,
		{ rtAudience: 0, metacritic: 75 },
	)
	assert.equal(parse("gap=invalid").scoreGap, undefined)
})

test("each new group drops independently and any service overrides saved services", () => {
	const state = parse(
		"years=1990-&runtime=0-90&sources=imdb:80&gap=agree&services=any&streamingCountry=DE",
	)
	assert.equal(secondaryFilterCount(state), 5)
	for (const name of [
		"years",
		"runtime",
		"sourceScores",
		"scoreGap",
	] as const) {
		assert.deepEqual(dropFilter(state, name), {
			...state,
			[name]: undefined,
			...(name === "runtime" ? { episodeRuntime: undefined } : {}),
		})
		assert.equal(clearSecondaryFilters(state)[name], undefined)
	}
	assert.equal(dropFilter(state, "services").anyService, undefined)
	assert.equal(clearSecondaryFilters(state).anyService, undefined)
	const mineDefaults = { onMyServices: true, notSeenYet: true }
	const any = filterStateFromParams(
		new URLSearchParams("services=any"),
		mineDefaults,
	)
	assert.equal(any.onMyServices, false)
	assert.equal(any.services, undefined)
	assert.equal(filterStateToParams(any, mineDefaults).get("services"), "any")
	assert.equal(parse("services=all").anyService, undefined)
	assert.equal(parse("services=mine").onMyServices, true)
	assert.deepEqual(parse("services=8,9").services, [8, 9])
})

test("tag groups opt into all of, with canonical round trips and old URLs unchanged", () => {
	assert.equal(parse("moods=funny,feelgood").allOf, undefined)
	const state = parse(
		"moods=funny,feelgood&themes=war,future&styles=animated&genres=Drama,Comedy&all=genres,moods,unknown,themes,moods,styles",
	)
	assert.deepEqual(state.allOf, ["moods", "themes", "genres"])
	const params = filterStateToParams(state, defaults)
	assert.equal(params.get("all"), "moods,themes,genres")
	assert.deepEqual(filterStateFromParams(params, defaults), state)
	for (const query of [
		"all=unknown",
		"moods=funny&all=moods",
		"moods=funny,funny&all=moods",
		"all=genres",
	])
		assert.equal(parse(query).allOf, undefined)
	const stale = filterStateToParams(
		{ ...state, moods: [], themes: [], genres: [] },
		defaults,
		params,
	)
	assert.equal(stale.has("all"), false)
	assert.equal(clearSecondaryFilters(state).allOf, undefined)
})

test("Seen before and Not seen yet exclude each other; the last enabled URL choice wins", () => {
	for (const memberDefaults of [defaults, { ...defaults, notSeenYet: true }]) {
		for (const [query, seen, unseen] of [
			["seen=1", true, false],
			["unseen=1&seen=1", true, false],
			["seen=1&unseen=1", false, true],
			["seen=1&unseen=1&seen=1", true, false],
			["unseen=1&seen=bogus", false, true],
			["seen=1&unseen=bogus", true, false],
			["seen=1&seen=0&unseen=0", false, false],
		] as const) {
			const state = filterStateFromParams(
				new URLSearchParams(query),
				memberDefaults,
			)
			assert.equal(!!state.seenBefore, seen, query)
			assert.equal(state.notSeenYet, unseen, query)
			assert.deepEqual(
				filterStateFromParams(
					filterStateToParams(state, memberDefaults),
					memberDefaults,
				),
				state,
			)
		}
	}
	const unseen = parse("unseen=1")
	const seen = resolveFilterChange(unseen, { ...unseen, seenBefore: true })
	assert.equal(seen.notSeenYet, false)
	assert.equal(seen.seenBefore, true)
	assert.equal(
		resolveFilterChange(seen, { ...seen, notSeenYet: true }).seenBefore,
		undefined,
	)
	assert.equal(dropFilter(seen, "notSeenYet").seenBefore, undefined)
})

test("Wishlist and outside choices round trip, clear and count as secondary filters", () => {
	for (const query of [
		"wishlist=1",
		"seen=1&wishlist=1",
		"unseen=1&wishlist=1",
		"match=outside",
		"seen=1&wishlist=1&match=outside",
	]) {
		const state = parse(query)
		assert.deepEqual(
			parse(filterStateToParams(state, defaults).toString()),
			state,
		)
	}
	const state = parse("seen=1&wishlist=1&match=outside")
	assert.equal(state.minMatch, 0)
	assert.equal(secondaryFilterCount(state), 3)
	assert.equal(dropFilter(state, "wishlist").onWishlist, undefined)
	assert.equal(dropFilter(state, "minMatch").outsideUsual, undefined)
	const cleared = clearSecondaryFilters(state)
	assert.equal(secondaryFilterCount(cleared), 0)
	assert.equal(cleared.seenBefore, undefined)
	assert.equal(cleared.onWishlist, undefined)
	assert.equal(cleared.outsideUsual, undefined)
	const outside = resolveFilterChange(parse("match=80"), {
		...parse("match=80"),
		outsideUsual: true,
	})
	assert.equal(outside.minMatch, 0)
	assert.equal(
		resolveFilterChange(outside, { ...outside, minMatch: 60 }).outsideUsual,
		undefined,
	)
	assert.equal(
		filterStateToParams(
			cleared,
			defaults,
			new URLSearchParams("seen=1&wishlist=1&match=outside&q=heat"),
		).toString(),
		"q=heat",
	)
})

test("Metacritic users round trip alongside older arbitrary source thresholds", () => {
	const state = parse("sources=metacriticUsers:70,imdb:65,metacritic:81")
	assert.deepEqual(state.sourceScores, {
		imdb: 65,
		metacritic: 81,
		metacriticUsers: 70,
	})
	const params = filterStateToParams(state, defaults)
	assert.equal(
		params.get("sources"),
		"imdb:65,metacritic:81,metacriticUsers:70",
	)
	assert.deepEqual(parse(params.toString()), state)
	assert.equal(secondaryFilterCount(state), 3)
	assert.equal(dropFilter(state, "sourceScores").sourceScores, undefined)
	for (const invalid of ["-1", "101", "7.5", "NaN"])
		assert.equal(
			parse(`sources=metacriticUsers:${invalid}`).sourceScores,
			undefined,
		)
})

test("rating country codec, defaults, validation and clearing", () => {
	const countries = ["DE", "US"]
	const state = parse("age=12&ratingCountry=%20de%20&streamingCountry=US")
	assert.equal(state.ratingCountry, "DE")
	assert.equal(state.streamingCountry, "US")
	assert.equal(state.ageLimit, 12)
	assert.equal(
		new URLSearchParams(filterQuery(state, "popular", defaults)).get(
			"ratingCountry",
		),
		"DE",
	)
	assert.deepEqual(parse(filterQuery(state, "popular", defaults)), state)
	assert.equal(parse("").ratingCountry, undefined)
	assert.equal(
		new URLSearchParams(filterQuery(parse(""), "popular", defaults)).has(
			"ratingCountry",
		),
		false,
	)
	assert.equal(ratingCountryFor(state, "GB", countries), "DE")
	assert.equal(
		ratingCountryFor(parse("streamingCountry=DE"), "US", countries),
		"DE",
	)
	assert.equal(ratingCountryFor(parse(""), "US", countries), "US")
	assert.equal(
		ratingCountryFor(parse("ratingCountry=ZZ"), "US", countries),
		"US",
	)
	assert.equal(
		ratingCountryFor(
			parse("ratingCountry=ZZ&streamingCountry=DE"),
			"US",
			countries,
		),
		"DE",
	)
	assert.equal(ratingCountryFor(state, "GB", []), "US")
	for (const code of ["", "D", "DEU", "12"])
		assert.equal(parse(`ratingCountry=${code}`).ratingCountry, undefined)
	assert.equal(clearSecondaryFilters(state).ratingCountry, undefined)
	const ladder = {
		country: "DE",
		steps: [{ age: 12, label: "FSK 12" }],
		local: true,
	}
	assert.equal(
		secondaryFilterCount(stateAsApplied(state, ladder, true, "US")),
		3,
	)
	assert.equal(stateAsApplied(state, null, true, "US").ratingCountry, undefined)
	assert.equal(
		stateAsApplied(parse("ratingCountry=ZZ"), ladder, true, "US").ratingCountry,
		undefined,
	)
	assert.equal(
		stateAsApplied(parse("ratingCountry=DE"), ladder, true, "DE").ratingCountry,
		undefined,
	)
})

test("episode length and Rest of the world round trip, reject malformed values, and clear with their groups", () => {
	const state = parse(
		"runtime=-120&episodeRuntime=20-45&restOfWorld=1&productionCountries=US",
	)
	assert.deepEqual(state.episodeRuntime, { min: 20, max: 45 })
	assert.equal(state.restOfWorld, true)
	assert.deepEqual(parse(filterQuery(state, "popular", defaults)), state)
	assert.equal(parse("episodeRuntime=any").episodeRuntime, null)
	assert.match(
		filterQuery(parse("runtime=-120&episodeRuntime=any"), "popular", defaults),
		/episodeRuntime=any/,
	)
	for (const value of ["", "-", "-5-30", "45-20", "no", "20.5-30"])
		assert.equal(parse(`episodeRuntime=${value}`).episodeRuntime, undefined)
	for (const value of ["", "0", "true", "2"])
		assert.equal(parse(`restOfWorld=${value}`).restOfWorld, undefined)
	assert.equal(dropFilter(state, "runtime").episodeRuntime, undefined)
	assert.equal(dropFilter(state, "productionCountries").restOfWorld, undefined)
	assert.equal(dropFilter(state, "runtime").restOfWorld, true)
	const cleared = clearSecondaryFilters(state)
	assert.equal(cleared.episodeRuntime, undefined)
	assert.equal(cleared.restOfWorld, undefined)
	assert.equal(
		secondaryFilterCount(parse("episodeRuntime=-35&restOfWorld=1")),
		2,
	)
})

test("unlimited episodes serialize only while a movie runtime bound remains", () => {
	const base = defaultFilterState({ onMyServices: false, notSeenYet: false })
	for (const runtime of [undefined, {}, { min: undefined, max: undefined }]) {
		const params = filterStateToParams(
			{ ...base, runtime, episodeRuntime: null },
			defaults,
		)
		assert.equal(params.has("episodeRuntime"), false)
		assert.equal(
			filterStateFromParams(params, defaults).episodeRuntime,
			undefined,
		)
	}
	for (const runtime of [{ min: 0 }, { max: 120 }, { min: 120, max: 180 }]) {
		const params = filterStateToParams(
			{ ...base, runtime, episodeRuntime: null },
			defaults,
		)
		assert.equal(params.get("episodeRuntime"), "any")
		assert.equal(filterStateFromParams(params, defaults).episodeRuntime, null)
	}
})

test("popularity ranges round trip, validate and clear together", () => {
	const state = parse("votes=10000-100000&rank=1-1000")
	assert.deepEqual(state.votes, { min: 10000, max: 100000 })
	assert.deepEqual(state.popularityRank, { min: 1, max: 1000 })
	assert.deepEqual(parse(filterQuery(state, "popular", defaults)), state)
	assert.equal(secondaryFilterCount(state), 2)
	for (const cleared of [
		dropFilter(state, "popularity"),
		clearSecondaryFilters(state),
	]) {
		assert.equal(cleared.votes, undefined)
		assert.equal(cleared.popularityRank, undefined)
	}
	for (const value of [
		"-",
		"-1-1000",
		"1000-1",
		"1.5-1000",
		"x-1000",
		"9007199254740992-",
	]) {
		assert.equal(parse(`votes=${value}&rank=${value}`).votes, undefined)
		assert.equal(
			parse(`votes=${value}&rank=${value}`).popularityRank,
			undefined,
		)
	}
	assert.deepEqual(parse("votes=-9999&rank=10001-").votes, { max: 9999 })
	assert.deepEqual(parse("votes=-9999&rank=10001-").popularityRank, {
		min: 10001,
	})
	assert.equal(
		filterQuery(defaultFilterState(defaults), "popular", defaults).includes(
			"rank=",
		),
		false,
	)
})

test("budget and shows decimal ranges round trip, clear and recover as groups", () => {
	const s = parse(
		"budget=5-49.999&boxOffice=100-&returns=hit&seasons=2-3&showStatus=ended&hours=10-29.983333333333334",
	)
	assert.deepEqual(s.budget, { min: 5, max: 49.999 })
	assert.deepEqual(parse(filterStateToParams(s, defaults).toString()), s)
	assert.equal(secondaryFilterCount(s), 6)
	const b = dropFilter(s, "budget"),
		h = dropFilter(s, "shows")
	for (const field of ["budget", "boxOffice", "returns"] as const)
		assert.equal(b[field], undefined)
	for (const field of ["seasons", "showStatus", "hours"] as const)
		assert.equal(h[field], undefined)
	assert.equal(secondaryFilterCount(clearSecondaryFilters(s)), 0)
	for (const query of [
		"budget=-1-5",
		"budget=5-1",
		"hours=NaN-10",
		"seasons=1.5-2",
		"returns=unknown&showStatus=unknown",
	]) {
		const invalid = parse(query)
		for (const field of [
			"budget",
			"hours",
			"seasons",
			"returns",
			"showStatus",
		] as const)
			assert.equal(invalid[field], undefined, query)
	}
})

test("facts-only filters look applied only when facts are available, retaining URL state", () => {
	const state = parse(
		"budget=5-10&boxOffice=100-&returns=hit&seasons=2-3&showStatus=ended&hours=10-20",
	)
	for (const facts of [true, undefined])
		assert.equal(stateAsApplied(state, null, true, "US", facts), state)
	const applied = stateAsApplied(state, null, true, "US", false)
	for (const field of [
		"budget",
		"boxOffice",
		"returns",
		"seasons",
		"showStatus",
		"hours",
	] as const) {
		assert.equal(applied[field], undefined)
		assert.notEqual(state[field], undefined)
	}
	assert.equal(secondaryFilterCount(applied), 0)
})

test("absent or invalid returns and show status do not add parser properties", () => {
	for (const query of ["", "returns=unknown&showStatus=running,ended"]) {
		const state = parse(query)
		assert.equal(Object.prototype.hasOwnProperty.call(state, "returns"), false)
		assert.equal(
			Object.prototype.hasOwnProperty.call(state, "showStatus"),
			false,
		)
	}
})

test("taste keys parse, deduplicate, cap at three and round trip including legacy references", () => {
	const state = parse(
		"taste=bad,movie-603,show-1399,movie-603,2,show-3,0,movie-0,movie--1",
	)
	assert.deepEqual(state.tasteGroups, ["movie-603", "show-1399", "2"])
	assert.equal(
		filterStateToParams(state, defaults).get("taste"),
		"movie-603,show-1399,2",
	)
	assert.deepEqual(
		parse(filterStateToParams(state, defaults).toString()),
		state,
	)
	assert.equal(
		parse("taste=none,g1,movie-0,movie-12345678901").tasteGroups,
		undefined,
	)
	assert.equal(dropFilter(state, "tasteGroups").tasteGroups, undefined)
	assert.equal(
		filterStateToParams(dropFilter(state, "tasteGroups"), defaults).get(
			"taste",
		),
		null,
	)
})

test("taste picks stay in guest URLs but are omitted from applied chips", () => {
	const state = parse("taste=movie-603")
	assert.equal(stateAsApplied(state, null, false).tasteGroups, undefined)
	assert.deepEqual(state.tasteGroups, ["movie-603"])
})
