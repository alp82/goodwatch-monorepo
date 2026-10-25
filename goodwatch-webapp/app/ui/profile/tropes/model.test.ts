import assert from "node:assert/strict"
import { test } from "node:test"
import type { PoolTitle } from "../../../server/profile/tropes-model.ts"
import {
	EARLY,
	type Facets,
	NO_FACETS,
	type RankedTrope,
	choiceStats,
	eraLabel,
	eraOf,
	erasOf,
	keeps,
	nameSize,
	rankTropes,
	sortTropes,
	teaser,
	tierOf,
	tropesLine,
} from "./model.ts"

const title = (
	k: string,
	s: number,
	r: number[],
	extra: Partial<PoolTitle> = {},
): PoolTitle => ({
	k,
	m: k.startsWith("movie") ? 0 : 1,
	y: 2000,
	s,
	g: [],
	r,
	d: r.map(() => 50),
	...extra,
})
const facets = (patch: Partial<Facets>): Facets => ({ ...NO_FACETS, ...patch })

test("filters keep titles by type, any picked genre, picked decades and minimum score", () => {
	const t = title("show-1", 8, [], { g: [1, 2], y: 1994 })
	assert.ok(keeps(t, NO_FACETS))
	assert.ok(keeps(t, facets({ kind: "show" })))
	assert.ok(!keeps(t, facets({ kind: "movie" })))
	assert.ok(keeps(t, facets({ genres: [0, 2] })))
	assert.ok(!keeps(t, facets({ genres: [0] })))
	assert.ok(keeps(t, facets({ eras: [1990] })))
	assert.ok(!keeps(t, facets({ eras: [2000] })))
	assert.ok(!keeps({ ...t, y: null }, facets({ eras: [1990] })))
	assert.ok(keeps(t, facets({ min: "8" })))
	assert.ok(!keeps(t, facets({ min: "9" })))
	// Leaving a filter out counts that filter's own choices against the others.
	assert.ok(keeps(t, facets({ kind: "movie" }), "kind"))
	assert.ok(!keeps(t, facets({ kind: "movie", min: "9" }), "kind"))
})

test("decades fold everything before 1970 into one", () => {
	assert.equal(eraOf(1955), EARLY)
	assert.equal(eraOf(1969), EARLY)
	assert.equal(eraOf(1971), 1970)
	assert.equal(eraLabel(EARLY), "Before 1970")
	assert.equal(eraLabel(1990), "1990s")
	assert.deepEqual(
		erasOf([
			title("movie-1", 5, [], { y: 2012 }),
			title("movie-2", 5, [], { y: 1950 }),
			title("movie-3", 5, [], { y: null }),
			title("movie-4", 5, [], { y: 2019 }),
		]),
		[EARLY, 2010],
	)
})

const POOL = {
	tropes: ["Alpha", "Beta", "Gamma"],
	descriptions: { Beta: "B." },
	urls: { Alpha: "https://tvtropes.org/a" },
}

test("ranking keeps tropes above the floor and orders by the loved z-score, then loved, then name", () => {
	// 4 titles: half scored 8+. Alpha: 3 of 3 loved; Beta: 1 of 3; Gamma only in 2 titles (below the floor of 3).
	const subset = [
		title("movie-1", 9, [0, 1, 2]),
		title("movie-2", 8, [0, 1, 2]),
		title("movie-3", 5, [1]),
		title("movie-4", 4, [0]),
	]
	const { ranked, usual } = rankTropes(POOL, subset)
	assert.deepEqual(
		ranked.map((t) => t.name),
		["Alpha", "Beta"],
	)
	const [alpha, beta] = ranked
	assert.equal(alpha.count, 3)
	assert.equal(alpha.loved, 2)
	assert.equal(alpha.average, 7)
	assert.equal(alpha.url, "https://tvtropes.org/a")
	assert.equal(alpha.description, null)
	assert.equal(beta.description, "B.")
	assert.equal(beta.url, "")
	assert.ok(alpha.z === beta.z)
	assert.equal(usual, 6.5)
	// Ties on z and loved fall back to the name.
	assert.ok(alpha.name < beta.name)
})

test("ranking prefers the clearly loved trope over the merely common one", () => {
	const subset: PoolTitle[] = []
	for (let i = 1; i <= 20; i++)
		subset.push(title(`movie-${i}`, i <= 10 ? 9 : 4, i <= 6 ? [0, 1] : [1]))
	const { ranked } = rankTropes(POOL, subset)
	assert.deepEqual(
		ranked.map((t) => t.name),
		["Alpha", "Beta"],
	)
	assert.ok(ranked[0].z > 0)
	assert.equal(ranked[1].z, 0)
})

