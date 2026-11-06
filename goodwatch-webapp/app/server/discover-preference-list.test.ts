// Discover's results for a search with read preferences, on a fixture snapshot: the composed order, the titles the
// filters keep out still counted, the fallback past 5,000, and the search's scope count.
import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"

let snapshot: TitleSnapshot
const boundary = globalThis as typeof globalThis & { prefSnapshot: () => TitleSnapshot }
boundary.prefSnapshot = () => snapshot
stubModules({
	"~/server/list-exposure.server": "export const recordListExposure = () => null",
	"~/server/title-snapshot/index.server": `export * from '${new URL("./title-snapshot/format.server.ts", import.meta.url).href}'; export const getTitleSnapshot = () => globalThis.prefSnapshot()`,
	"~/server/availability-index.server":
		"export const countryServices = () => null; export const availabilityLoadedAt = () => 1",
	"~/server/taste/index.server":
		"export const loadTaste = async () => ({ signal: 'none', ratings: 0, liked: 0, match: keys => keys.map(() => null), leanings: () => [] })",
	"~/server/taste/inline.server": "export const inlineTaste = (taste) => taste",
	"~/server/title-cards.server":
		"export const MAX_KEYS = 100; export const getTitleCards = async (keys) => keys.map(key => ({key}))",
	"~/server/watch-next-taste-picker.server": "export const tasteGroupsFor = async () => ({groups: []})",
	"./id-sets.server": `export const rangeScoreTitles = async () => null;
		export const similarTitles = async () => new Set(); export const personTitles = similarTitles;
		export const legacyTitles = similarTitles; export const awardTitles = similarTitles; export const productionCountryTitles = similarTitles;
		export const titlesOnAnyService = similarTitles; export const titlesOnServicesByColumn = similarTitles;`,
	"../personal-order/reader.server.ts":
		"export const loadPersonalOrder = () => {}; export const logPersonalOrder = () => {}; export const orderPersonalOrder = () => {}; export const personalOrderExposure = () => {}",
})
const { getDiscoverResults } = await import("./discover-results.server.ts")
const { preferenceList } = await import("./discover-preference-order.server.ts")
const { filterStateFromParams } = await import("~/domain/filter-state")
const { MOOD_KEYS } = await import("~/domain/moods")

// Twelve movies: even rows are funny; the score falls with the row; rows 0 to 9 are dramas.
const COUNT = 12
const keys = Array.from({ length: COUNT }, (_, i) => 1e12 + i + 1)
const funny = 1 << MOOD_KEYS.indexOf("funny")
const columns = {
	pointIds: Float64Array.from(keys),
	genres: Uint32Array.from(keys, (_, i) => (i < 10 ? 1 : 0)),
	genreNames: ["Drama"],
	releaseDays: new Int32Array(COUNT).fill(19000),
	votes: new Uint32Array(COUNT).fill(100_000),
	popularity: Float32Array.from(keys, (_, i) => 1000 - i),
	scores: Uint8Array.from(keys, (_, i) => 90 - i),
	flags: new Uint8Array(COUNT).fill(1),
	moods: Uint16Array.from(keys, (_, i) => (i % 2 === 0 ? funny : 0)),
	themes: new Uint16Array(COUNT),
	styles: new Uint16Array(COUNT),
	ratings: null,
	facts: null,
}
snapshot = {
	version: "preference-fixture",
	count: COUNT,
	columns,
	rowOf: (key: number) => keys.indexOf(key),
	facts: (key: number) => snapshot.factsAt(keys.indexOf(key)),
	factsAt: (row: number) => ({
		mediaType: "movie",
		genres: [],
		score: columns.scores[row],
		votes: columns.votes[row],
		moods: MOOD_KEYS.filter((_, bit) => columns.moods[row] & (1 << bit)),
	}),
	fingerprint: () => null,
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
} as unknown as Parameters<typeof getDiscoverResults>[0]
const state = (query = "") => filterStateFromParams(new URLSearchParams(query), { onMyServices: false, notSeenYet: false })
const funnyPreference = [{ group: "moods" as const, value: "funny" }]
// No taste and no taste groups: the hard rules are the filter state alone.
const open = { taste: null, tasteGroups: null }

test("Relevance: the search's order nudged by the preference, every title still listed", async () => {
	// The search ranked rows 1, 0, 3, 2: the funny ones (0, 2) rise above their neighbours (a quarter of the weight).
	const ranked = [keys[1], keys[0], keys[3], keys[2]]
	const list = await preferenceList(viewer, { ranked, preferences: funnyPreference, state: state(), sort: "relevance", ...open })
	assert.deepEqual(list.universe, [keys[0], keys[2], keys[1], keys[3]])
	assert.equal(list.sort, "relevance")
})

