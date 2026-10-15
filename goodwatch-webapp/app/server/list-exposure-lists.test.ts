// Exercise the real list builders and writer with in-memory reads. No Redis, Crate connection or auth is loaded.
import "node-crate"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import type { ViewerContext } from "./viewer.server.ts"

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/taste/index.server.ts"))
			source = `
			export const loadTaste = async () => ({ signal: 'some', ratings: 20, liked: 12, vector: null,
				match: keys => keys.map(() => 77), percentile: keys => keys.map(() => 50), leanings: () => [] });`
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `
			export const getTitleSnapshot = () => null;
			export const UNKNOWN_SCORE = 255;`
		else if (url.endsWith("/availability-index.server.ts"))
			source = `
			export const availabilityLoadedAt = () => 1;
			export const isOnServices = () => true;`
		else if (url.endsWith("/movie-runtimes.server.ts"))
			source = `
			export const movieRuntimes = async keys => new Map([...keys].map(k => [k, 100]));`
		else if (url.endsWith("/title-cards.server.ts"))
			source = `
			export const MAX_KEYS = 60;
			export const getDisplayFields = async () => new Map();
			export const getServiceCards = async () => [];
			export const getTitleCards = async keys => keys.filter(k => k !== 1e12 + 2).map(key => ({ key, match: 77 }));`
		else if (url.endsWith("/title-filter/index.server.ts"))
			source = `
			export class SnapshotNotLoaded extends Error {}
			export const filterTitles = async input => ({ keys: input.universe === 'catalog'
				? Array.from({length: 85}, (_, i) => 1e12 + i + 1) : input.universe,
				sortUsed: input.sort, moved: input.forYou ? [] : undefined, ladder: null });`
		if (source === undefined) return next(url, context)
		return { format: "module", source, shortCircuit: true }
	},
})

const { getDiscoverResults } = await import("./discover-results.server.ts")
const { getWatchNext, getWatchNextCardsPage } = await import(
	"./watch-next.server.ts"
)
const { defaultFilterState } = await import("../domain/filter-state.ts")
const { setCrateClientForTest } = await import("../utils/crate.ts")
const ctx = (): ViewerContext => ({
	viewer: { kind: "member", userId: "member-A" },
	country: "DE",
	services: [8],
	seen: new Set(),
	ratings: new Map(),
	skipped: new Set(),
	hidden: new Set(),
	notInterested: new Set(),
	wishlist: new Map(
		Array.from({ length: 50 }, (_, i) => [1e12 + i + 1, new Date(50 - i)]),
	),
	forYou: true,
})
const turn = () => new Promise<void>((resolve) => setImmediate(resolve))
let rows: Record<string, unknown>[]
beforeEach(() => {
	rows = []
	setCrateClientForTest({
		async execute(sql, params = []) {
			if (sql.trim().startsWith("SELECT"))
				return {
					json: params.map((tmdb_id) => ({
						tmdb_id,
						day: null,
						score: 80,
						popularity: 20,
					})),
				}
			assert.match(sql, /INSERT INTO user_list_exposure/)
			const columns = [...sql.split("VALUES")[0].matchAll(/"(\w+)"/g)].map(
				(m) => m[1],
			)
			rows.push(
				Object.fromEntries(columns.map((column, i) => [column, params[i]])),
			)
			return { json: [], rowcount: 1 }
		},
	})
})
afterEach(async () => {
	await turn()
	setCrateClientForTest(null)
})