test("defining titles put 7+ scores first, then definingness, then the score", () => {
	const subset = [
		title("movie-1", 6, [0], { d: [99] }),
		title("movie-2", 7, [0], { d: [10] }),
		title("movie-3", 9, [0], { d: [40] }),
		title("movie-4", 8, [0], { d: [40] }),
	]
	const { ranked } = rankTropes(POOL, subset)
	assert.deepEqual(ranked[0].top, ["movie-3", "movie-4", "movie-2", "movie-1"])
})

test("an empty selection ranks nothing and has no usual score", () => {
	assert.deepEqual(rankTropes(POOL, []), { ranked: [], usual: 0 })
})

const trope = (
	name: string,
	count: number,
	loved: number,
	average: number,
): RankedTrope => ({
	name,
	count,
	loved,
	average,
	z: 0,
	top: [],
	description: null,
	url: "",
})

test("sorts: Loved most keeps the rank, Most titles and Highest average reorder with tie-breaks", () => {
	const ranked = [
		trope("C", 10, 9, 8.1),
		trope("A", 30, 12, 7.2),
		trope("B", 30, 15, 8.1),
	]
	assert.equal(sortTropes(ranked, "loved"), ranked)
	assert.deepEqual(
		sortTropes(ranked, "count").map((t) => t.name),
		["B", "A", "C"],
	)
	assert.deepEqual(
		sortTropes(ranked, "average").map((t) => t.name),
		["B", "C", "A"],
	)
	// Sorting copies; the rank order stays.
	assert.deepEqual(
		ranked.map((t) => t.name),
		["C", "A", "B"],
	)
})

test("a choice counts the titles it leaves and pictures its best-scored title with a backdrop", () => {
	const pool = [
		title("movie-1", 9, [], { g: [0] }),
		title("movie-2", 7, [], { g: [0] }),
		title("show-3", 10, [], { g: [0] }),
		title("movie-4", 8, [], { g: [1] }),
	]
	const titles = {
		"movie-1": { backdrop: null },
		"movie-2": { backdrop: "/b2.jpg" },
		"show-3": { backdrop: "/b3.jpg" },
		"movie-4": { backdrop: "/b4.jpg" },
	}
	const f = facets({ kind: "movie", genres: [1] })
	assert.deepEqual(
		choiceStats(pool, titles, f, "genres", (t) => t.g.includes(0)),
		{ count: 2, picture: "/b2.jpg" },
	)
	assert.deepEqual(
		choiceStats(pool, titles, f, "kind", () => true),
		{ count: 1, picture: "/b4.jpg" },
	)
	assert.deepEqual(
		choiceStats(pool, titles, facets({ min: "9" }), "genres", (t) =>
			t.g.includes(1),
		),
		{ count: 0, picture: null },
	)
})

test("bands step down: three heroes, seven medium, then compact rows", () => {
	assert.deepEqual([0, 2, 3, 9, 10, 40].map(tierOf), [
		"hero",
		"hero",
		"medium",
		"medium",
		"compact",
		"compact",
	])
})

test("the teaser is the description's first sentence", () => {
	assert.equal(teaser("A hero falls. Then rises."), "A hero falls.")
	assert.equal(teaser('He says "No!" Then leaves.'), 'He says "No!"')
	assert.equal(teaser("No full stop"), "No full stop")
	assert.equal(teaser(null), null)
})

test("trope names step down by their longest word so words never break", () => {
	assert.equal(nameSize("Big Bad", "hero"), "text-4xl sm:text-6xl")
	assert.equal(
		nameSize("Anti-Villainous Henchman", "hero"),
		"text-4xl sm:text-5xl",
	)
	assert.equal(
		nameSize("Incomprehensibilities Abound", "hero"),
		"text-3xl sm:text-4xl",
	)
	assert.equal(nameSize('"Psycho" Strings', "big"), "text-2xl sm:text-[26px]")
	assert.equal(
		nameSize("A Very Long Trope Name That Goes On And On", "big"),
		"text-lg sm:text-xl",
	)
})

test("the page description names the three most loved tropes", () => {
	const pool = [
		title("movie-1", 9, [0, 1, 2]),
		title("movie-2", 9, [0, 1, 2]),
		title("movie-3", 9, [0, 1]),
		title("movie-4", 3, [1, 2]),
	]
	assert.equal(
		tropesLine("ana", { ...POOL, pool }),
		"The tropes @ana loves most: Alpha, Beta and Gamma.",
	)
	assert.equal(tropesLine("ana", { ...POOL, pool: [] }), undefined)
})
