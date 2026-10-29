import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"
import type { FilterState } from "~/domain/filter-state"
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"

let snapshot: TitleSnapshot
const boundary = globalThis as typeof globalThis & {
	panelSnapshot: () => TitleSnapshot
	panelRange: (state: FilterState, name: string) => Set<number> | null
	panelCountries: (country: string) => Set<number>
	panelGroupsFail: boolean
	panelPeopleFail: boolean
	panelPeopleKeys: number[]
}
boundary.panelRange = () => null
boundary.panelCountries = () => new Set()
boundary.panelSnapshot = () => snapshot
boundary.panelPeopleFail = false
boundary.panelGroupsFail = false
boundary.panelPeopleKeys = []
stubModules({
	"~/server/list-exposure.server":
		"export const recordListExposure = () => null",
	"./discover-people.server":
		"export const featuredPeople = async () => { if (globalThis.panelPeopleFail) throw new Error('Crate unavailable'); return {mode: 'featured', actors: [], crew: []} }; export const peopleInResults = async keys => { globalThis.panelPeopleKeys = keys; if (globalThis.panelPeopleFail) throw new Error('Crate unavailable'); return {mode: 'results', actors: [], crew: []} }",
	"~/server/title-snapshot/index.server": `export * from '${new URL("./title-snapshot/format.server.ts", import.meta.url).href}'; export const getTitleSnapshot = () => globalThis.panelSnapshot()`,
	"~/server/availability-index.server":
		"export const countryServices = () => null; export const availabilityLoadedAt = () => 1",
	"~/server/taste/index.server":
		"export const loadTaste = async () => ({ signal: 'none', ratings: 0, liked: 0, match: keys => keys.map(() => null) })",
	"~/server/title-cards.server":
		"export const MAX_KEYS = 100; export const getTitleCards = async (keys, ctx) => keys.map(key => ({key, seen: ctx.seen.has(key)}))",
	"~/server/watch-next-taste-picker.server":
		"export const tasteGroupsFor = async () => { if (globalThis.panelGroupsFail) throw new Error('groups unavailable'); return {groups: [{carries: ['m:funny', 't:crime']}]}; }",
	"./id-sets.server": `export const rangeScoreTitles = async (state, name) => globalThis.panelRange(state, name);
		export const similarTitles = async () => new Set(); export const personTitles = similarTitles;
		export const legacyTitles = similarTitles; export const productionCountryTitles = country => globalThis.panelCountries(country);
		export const titlesOnAnyService = similarTitles; export const titlesOnServicesByColumn = similarTitles;`,
	"../personal-order/reader.server.ts":
		"export const loadPersonalOrder = () => {}; export const logPersonalOrder = () => {}; export const orderPersonalOrder = () => {}; export const personalOrderExposure = () => {}",
})
const { getDiscoverPanel, readyMixes, releasedTopKeys, isPanelPart } =
	await import("./discover-panel.server.ts")
const { discoverFilterDefaults } = await import("./discover-results.server.ts")
const { filterTitles } = await import("./title-filter/index.server.ts")
const { filterStateFromParams } = await import("~/domain/filter-state")
const { stateForMix, GUEST_MIXES } = await import("~/domain/mood-mixes")
const { MOOD_KEYS } = await import("~/domain/moods")
const { THEME_KEYS, STYLE_KEYS } = await import("~/domain/themes-styles")
const { WORD_BY_ID, picksOf } = await import("~/domain/taste-picker")
const { starterTitleKeys, starterBucket } = await import(
	"./discover-starter-titles.ts"
)
const { discoverFilterCache, discoverFilterKey } = await import(
	"./discover-filter-cache.server.ts"
)

const parseState = (params: URLSearchParams) =>
	filterStateFromParams(params, { onMyServices: false, notSeenYet: false })

