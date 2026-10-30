import assert from "node:assert/strict"
import { test } from "node:test"
import { performance } from "node:perf_hooks"
import {
	type Candidate as IndexedCandidate,
	type CandidateIndex,
	type MemberTrope,
	memberTropes,
	rankRecommendations as rankIndex,
	recParams,
} from "./ranking.ts"
import type { UserData } from "../../types/user-data.ts"
import type { TropePool } from "../profile/tropes-model.ts"

type Candidate = Omit<IndexedCandidate, "tropes"> & {
	tropes: { id: string; d: number }[]
}
function compact(titles: Candidate[]): CandidateIndex {
	const tropes = [...new Set(titles.flatMap((t) => t.tropes.map((h) => h.id)))]
	return {
		tropes,
		names: tropes,
		references: tropes.map(() => []),
		titles: titles.map((t) => ({
			...t,
			tropes: t.tropes.map((h) => ({ i: tropes.indexOf(h.id), d: h.d })),
		})),
	}
}
function rankRecommendations(
	titles: Candidate[],
	...args: Parameters<typeof rankIndex> extends [unknown, ...infer R]
		? R
		: never
) {
	return rankIndex(compact(titles), ...args)
}

const empty = (): UserData => ({
	scores: {},
	wishlist: {},
	watchState: {},
	favorites: {},
	skipped: {},
	notInterested: {},
})
const profile: MemberTrope[] = [
	{ id: "a", name: "A", rank: 1, z: 2, count: 10, loved: 8, labels: ["A"] },
	{ id: "b", name: "B", rank: 2, z: 1, count: 10, loved: 6, labels: ["B"] },
]
const candidate = (
	n: number,
	tropes = [{ id: "a", d: 60 }],
	extra: Partial<Candidate> = {},
): Candidate => ({
	id: `movie-${n}`,
	kind: "movie",
	name: `Title ${n}`,
	year: 2000,
	poster: "/p.jpg",
	gwScore: 80,
	popularity: 1,
	href: `/movie/${n}`,
	tropes,
	...extra,
})

test("For you uses sqrt breadth damping, GW and definingness cap; hits follow member rank", () => {
	const rows = rankRecommendations(
		[
			candidate(1, [
				{ id: "b", d: 20 },
				{ id: "a", d: 60 },
			]),
			candidate(2),
			candidate(3, [{ id: "a", d: 600 }], { gwScore: 66 }),
		],
		profile,
		empty(),
		"all",
	)
	const firstRaw = ((1 * (0.5 + 20 / 60) + 2 * 1.5) / Math.sqrt(2)) * 0.8
	assert.equal(rows[0].id, "movie-2")
	assert.equal(rows[0].match, 100)
	assert.equal(
		rows.find((t) => t.id === "movie-1")?.match,
		Math.round((firstRaw / 2.4) * 100),
	)
	assert.equal(
		rows.find((t) => t.id === "movie-3")?.match,
		Math.round((1.98 / 2.4) * 100),
	)
	assert.deepEqual(
		rows.find((t) => t.id === "movie-1")!.matchedTropes.map((t) => t.id),
		["a", "b"],
	)
})

test("single trope blends capped definingness and rounded full For you match before rescaling", () => {
	const titles = [
		candidate(1, [
			{ id: "a", d: 0 },
			{ id: "b", d: 60 },
		]),
		candidate(2, [{ id: "a", d: 60 }], { gwScore: 66 }),
		candidate(3, [{ id: "b", d: 60 }]),
	]
	const all = rankRecommendations(titles, profile, empty(), "all")
	const rows = rankRecommendations(titles, profile, empty(), "all", "a")
	assert.deepEqual(
		rows.map((t) => t.id),
		["movie-2", "movie-1"],
	)
	const raw1 = (0.4 * all.find((t) => t.id === "movie-1")!.match) / 100
	const raw2 = 0.6 + (0.4 * all.find((t) => t.id === "movie-2")!.match) / 100
	assert.equal(rows[0].match, 100)
	assert.equal(rows[1].match, Math.round((raw1 / raw2) * 100))
	assert.throws(
		() => rankRecommendations(titles, profile, empty(), "all", "foreign"),
		RangeError,
	)
})

test("excludes every acted-on collection except Wishlist; type filtering renormalizes and titles occur once", () => {
	const data = empty()
	const time = new Date(0)
	data.scores["movie-1"] = { score: 8, review: null, updatedAt: time }
	data.skipped["movie-2"] = { updatedAt: time }
	data.notInterested["movie-3"] = { updatedAt: time }
	data.watchState["movie-4"] = {
		state: "watching",
		count: 1,
		pass: 1,
		episodesWatched: 1,
		furthest: [1, 1],
		lastActivityAt: null,
		watchedAt: null,
		precision: "unknown",
	}
	data.wishlist["movie-5"] = { updatedAt: time, createdAt: time }
	const titles = [
		...Array.from({ length: 5 }, (_, i) => candidate(i + 1)),
		candidate(5),
		candidate(6, [], { kind: "show", id: "show-6" }),
		candidate(7, undefined, { kind: "show", id: "show-7", gwScore: 99 }),
	]
	const rows = rankRecommendations(titles, profile, data, "movie")
	assert.equal(rows.length, 1)
	assert.equal(rows[0].id, "movie-5")
	assert.equal(rows[0].wishlist, true)
	assert.equal(rows[0].match, 100)
	assert.deepEqual(rankRecommendations(titles, [], data, "all"), [])
})

