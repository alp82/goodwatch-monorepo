import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { defaultFilterState, filterStateFromParams, filterStateToParams } =
	await import("~/domain/filter-state")
const { GUEST_MIXES } = await import("~/domain/mood-mixes")
const {
	applyMix,
	barScale,
	clearedQuery,
	comboCards,
	genreOptions,
	groupsNeedingCleared,
	modeOf,
	moodOptionsOf,
	moodRows,
	optionCount,
	pickCount,
	setMode,
	togglePick,
} = await import("./mood-model.ts")

type State = ReturnType<typeof defaultFilterState>
const defaults = { onMyServices: false, notSeenYet: false }
const empty = defaultFilterState(defaults)
const url = (state: State) => filterStateToParams(state, defaults).toString()
const optionOf = (
	state: State,
	group: "moods" | "themes" | "styles" | "genres",
	id: string,
) => {
	const option = moodOptionsOf(state, {
		genres: { Action: 1, "Action & Adventure": 1, Drama: 1, Adventure: 1 },
	})[group].find((o) => o.id === id)
	assert.ok(option, `${group}:${id}`)
	return option
}

test("Feel lists the feel moods; a picked topic mood shows too", () => {
	const names = moodOptionsOf(empty, null).moods.map((o) => o.name)
	assert.deepEqual(names, [
		"Funny",
		"Cozy",
		"Romantic",
		"Thrilling",
		"Scary",
		"Trippy",
		"Sad",
		"Tense",
		"Dark",
		"Deep",
		"Magical",
		"Quirky",
	])
	const withCrime = { ...empty, moods: ["crime" as const] }
	assert.ok(moodOptionsOf(withCrime, null).moods.some((o) => o.id === "crime"))
	assert.equal(moodOptionsOf(empty, null).themes.length, 14)
	assert.equal(moodOptionsOf(empty, null).styles.length, 10)
})

test("folded genres are one unit", () => {
	const units = genreOptions(empty, [
		"Action",
		"Action & Adventure",
		"Drama",
		"Adventure",
	])
	assert.deepEqual(
		units.map((u) => [u.id, u.values]),
		[
			["Action", ["Action", "Action & Adventure"]],
			["Adventure", ["Adventure", "Action & Adventure"]],
			["Drama", ["Drama"]],
		],
	)
	const action = optionOf(empty, "genres", "Action")
	const picked = togglePick(empty, action, {})
	assert.ok(picked)
	assert.deepEqual(picked.state.genres, ["Action", "Action & Adventure"])
	assert.equal(pickCount(picked.state, "genres"), 1)
	// Adventure shares Action & Adventure: dropping Adventure keeps it for Action.
	const both = togglePick(
		picked.state,
		optionOf(picked.state, "genres", "Adventure"),
		picked.prefs,
	)
	assert.ok(both)
	assert.equal(pickCount(both.state, "genres"), 2)
	const back = togglePick(
		both.state,
		optionOf(both.state, "genres", "Adventure"),
		both.prefs,
	)
	assert.ok(back)
	assert.deepEqual(back.state.genres, ["Action", "Action & Adventure"])
})

test("the URL gets all=<group> only from two picks on an all-of column", () => {
	const funny = optionOf(empty, "moods", "funny")
	const one = togglePick(empty, funny, {})
	assert.ok(one)
	assert.equal(new URLSearchParams(url(one.state)).has("all"), false)
	const two = togglePick(
		one.state,
		optionOf(one.state, "moods", "feelgood"),
		one.prefs,
	)
	assert.ok(two)
	assert.equal(new URLSearchParams(url(two.state)).get("all"), "moods")
	// The switch to any of drops it; back to all of brings it back.
	const any = setMode(two.state, "moods", "any", two.prefs)
	assert.equal(new URLSearchParams(url(any.state)).has("all"), false)
	assert.equal(modeOf(any.state, "moods", any.prefs), "any")
	const all = setMode(any.state, "moods", "all", any.prefs)
	assert.equal(new URLSearchParams(url(all.state)).get("all"), "moods")
	// Down to one pick: no all, the switch stays where it was.
	const down = togglePick(
		all.state,
		optionOf(all.state, "moods", "funny"),
		all.prefs,
	)
	assert.ok(down)
	assert.equal(new URLSearchParams(url(down.state)).has("all"), false)
	assert.equal(modeOf(down.state, "moods", down.prefs), "all")
})

test("a link without all is any of, and a third pick keeps it any of", () => {
	const linked = filterStateFromParams(
		new URLSearchParams("moods=funny,feelgood"),
		defaults,
	)
	assert.equal(modeOf(linked, "moods", {}), "any")
	const three = togglePick(linked, optionOf(linked, "moods", "romance"), {})
	assert.ok(three)
	assert.equal(three.state.allOf, undefined)
})