const keys = Array.from(
	{ length: 40 },
	(_, i) => (i < 20 ? 1e12 : 2e12) + i + 1,
)
const columns = {
	pointIds: Float64Array.from(keys),
	genres: Uint32Array.from(keys, (_, i) => i % 2),
	genreNames: ["Drama"],
	releaseDays: new Int32Array(40).fill(19000),
	votes: new Uint32Array(40).fill(100_000),
	popularity: Float32Array.from(keys, (_, i) => 1000 - i),
	scores: new Uint8Array(40).fill(80),
	flags: new Uint8Array(40).fill(1),
	moods: new Uint16Array(40),
	themes: new Uint16Array(40),
	styles: new Uint16Array(40),
	ratings: null,
	facts: null,
}
// Give each mix several titles, with overlapping tags and nonmatching genres.
for (let i = 0; i < keys.length; i++) {
	const picks = picksOf(GUEST_MIXES[i % 8].tags)
	columns.moods[i] = picks.moods.reduce(
		(m, key) => m | (1 << MOOD_KEYS.indexOf(key)),
		0,
	)
	columns.themes[i] = picks.themes.reduce(
		(m, key) => m | (1 << THEME_KEYS.indexOf(key)),
		0,
	)
	columns.styles[i] = picks.styles.reduce(
		(m, key) => m | (1 << STYLE_KEYS.indexOf(key)),
		0,
	)
}
// Only the methods the filter and selectors read; an unexpected snapshot read fails the test.
snapshot = {
	version: "panel-fixture",
	count: keys.length,
	columns,
	rowOf: (key: number) => keys.indexOf(key),
	facts: (key: number) => snapshot.factsAt(keys.indexOf(key)),
	factsAt: (row: number) => ({
		mediaType: row < 20 ? "movie" : "show",
		score: columns.scores[row] === 255 ? null : columns.scores[row],
		votes: columns.votes[row],
		origin: ["US", "JP", "FR"][Math.floor(row / 8) % 3],
		moods: MOOD_KEYS.filter((_, bit) => columns.moods[row] & (1 << bit)),
	}),
} as unknown as TitleSnapshot
const viewer = {
	viewer: { kind: "guest", progress: { interactions: [] } },
	country: "US",
	services: [],
	seen: new Set<number>(),
	skipped: new Set<number>(),
	hidden: new Set<number>(),
	wishlist: new Map<number, Date>(),
	ratings: new Map<number, number>(),
	notInterested: new Set<number>(),
	forYou: false,
} satisfies Parameters<typeof getDiscoverPanel>[0]

test("mix counts equal results filtering for both tags with all=, preserving other filters", async () => {
	const state = parseState(
		new URLSearchParams(
			"moods=heavy&themes=war&styles=talky&genres=Drama&all=genres&unseen=1",
		),
	)
	viewer.seen.add(keys[1])
	viewer.hidden.add(keys[3])
	const panel = await getDiscoverPanel(viewer, "mixes", {
		state,
		sort: "popular",
	})
	assert.equal(panel.part, "mixes")
	if (panel.part !== "mixes") return
	assert.equal(panel.mixes.length, 8)
	for (const mix of panel.mixes) {
		const result = await filterTitles({
			universe: "catalog",
			state: stateForMix(state, mix),
			sort: "popular",
			taste: null,
			forYou: null,
			viewer,
		})
		assert.equal(mix.count, result.total, mix.id)
		assert.equal(mix.topTitle?.key ?? null, result.keys[0] ?? null)
	}
	assert.ok(panel.mixes.some((mix) => mix.count > 0))
	viewer.seen.clear()
	viewer.hidden.clear()
})

test("member pairs come first, deduplicate, skip incomplete groups and fill to eight", () => {
	const mixes = readyMixes([
		{ carries: ["m:heavy", "t:war"] },
		{ carries: ["m:heavy", "t:war"] },
		{ carries: ["t:crime"] },
		{ carries: ["m:funny", "t:crime"] },
	])
	assert.equal(mixes.length, 8)
	assert.deepEqual(mixes[0].tags, ["m:heavy", "t:war"])
	assert.equal(new Set(mixes.map((mix) => mix.id)).size, 8)
	assert.ok(mixes.every((mix) => WORD_BY_ID[mix.tags[0]].kind === "mood"))
})

test("failed member taste groups warn and fall back to guest mixes", async (t) => {
	const warnings: unknown[][] = []
	t.mock.method(console, "warn", (...args: unknown[]) => warnings.push(args))
	boundary.panelGroupsFail = true
	try {
		const panel = await getDiscoverPanel(
			{
				...viewer,
				viewer: { kind: "member", userId: "member" },
			},
			"mixes",
			{ state: parseState(new URLSearchParams()), sort: "popular" },
		)
		assert.equal(panel.part, "mixes")
		if (panel.part !== "mixes") return
		assert.deepEqual(
			panel.mixes.map((mix) => mix.id),
			GUEST_MIXES.map((mix) => mix.id),
		)
		assert.ok(panel.mixes.some((mix) => mix.count > 0))
		assert.equal(warnings.length, 1)
		assert.equal(warnings[0][0], "Discover panel: taste groups unavailable")
		assert.ok(warnings[0][1] instanceof Error)
	} finally {
		boundary.panelGroupsFail = false
	}
})

