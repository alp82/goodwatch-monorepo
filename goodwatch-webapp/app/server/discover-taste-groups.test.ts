import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"

let snapshot: TitleSnapshot
let hasGroups = true
let groupReads = 0
let calls: number[] = []
const boundary = globalThis as typeof globalThis & {
	discoverTastePeopleKeys: number[]
	discoverTasteSnapshot: () => TitleSnapshot
	discoverTasteMember: (ctx: { viewer: { kind: string } }) => unknown
	discoverTasteSide: (member: unknown, key: number) => number | null
}
boundary.discoverTastePeopleKeys = []
boundary.discoverTasteSnapshot = () => snapshot
const membership = (key: number) =>
	snapshot.rowOf(key) % 3 === 2 ? null : snapshot.rowOf(key) % 3
let member = {
	get snapshot() {
		return snapshot
	},
	named: {
		sides: [
			{ members: [{ key: 1e12 + 1 }], anchor: 1e12 + 1 },
			{ members: [{ key: 1e12 + 2 }], anchor: 1e12 + 2 },
		],
	},
	sides: [
		{ id: "crime", name: "Dark thrillers", here: [] },
		{ id: "comedy", name: "Gentle comedy", here: [] },
	],
}
boundary.discoverTasteMember = (ctx) => {
	groupReads++
	return ctx.viewer.kind === "member" && hasGroups ? member : null
}
boundary.discoverTasteSide = (_, key) => {
	calls.push(key)
	return membership(key)
}
stubModules({
	"./discover-people.server": `export const featuredPeople = async () => ({mode: 'featured', actors: [], crew: []});
		export const peopleInResults = async keys => { globalThis.discoverTastePeopleKeys = keys; return {mode: 'results', actors: [], crew: []} }`,
	"~/server/list-exposure.server":
		"export const recordListExposure = () => null",
	"~/server/title-snapshot/index.server": `export * from '${new URL("./title-snapshot/format.server.ts", import.meta.url).href}'; export const getTitleSnapshot = () => globalThis.discoverTasteSnapshot()`,
	"~/server/availability-index.server":
		"export const countryServices = () => null; export const availabilityLoadedAt = () => 1",
	"~/server/taste/index.server":
		"export const loadTaste = async () => ({ signal: 'none', ratings: 0, liked: 0, match: keys => keys.map(() => null) })",
	"~/server/title-cards.server":
		"export const MAX_KEYS = 100; export const getTitleCards = async keys => keys.map(key => ({key, match: null}))",
	"./id-sets.server": `export const rangeScoreTitles = async () => null;
		export const similarTitles = async () => new Set(); export const personTitles = similarTitles;
		export const legacyTitles = similarTitles; export const productionCountryTitles = similarTitles;
		export const titlesOnAnyService = similarTitles; export const titlesOnServicesByColumn = similarTitles;`,
	"../personal-order/reader.server.ts":
		"export const loadPersonalOrder = () => {}; export const logPersonalOrder = () => {}; export const orderPersonalOrder = () => {}; export const personalOrderExposure = () => {}",
	"~/server/discover-sides.server": `export const memberSides = async ctx => globalThis.discoverTasteMember(ctx);
		export const sideOf = (member, key) => globalThis.discoverTasteSide(member, key);
		export const requestedGroup = (member, id) => id === 'none' ? null : id === 'crime' ? 0 : id === 'comedy' ? 1 : undefined;
		export const discoverSide = (member, index, total) => ({...member.sides[index], total}); export const ROW_TITLES = 8;`,
	"~/server/taste-portrait/index.server":
		"export const portraitInput = () => { throw new Error('Unexpected portrait read') }",
	"~/server/taste-portrait/person.server":
		"export const readPerson = () => { throw new Error('Unexpected person read') }; export const titleZ = () => null",
	"~/server/taste-portrait/sides.server": `export const MEMBER_BARS = {}; export const closeSides = () => []; export const sideEdges = () => { throw new Error('Unexpected edges') };
		export const sideAnchor = side => side.anchor;
		export const sideOfAnchor = (named, key) => named.sides.findIndex(s => s.members.some(m => m.key === key));`,
})
const { getDiscoverResults } = await import("./discover-results.server.ts")
const { getDiscoverPanel } = await import("./discover-panel.server.ts")
const { stateForMix } = await import("~/domain/mood-mixes")
const { filterStateFromParams } = await import("~/domain/filter-state")
const { MOOD_KEYS } = await import("~/domain/moods")
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
} satisfies Parameters<typeof getDiscoverResults>[0]

const memberViewer = {
	...viewer,
	viewer: { kind: "member" as const, userId: "taste-member" },
}
const results = (
	query: string,
	options: Partial<Parameters<typeof getDiscoverResults>[1]> = {},
	ctx: Parameters<typeof getDiscoverResults>[0] = memberViewer,
) =>
	getDiscoverResults(ctx, {
		state: parseState(new URLSearchParams(query)),
		sort: "popular",
		forYou: false,
		page: 1,
		exposure: false,
		...options,
	})