test("caps refuse a fourth mood, theme or style", () => {
	const state = {
		...empty,
		moods: ["funny", "feelgood", "romance"] as State["moods"],
	}
	assert.equal(togglePick(state, optionOf(state, "moods", "scary"), {}), null)
	const rows = moodRows(moodOptionsOf(state, null).moods, {
		state,
		prefs: {},
		total: 10,
		counts: { moods: { scary: 5 } },
		cleared: {},
	})
	assert.ok(rows.find((r) => r.id === "scary")?.dead)
})

test("counts follow each column's mode", () => {
	const counts = { moods: { funny: 900, feelgood: 400, scary: 700 } }
	// No pick: the titles with the option.
	assert.equal(
		optionCount(optionOf(empty, "moods", "scary"), {
			state: empty,
			prefs: {},
			total: 1000,
			counts,
			cleared: {},
		}),
		700,
	)
	// One pick on all of: P and X = P + X - (P or X), with X from the answer without the pick.
	const one = { ...empty, moods: ["funny"] as State["moods"] }
	assert.deepEqual(groupsNeedingCleared(one, {}), ["moods"])
	assert.equal(
		optionCount(optionOf(one, "moods", "scary"), {
			state: one,
			prefs: {},
			total: 300,
			counts,
			cleared: { moods: { scary: 500 } },
		}),
		300 + 500 - 700,
	)
	// Without that answer yet: no count.
	assert.equal(
		optionCount(optionOf(one, "moods", "scary"), {
			state: one,
			prefs: {},
			total: 300,
			counts,
			cleared: {},
		}),
		null,
	)
	// One pick on any of: the server's widening count.
	assert.deepEqual(groupsNeedingCleared(one, { moods: "any" }), [])
	assert.equal(
		optionCount(optionOf(one, "moods", "scary"), {
			state: one,
			prefs: { moods: "any" },
			total: 300,
			counts,
			cleared: {},
		}),
		700,
	)
	// A picked option shows its removal count.
	assert.equal(
		optionCount(optionOf(one, "moods", "funny"), {
			state: one,
			prefs: {},
			total: 300,
			counts,
			cleared: {},
		}),
		900,
	)
})

test("genre units count once under each mode", () => {
	const counts = {
		genres: {
			Action: 120,
			"Action & Adventure": 30,
			Drama: 500,
			Adventure: 80,
		},
	}
	const inputs = (state: State, total: number, cleared = {}) => ({
		state,
		prefs: {},
		total,
		counts,
		cleared,
	})
	assert.equal(
		optionCount(optionOf(empty, "genres", "Action"), inputs(empty, 2000)),
		150,
	)
	// Drama picked, any of: Action widens the list by what both names add.
	const drama = { ...empty, genres: ["Drama"] }
	const anyOf = { ...inputs(drama, 500), prefs: { genres: "any" as const } }
	// Each name's count is the list plus what it adds; the unit adds both names' additions: 500 + 60 + 20.
	assert.equal(
		optionCount(optionOf(drama, "genres", "Action"), {
			...anyOf,
			counts: {
				genres: { Action: 560, "Action & Adventure": 520, Drama: 500 },
			},
		}),
		580,
	)
	// Drama picked, all of (one pick): P + X - (P or X), X the unit's titles without the pick.
	assert.equal(
		optionCount(optionOf(drama, "genres", "Action"), {
			...inputs(drama, 500, {
				genres: { Action: 120, "Action & Adventure": 30 },
			}),
			counts: {
				genres: { Action: 560, "Action & Adventure": 520, Drama: 500 },
			},
		}),
		500 + 150 - 580,
	)
	// Two picks on all of: the server counts the unit under its first name.
	const two = {
		...empty,
		genres: ["Drama", "Comedy"],
		allOf: ["genres" as const],
	}
	assert.equal(
		optionCount(optionOf(two, "genres", "Action"), inputs(two, 40)),
		120,
	)
})

test("cleared queries drop the group and its all entry", () => {
	assert.equal(
		clearedQuery(
			"moods=funny&themes=war,future&all=moods,themes&page=2&ranked=1,2",
			"moods",
		),
		"themes=war%2Cfuture&all=themes&ranked=1%2C2",
	)
	assert.equal(clearedQuery("moods=funny&all=moods", "moods"), "")
})

test("a ready mix replaces Feel, About and Style and writes no all", () => {
	const mix = GUEST_MIXES[0]
	const state = {
		...empty,
		moods: ["funny", "scary"] as State["moods"],
		allOf: ["moods" as const],
		genres: ["Drama"],
	}
	const next = applyMix(state, mix, {})
	assert.deepEqual(next.moods, ["feelgood"])
	assert.deepEqual(next.styles, ["animated"])
	assert.deepEqual(next.genres, ["Drama"])
	assert.equal(next.allOf, undefined)
	assert.equal(new URLSearchParams(url(next)).has("all"), false)
	// Tapping it again clears it.
	assert.deepEqual(applyMix(next, mix, {}).moods, [])
})