test("plain guest panel reads the shared results filter cache without title facts", async (t) => {
	const state = parseState(new URLSearchParams())
	const cleared = { ...state, moods: [], themes: [], styles: [] }
	const result = await filterTitles({
		universe: "catalog",
		state: cleared,
		sort: "popular",
		taste: null,
		forYou: null,
		viewer,
	})
	const key = discoverFilterKey({
		viewer,
		taste: { signal: "none" },
		state: cleared,
		sort: "popular",
		snapshotVersion: snapshot.version,
		availabilityLoadedAt: 1,
		year: new Date().getUTCFullYear(),
	})
	assert.ok(key)
	// A result from a completed availability index, as the results route would have stored it.
	await discoverFilterCache.run(key, async () => ({
		...result,
		approximate: false,
	}))
	t.mock.method(snapshot, "facts", () => {
		throw new Error("unexpected title facts read")
	})
	t.mock.method(snapshot, "factsAt", () => {
		throw new Error("unexpected row facts read")
	})
	const before = discoverFilterCache.stats().hits
	await getDiscoverPanel(viewer, "mixes", { state, sort: "popular" })
	assert.equal(discoverFilterCache.stats().hits, before + 1)
	discoverFilterCache.clear()
})

test("starter titles are deterministic per version, distinct buckets, alternating kinds and quality gated", async () => {
	columns.scores[0] = 74
	columns.votes[1] = 99_999
	columns.scores[2] = 255
	const first = starterTitleKeys(snapshot)
	assert.equal(first.length, 12)
	assert.equal(
		new Set(first.map((key) => starterBucket(snapshot, key))).size,
		12,
	)
	first.forEach((key, i) =>
		assert.equal(snapshot.facts(key)?.mediaType, i % 2 ? "show" : "movie"),
	)
	assert.ok(
		!first.includes(keys[0]) &&
			!first.includes(keys[1]) &&
			!first.includes(keys[2]),
	)
	assert.strictEqual(starterTitleKeys(snapshot), first)
	const state = parseState(new URLSearchParams("type=show&moods=heavy"))
	const guest = await getDiscoverPanel(viewer, "titles", {
		state,
		sort: "top",
	})
	viewer.seen.add(first[0])
	const memberViewer = {
		...viewer,
		viewer: { kind: "member", userId: "member" },
	} as Parameters<typeof getDiscoverPanel>[0]
	const member = await getDiscoverPanel(memberViewer, "titles", {
		state,
		sort: "newest",
	})
	assert.ok(member.part === "titles" && guest.part === "titles")
	assert.deepEqual(member.keys, guest.keys)
	assert.equal(member.cards[0].seen, true)
	assert.equal(guest.cards[0].seen, false)
	snapshot = { ...snapshot, version: "panel-fixture-next" }
	columns.scores.fill(60)
	assert.deepEqual(starterTitleKeys(snapshot), [])
})

test("members never enter shared filter caches", () => {
	const state = parseState(new URLSearchParams())
	assert.equal(
		discoverFilterKey({
			viewer: {
				...viewer,
				viewer: { kind: "member", userId: "member" },
			} as Parameters<typeof getDiscoverPanel>[0],
			taste: { signal: "none" },
			state,
			sort: "popular",
			snapshotVersion: snapshot.version,
			availabilityLoadedAt: 1,
			year: 2026,
		}),
		null,
	)
	assert.equal(discoverFilterCache.stats().entries, 0) // approximate guest fixtures are not cached either
})

test("people uses ranked universe, empty search stays results, and browse without filters is featured", async () => {
	const state = parseState(new URLSearchParams())
	const empty = await getDiscoverPanel(viewer, "people", {
		state,
		sort: "popular",
		ranked: [],
	})
	assert.equal(empty.part, "people")
	assert.ok(empty.part === "people" && empty.mode === "results")
	const featured = await getDiscoverPanel(viewer, "people", {
		state,
		sort: "popular",
	})
	assert.ok(featured.part === "people" && featured.mode === "featured")
})