test("limits are applied after scoring all candidates; single-trope can reach outside For you 120", () => {
	const titles = Array.from({ length: 150 }, (_, i) => candidate(i + 1))
	titles.push(candidate(151, [{ id: "b", d: 1 }]))
	assert.equal(rankRecommendations(titles, profile, empty(), "all").length, 120)
	assert.equal(
		rankRecommendations(titles, profile, empty(), "all", "a").length,
		60,
	)
	assert.equal(
		rankRecommendations(titles, profile, empty(), "all", "b")[0].id,
		"movie-151",
	)
	const many = Array.from({ length: 12 }, (_, i) => ({
		id: `t${i}`,
		name: `T${i}`,
		rank: i + 1,
		z: 1,
		count: 10,
		loved: 5,
		labels: [`T${i}`],
	}))
	const row = rankRecommendations(
		[
			candidate(
				1,
				many.map((t) => ({ id: t.id, d: 50 })),
			),
		],
		many,
		empty(),
		"all",
	)[0]
	assert.equal(row.matchedTropes.length, 8)
	assert.equal(row.matchedCount, 12)
	assert.deepEqual(Object.keys(row.matchedTropes[0]).sort(), [
		"d",
		"id",
		"name",
		"rank",
	])
	const single = rankRecommendations(
		[
			candidate(
				1,
				many.map((t) => ({ id: t.id, d: 50 })),
			),
		],
		many,
		empty(),
		"all",
		"t10",
	)[0]
	assert.equal(single.matchedTropes.length, 8)
	assert.deepEqual(
		single.matchedTropes.map((t) => t.id),
		["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t10"],
	)
})

test("member profile reuses z rules with fixed minimum ten, positive only, top sixty", () => {
	const pool: TropePool = {
		schema: 2,
		names: { a: "A", b: "B" },
		tropes: ["a", "b", "c"],
		pool: [],
		genres: [],
		urls: {},
		descriptions: {},
		titles: {},
		years: [0, 0],
	}
	pool.pool = Array.from({ length: 30 }, (_, i) => ({
		k: `movie-${i + 1}`,
		m: 0,
		y: 2000,
		s: i < 10 ? 8 : 4,
		g: [],
		r: i < 10 ? [0, ...(i < 9 ? [1] : [])] : [2],
		d: [10, 10],
	}))
	const ranked = memberTropes(pool)
	assert.deepEqual(
		ranked.map((t) => t.id),
		["a"],
	)
	assert.equal(ranked[0].rank, 1)
	assert.equal(ranked[0].count, 10)
	assert.equal(ranked[0].loved, 10)
	assert.deepEqual(ranked[0].labels, ["A"])
	assert.ok(
		Math.abs(ranked[0].z - (10 - 10 / 3) / Math.sqrt(10 * (1 / 3) * (2 / 3))) <
			1e-10,
	)
	pool.tropes = Array.from({ length: 65 }, (_, i) => `t${i}`)
	pool.pool.forEach((t, i) => {
		t.r = i < 10 ? pool.tropes.map((_, i) => i) : []
		t.d = t.r.map(() => 0)
	})
	assert.equal(memberTropes(pool).length, 60)
	pool.pool.forEach((t) => {
		t.s = 8
	})
	assert.deepEqual(memberTropes(pool), [])
})

test("parameter validation", () => {
	assert.deepEqual(recParams(new URLSearchParams()), {
		kind: "all",
		trope: undefined,
	})
	assert.equal(recParams(new URLSearchParams("kind=tv")), null)
	assert.equal(recParams(new URLSearchParams("trope=")), null)
	assert.equal(
		recParams(new URLSearchParams({ trope: "a".repeat(4097) })),
		null,
	)
})

test("warm in-memory ranking on 12,000 titles stays below 300ms", () => {
	const tropes = Array.from({ length: 60 }, (_, i) => ({
		id: `t${i}`,
		name: `Trope ${i}`,
		count: 10,
		loved: 8,
		labels: [`Trope ${i}`],
		rank: i + 1,
		z: 1 + i / 60,
	}))
	const titles = Array.from({ length: 12000 }, (_, i) =>
		candidate(
			i + 1,
			tropes.slice(i % 40, (i % 40) + 20).map((t) => ({ id: t.id, d: 50 })),
		),
	)
	const index = compact(titles)
	rankIndex(index, tropes, empty(), "all")
	const start = performance.now()
	assert.equal(rankIndex(index, tropes, empty(), "all").length, 120)
	const elapsed = performance.now() - start
	console.log(`12,000-title warm ranking: ${elapsed.toFixed(1)} ms`)
	assert.ok(elapsed < 300, `ranking took ${elapsed}ms`)
})

test("dedicated log exclusions apply without mutating member skipped data", () => {
	const data = empty()
	const excluded = new Set(["movie-1"])
	assert.deepEqual(
		rankRecommendations(
			[candidate(1), candidate(2)],
			profile,
			data,
			"all",
			undefined,
			excluded,
		).map((t) => t.id),
		["movie-2"],
	)
	assert.deepEqual(data.skipped, {})
})