const mixes = GUEST_MIXES.map((mix, i) => ({
	...mix,
	count: i === 1 ? 0 : 100 + i,
	topTitle: { title: `Top ${i}`, backdrop_path: `/b${i}.jpg` },
}))

test("Combos without picks: ready mixes with titles, then the rest without counts", () => {
	const cards = comboCards({
		mixes,
		rows: [],
		state: empty,
		total: 5000,
		searching: false,
		slots: 8,
	})
	assert.equal(cards.length, 8)
	assert.equal(cards[0].name, "Cozy + Animated")
	assert.equal(cards[0].line, "Like Top 0")
	assert.equal(cards[0].n, 100)
	// The mix with no titles goes last, without a count.
	assert.equal(cards[7].id, `mix:${GUEST_MIXES[1].id}`)
	assert.equal(cards[7].n, null)
	// While searching: no counts and no Like line.
	const searching = comboCards({
		mixes,
		rows: [],
		state: empty,
		total: 40,
		searching: true,
		slots: 6,
	})
	assert.equal(searching.length, 6)
	assert.ok(searching.every((c) => c.n === null && c.line === null))
})

test("Combos with picks: + X cards that narrow lead, the mix that is on goes last", () => {
	const state = applyMix(empty, GUEST_MIXES[0], {})
	const options = moodOptionsOf(state, null)
	const counts = {
		moods: { funny: 2600, feelgood: 2000, scary: 2000 },
		themes: { family: 900, crime: 2000 },
		styles: { animated: 2000 },
	}
	const rows = [
		...moodRows(options.moods, {
			state,
			prefs: {},
			total: 2000,
			counts,
			cleared: { moods: { funny: 1000 } },
		}),
		...moodRows(options.themes, {
			state,
			prefs: {},
			total: 2000,
			counts,
			cleared: {},
		}),
		...moodRows(options.styles, {
			state,
			prefs: {},
			total: 2000,
			counts,
			cleared: { styles: {} },
		}),
	]
	const cards = comboCards({
		mixes,
		rows,
		state,
		total: 2000,
		searching: false,
		slots: 8,
	})
	assert.equal(cards.length, 8)
	assert.ok(!cards.some((c) => c.on))
	// Family keeps 900 of 2,000; Funny (all of, one pick) 2,000 + 1,000 - 2,600 = 400; Crime keeps them all.
	assert.equal(cards[0].id, "add:themes:family")
	assert.equal(cards[0].share, 900 / 2000)
	assert.equal(cards[1].id, "add:moods:funny")
	assert.equal(cards[1].n, 400)
	assert.ok(!cards.some((c) => c.id === "add:themes:crime"))
	// Scary has no count without the answer without Cozy: no card.
	assert.ok(!cards.some((c) => c.id === "add:moods:scary"))
	// With room, the mix that is on comes last, without a count.
	const roomy = comboCards({
		mixes,
		rows,
		state,
		total: 2000,
		searching: false,
		slots: 10,
	})
	assert.equal(roomy.at(-1)?.on, true)
	assert.equal(roomy.at(-1)?.n, null)
})

test("picked folded genres remove whole units and keep shared names", () => {
	const state = { ...empty, genres: ["Action", "Action & Adventure", "Drama"] }
	const inputs = {
		state,
		prefs: {},
		total: 100,
		cleared: {},
		counts: { genres: { Action: 80, "Action & Adventure": 70 } },
		recoveries: [{ filter: "genres", titles: 400 }],
	}
	const action = optionOf(state, "genres", "Action")
	assert.equal(optionCount(action, inputs), 50)
	assert.equal(
		optionCount(action, {
			...inputs,
			state: { ...state, genres: [...state.genres, "Adventure"] },
		}),
		80,
	)
	assert.equal(
		optionCount(action, {
			...inputs,
			state: { ...state, genres: ["Action", "Action & Adventure"] },
		}),
		500,
	)
	assert.equal(
		optionCount(action, { ...inputs, state: { ...state, allOf: ["genres"] } }),
		80,
	)
	assert.equal(optionCount(action, { ...inputs, counts: null }), null)
})

test("picked rows use server removal counts and all-of bars allow widening", () => {
	for (const group of ["moods", "themes", "styles"] as const) {
		const options = moodOptionsOf(empty, null)[group].slice(0, 2)
		for (const allOf of [undefined, [group]]) {
			const state = {
				...empty,
				[group]: options.map((o) => o.id),
				allOf,
			} as State
			const rows = moodRows(options, {
				state,
				prefs: {},
				total: 100,
				counts: { [group]: { [options[0].id]: 160, [options[1].id]: 130 } },
				cleared: {},
			})
			assert.equal(rows.find((r) => r.id === options[0].id)?.n, 160)
			assert.equal(barScale(rows, 100, "all"), 160)
		}
	}
})