test("stable taste key returns the same member titles as side=, across search, sorts and For you settings", async () => {
	const side = await results("", {
		forYou: true,
		sides: { rows: false, side: "crime" },
	})
	assert.equal(side.sides?.layout, "side")
	assert.ok(side.keys.length > 0 && side.keys.length < keys.length)
	for (const sort of [
		"popular",
		"top",
		"newest",
		"match",
		"relevance",
	] as const) {
		for (const forYou of [true, false]) {
			for (const ranked of [undefined, [...keys].reverse()]) {
				const out = await results("taste=movie-1", { sort, forYou, ranked })
				assert.deepEqual([...out.keys].sort(), [...side.keys].sort())
				assert.equal(out.tasteGroups?.names["movie-1"], "Dark thrillers")
				assert.equal(out.optionCounts.tasteGroups["movie-1"], side.keys.length)
			}
		}
	}
	assert.deepEqual(
		(await results("taste=1")).keys,
		(await results("taste=movie-1")).keys,
	)
	assert.equal(
		(await results("taste=movie-1,movie-2")).total,
		keys.filter((k) => membership(k) !== null).length,
	)
})

test("counts are opt-in, groups are lazy, guests and members without groups are not narrowed", async () => {
	calls = []
	groupReads = 0
	const plain = await results("")
	assert.equal(groupReads, 0)
	assert.deepEqual(calls, [])
	assert.deepEqual(plain.optionCounts.tasteGroups, {})
	const counted = await results("type=movie", { tasteCounts: true })
	assert.equal(groupReads, 1)
	assert.ok(calls.length > 0)
	assert.ok(calls.every((k) => k < 2e12))
	assert.deepEqual(counted.optionCounts.tasteGroups, {
		"movie-1": 7,
		"movie-2": 7,
		none: 6,
	})
	calls = []
	groupReads = 0
	assert.equal(
		(await results("taste=movie-1", { tasteCounts: true }, viewer)).total,
		plain.total,
	)
	assert.equal(groupReads, 0)
	assert.deepEqual(calls, [])
	hasGroups = false
	try {
		assert.equal((await results("taste=movie-1")).total, plain.total)
	} finally {
		hasGroups = true
	}
})

test("a saved key keeps its group when its current anchor changes", async () => {
	const before = await results("taste=movie-1")
	const original = member
	member = {
		...original,
		named: {
			sides: [
				{ members: [{ key: 1e12 + 1 }, { key: 1e12 + 4 }], anchor: 1e12 + 4 },
				original.named.sides[1],
			],
		},
	}
	try {
		const after = await results("taste=movie-1")
		assert.deepEqual(after.keys, before.keys)
		assert.equal(after.tasteGroups?.names["movie-1"], "Dark thrillers")
		assert.ok(after.tasteGroups?.groups.some((g) => g.key === "movie-4"))
		assert.equal(after.optionCounts.tasteGroups["movie-4"], before.total)
	} finally {
		member = original
	}
})

test("panels preserve taste picks for mixes, people and released, including legacy and unresolved refs", async () => {
	const original = snapshot
	// Released reads only the release years; the other fact columns are not needed by these filters.
	const facts = {
		releaseYears: Uint16Array.from(keys, (_, row) => (row < 20 ? 1995 : 2005)),
		lengths: new Uint16Array(keys.length),
		budgets: new Uint32Array(keys.length),
		boxOffice: new Uint32Array(keys.length),
		seasons: new Uint8Array(keys.length),
		episodes: new Uint16Array(keys.length),
		showStatuses: new Uint8Array(keys.length),
		countryIndexes: new Uint8Array(keys.length * 4).fill(255),
		countries: [],
	}
	snapshot = { ...original, columns: { ...original.columns, facts } }
	try {
		for (const taste of ["movie-1", "2", "movie-1,movie-2", "movie-999"]) {
			const state = parseState(
				new URLSearchParams(`taste=${taste}&genres=Drama`),
			)
			for (const ranked of [undefined, [...keys].reverse()]) {
				for (const forYou of [false, true]) {
					const input = { state, sort: "popular" as const, ranked, forYou }
					const expected = await results("", input)
					const people = await getDiscoverPanel(memberViewer, "people", input)
					assert.equal(people.part, "people")
					assert.deepEqual(boundary.discoverTastePeopleKeys, expected.keys)
					const released = await getDiscoverPanel(
						memberViewer,
						"released",
						input,
					)
					if (released.part !== "released") throw new Error("Wrong part")
					for (const year of [1990, 2000]) {
						const top = expected.keys.find(
							(key) => facts.releaseYears[snapshot.rowOf(key)] === year + 5,
						)
						assert.equal(
							released.options.find((o) => o.id === `decade:${year}`)?.topTitle
								?.key ?? null,
							top ?? null,
						)
					}
				}
			}
			const mixes = await getDiscoverPanel(memberViewer, "mixes", {
				state,
				sort: "popular",
			})
			if (mixes.part !== "mixes") throw new Error("Wrong part")
			for (const mix of mixes.mixes) {
				const expected = await results("", { state: stateForMix(state, mix) })
				assert.equal(mix.count, expected.total)
				assert.equal(mix.topTitle?.key ?? null, expected.keys[0] ?? null)
			}
		}
	} finally {
		snapshot = original
	}
})

test("unresolved taste references return only resolved names and do not narrow results", async () => {
	const plain = await results("")
	const missing = await results("taste=movie-999")
	assert.deepEqual(missing.keys, plain.keys)
	assert.deepEqual(missing.tasteGroups?.names, {})
	const mixed = await results("taste=movie-999,1")
	assert.deepEqual(mixed.tasteGroups?.names, { "1": "Dark thrillers" })
	assert.deepEqual(mixed.keys, (await results("taste=movie-1")).keys)
})