test("Discover first view and subsequent pages record returned cards, excluding missing titles", async () => {
	const input = {
		state: defaultFilterState({ onMyServices: true, notSeenYet: true }),
		sort: "popular" as const,
		forYou: true,
		page: 1,
	}
	const first = await getDiscoverResults(ctx(), input)
	const second = await getDiscoverResults(ctx(), {
		...input,
		page: 2,
		sort: "top",
		forYou: false,
		state: { ...input.state, minMatch: 80 },
	})
	assert.notEqual(first.listId, second.listId)
	await turn()
	assert.equal(rows.length, 2)
	assert.deepEqual(
		rows[0].title_keys,
		first.cards.slice(0, 30).map((c) => c.key),
	)
	assert.ok(!(rows[0].title_keys as number[]).includes(1e12 + 2))
	assert.deepEqual(
		rows[1].title_keys,
		second.cards.slice(0, 30).map((c) => c.key),
	)
	assert.equal(rows[1].list_id, second.listId)
	assert.deepEqual(
		[rows[1].page, rows[1].sort, rows[1].for_you, rows[1].filters],
		[2, "top", false, { ...second.state, searching: false }],
	)
})

test("Discover search mode logs its returned order and guests write nothing", async () => {
	const input = {
		state: defaultFilterState({ onMyServices: false, notSeenYet: false }),
		sort: "relevance" as const,
		forYou: false,
		page: 1,
		ranked: [1e12 + 9, 1e12 + 5],
	}
	const member = await getDiscoverResults(ctx(), input)
	const guest = await getDiscoverResults(
		{ ...ctx(), viewer: { kind: "guest", progress: { interactions: [] } } },
		input,
	)
	await turn()
	assert.equal(rows.length, 1)
	assert.equal(guest.listId, null)
	assert.equal(rows[0].list_id, member.listId)
	assert.deepEqual(rows[0].title_keys, input.ranked)
	assert.equal((rows[0].filters as { searching: boolean }).searching, true)
})

test("Watch next logs hero, Then and loaded tiers, then separately logs a later cards batch", async () => {
	const first = await getWatchNext(ctx(), {
		sort: "added",
		moods: ["funny"],
		onMyServices: false,
	})
	const later = await getWatchNextCardsPage(
		ctx(),
		[1e12 + 45, 1e12 + 46, 1e12 + 999],
		{ sort: "waiting" },
	)
	await turn()
	assert.equal(rows.length, 2)
	const shown = [
		first.hero,
		...first.thenColumn,
		...first.tiers.flatMap((t) => t.titles ?? []),
		first.start,
		...first.worthAdding,
	].filter((c) => c !== null)
	assert.deepEqual(
		rows[0].title_keys,
		shown.slice(0, 30).map((c) => c.key),
	)
	assert.deepEqual(
		rows[0].taste_matches,
		shown.slice(0, 30).map((c) => c.match),
	)
	assert.equal(rows[0].list_id, first.listId)
	assert.deepEqual(
		[rows[0].surface, rows[0].sort, rows[0].batch],
		["watch-next", "added", "page"],
	)
	assert.deepEqual(rows[1].title_keys, [1e12 + 45, 1e12 + 46])
	assert.deepEqual(
		[rows[1].list_id, rows[1].sort, rows[1].batch, rows[1].positions],
		[later.listId, "waiting", "cards", [1, 2]],
	)
	assert.notEqual(first.listId, later.listId)
})

test("My movies captures the movie and time filters; Watch next guests get identical cards without logging", async () => {
	const options = { kind: "movie" as const, time: 120, sort: "top" as const }
	const member = await getWatchNext(ctx(), options)
	const guest = await getWatchNext(
		{ ...ctx(), viewer: { kind: "guest", progress: { interactions: [] } } },
		options,
	)
	await turn()
	assert.equal(rows.length, 1)
	assert.equal(member.listId, rows[0].list_id)
	assert.equal(guest.listId, null)
	assert.deepEqual(
		[
			member.hero,
			member.thenColumn,
			member.tiers,
			member.start,
			member.worthAdding,
		],
		[guest.hero, guest.thenColumn, guest.tiers, guest.start, guest.worthAdding],
	)
	assert.deepEqual(rows[0].filters, {
		type: "movie",
		onMyServices: true,
		moods: [],
		minMatch: 0,
		notTonight: [],
		time: 120,
	})
})