test("people passes the filtered browse and search lists to the bounded reader", async () => {
	viewer.seen.clear()
	viewer.hidden.clear()
	for (let i = keys.length; i < 150; i++) keys.push(1e12 + i + 1)
	columns.pointIds = Float64Array.from(keys)
	columns.genres = new Uint32Array(150).fill(1)
	columns.releaseDays = new Int32Array(150).fill(19000)
	columns.votes = new Uint32Array(150).fill(100_000)
	columns.popularity = Float32Array.from(keys, (_, i) => 1000 - i)
	columns.scores = new Uint8Array(150).fill(80)
	columns.flags = new Uint8Array(150).fill(1)
	columns.moods = new Uint16Array(150)
	columns.themes = new Uint16Array(150)
	columns.styles = new Uint16Array(150)
	snapshot = { ...snapshot, version: "people-fixture", count: keys.length }
	const state = parseState(new URLSearchParams("genres=Drama&score=80"))
	const expected = await filterTitles({
		universe: "catalog",
		state,
		sort: "popular",
		taste: null,
		forYou: null,
		viewer,
	})
	assert.equal(expected.keys.length, 150)
	await getDiscoverPanel(viewer, "people", { state, sort: "popular" })
	assert.deepEqual(boundary.panelPeopleKeys, expected.keys)
	columns.scores[5] = 60
	await getDiscoverPanel(viewer, "people", {
		state,
		sort: "relevance",
		ranked: keys.slice(0, 90),
	})
	assert.deepEqual(
		boundary.panelPeopleKeys,
		keys.slice(0, 90).filter((key) => key !== keys[5]),
	)
})

test("empty URL uses featured people for members with saved services", async () => {
	const ctx = {
		...viewer,
		viewer: { kind: "member" as const, userId: "member" },
		services: [8],
	}
	const state = filterStateFromParams(
		new URLSearchParams(),
		discoverFilterDefaults(ctx),
	)
	assert.equal(state.notSeenYet, true)
	assert.equal(state.onMyServices, true)
	const panel = await getDiscoverPanel(ctx, "people", {
		state,
		sort: "popular",
	})
	assert.ok(panel.part === "people" && panel.mode === "featured")
})

test("Crate failures in featured and result people warn and return unavailable", async (t) => {
	const warnings: unknown[][] = []
	t.mock.method(console, "warn", (...args: unknown[]) => warnings.push(args))
	boundary.panelPeopleFail = true
	t.after(() => {
		boundary.panelPeopleFail = false
	})
	for (const ranked of [undefined, [], [keys[0]]]) {
		const panel = await getDiscoverPanel(viewer, "people", {
			state: parseState(new URLSearchParams()),
			sort: "popular",
			ranked,
		})
		assert.deepEqual(panel, {
			part: "people",
			mode: ranked === undefined ? "featured" : "results",
			actors: [],
			crew: [],
			unavailable: true,
		})
	}
	assert.equal(warnings.length, 3)
	assert.ok(
		warnings.every(
			([message, error]) =>
				message === "Discover panel: people unavailable" &&
				error instanceof Error,
		),
	)
})