test("Top rated: titles with every read preference first, by rating, then the rest by rating", async () => {
	const ranked = [keys[3], keys[2], keys[1], keys[0]]
	const list = await preferenceList(viewer, { ranked, preferences: funnyPreference, state: state(), sort: "top", ...open })
	assert.deepEqual(list.universe, [keys[0], keys[2], keys[1], keys[3]])
	assert.equal(list.sort, "relevance", "the composed order is served as sent")
})

test("titles a filter keeps out follow the composed order, so the bar still counts them", async () => {
	const ranked = [keys[0], keys[10], keys[1]]
	const list = await preferenceList(viewer, {
		ranked,
		preferences: funnyPreference,
		state: state("genres=Drama"),
		sort: "relevance",
		...open,
	})
	assert.deepEqual(list.universe.slice(0, 2), [keys[0], keys[1]])
	assert.deepEqual(list.universe.slice(2), [keys[10]])
})

test("the results list the composed order, keep Top rated as the sort, and count the search's scope", async () => {
	const ranked = [keys[3], keys[2], keys[1], keys[0]]
	const results = await getDiscoverResults(viewer, {
		state: state("genres=Drama"),
		sort: "top",
		forYou: false,
		page: 1,
		ranked,
		preferences: { list: funnyPreference },
		scope: true,
		exposure: false,
	})
	assert.deepEqual(results.keys, [keys[0], keys[2], keys[1], keys[3]])
	assert.equal(results.sortUsed, "top")
	// Ten dramas pass the filters; the search holds four of them.
	assert.deepEqual(results.scope, { eligible: 10, outside: 6 })
})

test("the original pool's titles join with every read preference", async () => {
	const list = await preferenceList(viewer, {
		ranked: [keys[1]],
		original: [keys[4], keys[5]],
		preferences: funnyPreference,
		state: state(),
		sort: "relevance",
		...open,
	})
	// Row 4 is funny and admitted; row 5 isn't, so it only follows for the counts.
	assert.deepEqual(list.universe, [keys[1], keys[4], keys[5]])
})

test("one title under two keys folds to the original key only where that key passes every rule", async () => {
	// Rows 1 and 11 are one title: row 1 in the search's own pool, row 11 in the original pool. Row 11 isn't a drama.
	const identities = [[keys[1], keys[11]] as const]
	const strict = await preferenceList(viewer, {
		ranked: [keys[0], keys[1]],
		original: [keys[11]],
		identities,
		preferences: [],
		state: state("genres=Drama"),
		sort: "relevance",
		...open,
	})
	// Row 1 passes, row 11 doesn't: the title stays, under the key that passes.
	assert.ok(strict.universe.slice(0, 2).includes(keys[1]))

	// Rows 3 and 10 are one title, and row 10 (funny) passes in the original pool: the wider key folds into it.
	const folded = await preferenceList(viewer, {
		ranked: [keys[0], keys[3]],
		original: [keys[10]],
		identities: [[keys[3], keys[10]] as const],
		preferences: funnyPreference,
		state: state(),
		sort: "relevance",
		...open,
	})
	assert.deepEqual(folded.universe.slice(0, 2).sort(), [keys[0], keys[10]].sort(), "listed once, as the original key")
	assert.ok(!folded.universe.includes(keys[3]), "the folded key isn't listed again for the counts")

	// A pair whose keys the pools don't hold changes nothing.
	const none = await preferenceList(viewer, {
		ranked: [keys[0]],
		original: [keys[2]],
		identities: [[keys[7], keys[8]] as const],
		preferences: funnyPreference,
		state: state(),
		sort: "relevance",
		...open,
	})
	assert.deepEqual(none.universe, [keys[0], keys[2]])
})

test("taste groups narrow the composition and the scope alike", async () => {
	// The member picked the side "a": rows 0 to 5 fit it.
	const tasteGroups = {
		options: ["a", "b"],
		picked: ["a"],
		sideOf: (key: number) => (keys.indexOf(key) < 6 ? "a" : "b"),
	}
	const list = await preferenceList(viewer, {
		ranked: [keys[7], keys[1], keys[0]],
		preferences: funnyPreference,
		state: state(),
		sort: "relevance",
		taste: null,
		tasteGroups,
	})
	// Row 7 is outside the side: it isn't composed, only kept after the list for the counts.
	assert.deepEqual(list.universe.slice(0, 2).sort(), [keys[0], keys[1]].sort())
	assert.equal(list.universe.at(-1), keys[7])
})

test("the scope counts under the search's Not interested rule, as the results do", async () => {
	const hidden = { ...viewer, hidden: new Set([keys[0], keys[9]]) } as typeof viewer
	const results = await getDiscoverResults(hidden, {
		state: state("genres=Drama"),
		sort: "relevance",
		forYou: false,
		page: 1,
		ranked: [keys[0], keys[1]],
		preferences: { list: funnyPreference },
		scope: true,
		exposure: false,
	})
	// A search keeps Not interested titles findable, so the scope counts them too: ten dramas, two in the results.
	assert.ok(results.keys.includes(keys[0]))
	assert.deepEqual(results.scope, { eligible: 10, outside: 8 })
})