test("facts and stub SQL paths return identical keys and recoveries; country pass/fail stays exact", async () => {
	const original = snapshot
	const rawYears = keys.map((_, i) => (i % 7 ? 1950 + i * 2 : null))
	const rawLengths = keys.map((_, i) =>
		i % 9 === 0 ? null : i % 9 === 1 ? 0 : 20 + i * 5,
	)
	const facts = {
		releaseYears: Uint16Array.from(rawYears, (v) => v ?? 0),
		lengths: Uint16Array.from(rawLengths, (v) => v ?? 0),
		budgets: new Uint32Array(keys.length),
		boxOffice: new Uint32Array(keys.length),
		seasons: new Uint8Array(keys.length),
		episodes: new Uint16Array(keys.length),
		showStatuses: new Uint8Array(keys.length),
		countryIndexes: new Uint8Array(keys.length * 4).fill(255),
		countries: ["CA"],
	}
	facts.countryIndexes.fill(0, 0, keys.length) // US is deliberately absent from the four slots.
	const calls: string[] = []
	boundary.panelRange = (state, name) => {
		calls.push(name)
		if (name !== "years" && name !== "runtime") return null
		const selected = keys.filter((_, i) => {
			const range =
				name === "years"
					? state.years
					: keys[i] < 2e12 || state.episodeRuntime === undefined
						? state.runtime
						: state.episodeRuntime
			const value = name === "years" ? rawYears[i] : rawLengths[i]
			return (
				!range ||
				(range.min === undefined && range.max === undefined) ||
				(value !== null &&
					(name !== "runtime" || value > 0) &&
					value >= (range.min ?? 0) &&
					value <= (range.max ?? Infinity))
			)
		})
		return new Set(selected)
	}
	boundary.panelCountries = () => new Set([keys[1], keys[22]])
	try {
		for (const fields of [
			{},
			{ years: { min: 1990 } },
			{ years: { max: 2005 } },
			{ years: { min: 1990, max: 2005 } },
			{ runtime: { min: 0, max: 90 } },
			{ runtime: { max: 90 } },
			{ runtime: { min: 120 } },
			{ episodeRuntime: { max: 45 } },
			{ runtime: { max: 90 }, episodeRuntime: null },
			{
				years: { min: 1990 },
				runtime: { max: 180 },
				episodeRuntime: { min: 60, max: 150 },
			},
			{ productionCountries: ["US"] },
		]) {
			const state = { ...parseState(new URLSearchParams()), ...fields }
			const input = {
				universe: keys,
				state,
				sort: "relevance" as const,
				taste: null,
				forYou: null,
				viewer,
			}
			snapshot = { ...original, columns: { ...original.columns, facts: null } }
			const sql = await filterTitles(input)
			assert.ok(calls.includes("years") && calls.includes("runtime"))
			calls.length = 0
			snapshot = { ...original, columns: { ...original.columns, facts } }
			const memory = await filterTitles(input)
			assert.deepEqual(memory.keys, sql.keys, JSON.stringify(fields))
			assert.deepEqual(memory.recoveries, sql.recoveries)
			assert.ok(!calls.includes("years") && !calls.includes("runtime"))
			calls.length = 0
			if (fields.productionCountries)
				assert.deepEqual(memory.keys, [keys[1], keys[22]])
		}
	} finally {
		snapshot = original
		boundary.panelRange = () => null
		boundary.panelCountries = () => new Set()
	}
})

test("released panel selects facts years in list order for decades, New and After, with viewer cards", async () => {
	assert.ok(isPanelPart("released"))
	const original = snapshot
	const year = new Date().getUTCFullYear()
	const facts = {
		releaseYears: Uint16Array.from(
			keys,
			(_, i) => [1995, year - 5, year - 2, year, 1949, 1950, 2000, 0][i % 8],
		),
		lengths: new Uint16Array(keys.length),
		budgets: new Uint32Array(keys.length),
		boxOffice: new Uint32Array(keys.length),
		seasons: new Uint8Array(keys.length),
		episodes: new Uint16Array(keys.length),
		showStatuses: new Uint8Array(keys.length),
		countryIndexes: new Uint8Array(keys.length * 4).fill(255),
		countries: [],
	}
	facts.releaseYears[21] = year - 4
	try {
		snapshot = { ...original, columns: { ...original.columns, facts } }
		const ranked = [keys[1], keys[21], keys[0], keys[2], keys[3], keys[5], keys[6]]
		const top = releasedTopKeys(ranked, snapshot, year)
		const keyFor = (id: string) => top.find((o) => o.id === id)?.key
		assert.equal(keyFor("decade:1990"), keys[0])
		assert.equal(keyFor("recent"), keys[2])
		assert.equal(keyFor("last2Years"), keys[3])
		assert.equal(keyFor("thisYear"), keys[3])
		assert.equal(keyFor("last5Years"), keys[21])
		assert.equal(keyFor("after2000"), keys[1])
		assert.equal(keyFor("after1950"), keys[1])
		assert.equal(keyFor("decade:1920"), null)
		const response = await getDiscoverPanel(
			{ ...viewer, seen: new Set([keys[2]]) },
			"released",
			{
				state: {
					...parseState(new URLSearchParams("genres=Drama")),
					years: { min: year, max: year },
					released: "before2000",
				},
				sort: "relevance",
				ranked,
			},
		)
		assert.equal(response.part, "released")
		if (response.part !== "released") throw new Error("Wrong part")
		assert.equal(response.available, true)
		assert.deepEqual(
			response.options.find((o) => o.id === "recent")?.topTitle,
			{ key: keys[2], seen: true },
		)
		snapshot = original
		assert.ok(releasedTopKeys(ranked, snapshot).every((o) => o.key === null))
		const absent = await getDiscoverPanel(viewer, "released", {
			state: parseState(new URLSearchParams()),
			sort: "relevance",
			ranked,
		})
		if (absent.part !== "released") throw new Error("Wrong part")
		assert.equal(absent.available, false)
		assert.ok(absent.options.every((o) => o.topTitle === null))
	} finally {
		snapshot = original
	}
})
