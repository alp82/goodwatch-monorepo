import assert from "node:assert/strict"
import { test } from "node:test"
import { rankTropes } from "../../ui/profile/tropes/model.ts"
import { buildUriTropePool } from "./trope-uri-pool.ts"
import { type TropeTitle, defining, excerptParams } from "./tropes-model.ts"

const url = (slug: string) =>
	`https://tvtropes.org/pmwiki/pmwiki.php/Main/${slug}`
function titles(n = 3): TropeTitle[] {
	return Array.from({ length: n }, (_, i) => ({
		title: {
			key: `movie-${i + 1}`,
			mediaType: "movie",
			tmdbId: i + 1,
			title: `Film ${i + 1}`,
			year: 2000,
			poster: null,
			backdrop: null,
			score: 8 + (i % 2),
			gw: 70,
			href: `/movie/${i + 1}`,
			date: null,
		},
		genres: [],
		names: [],
	}))
}

test("URI grouping precedes qualification and a movie with two contextual labels counts once", () => {
	const a = url("OldOne")
	const b = url("OldTwo")
	const target = url("Actual")
	const associations = [
		{ key: "movie-1", name: "Context one", url: a, length: 100 },
		{ key: "movie-1", name: "Context two", url: b, length: 700 },
		{ key: "movie-1", name: "Context two", url: b, length: 700 },
		{ key: "movie-2", name: "Context one", url: a, length: 200 },
		{ key: "movie-3", name: "Context two", url: b, length: 300 },
	]
	const pool = buildUriTropePool(titles(), associations, {
		[a]: { url: target, title: "Actual heading" },
		[b]: { url: target, title: "Actual heading" },
	})
	assert.deepEqual(pool.tropes, [target])
	assert.deepEqual(pool.labels?.[target], ["Context one", "Context two"])
	assert.deepEqual(pool.references?.[target], [a, b])
	assert.deepEqual(pool.pool[0].r, [0])
	assert.deepEqual(pool.pool[0].d, [Math.round(defining(700, 1) * 100)])
	const ranked = rankTropes(pool, pool.pool).ranked
	assert.equal(ranked[0].count, 3)
	assert.equal(ranked[0].name, "Actual heading")
	assert.equal(ranked[0].id, target)
	assert.equal(new Set(ranked[0].top).size, 3)
	assert.deepEqual(
		buildUriTropePool(titles(), associations.slice().reverse(), {
			[a]: { url: target, title: "Actual heading" },
			[b]: { url: target, title: "Actual heading" },
		}),
		pool,
	)
})

test("one contextual label pointing to different pages keeps separate identities", () => {
	const a = url("First")
	const b = url("Second")
	const pool = buildUriTropePool(
		titles(),
		titles().flatMap((t) =>
			[a, b].map((u) => ({
				key: t.title.key,
				name: "Same label",
				url: u,
				length: 100,
			})),
		),
		{
			[a]: { url: a, title: "First heading" },
			[b]: { url: b, title: "Second heading" },
		},
	)
	assert.deepEqual(pool.tropes, [a, b])
	assert.equal(rankTropes(pool, pool.pool).ranked.length, 2)
	assert.deepEqual(
		pool.pool.map((t) => t.r.length),
		[2, 2, 2],
	)
})

test("unknown Main routes use honest labels and invalid/non-Main routes never borrow canonical metadata", () => {
	const unknown = url("Unknown")
	const wrong = "https://tvtropes.org/pmwiki/pmwiki.php/Film/Example"
	const pool = buildUriTropePool(
		titles(),
		titles().flatMap((t) => [
			{ key: t.title.key, name: "Context", url: unknown, length: 100 },
			{ key: t.title.key, name: "Context", url: wrong, length: 100 },
			{ key: t.title.key, name: "Other context", url: wrong, length: 100 },
		]),
		{ [wrong]: { url: url("Unrelated"), title: "Should never appear" } },
	)
	assert.equal(pool.tropes.length, 3)
	assert.ok(!Object.values(pool.names ?? {}).includes("Should never appear"))
	assert.equal(pool.names?.[unknown], "Context")
	assert.equal(pool.urls[unknown], unknown)
	assert.equal(Object.values(pool.urls).filter(Boolean).length, 1)
})

test("long unresolved label/route identifiers stay fetchable while massive requests and oversized legacy labels are rejected", () => {
	const name = "N".repeat(300)
	const route = `https://example.test/${"x".repeat(1000)}`
	const pool = buildUriTropePool(
		titles(),
		titles().map((t) => ({ key: t.title.key, name, url: route, length: 100 })),
		{},
	)
	const id = pool.tropes[0]
	assert.ok(id.length > 1200)
	assert.deepEqual(
		excerptParams(new URLSearchParams({ trope: id, keys: "movie-1" })),
		{ trope: id, keys: ["movie-1"] },
	)
	assert.equal(
		excerptParams(
			new URLSearchParams({
				trope: `label:${"x".repeat(4096)}`,
				keys: "movie-1",
			}),
		),
		null,
	)
	assert.equal(
		excerptParams(
			new URLSearchParams({ trope: "x".repeat(301), keys: "movie-1" }),
		),
		null,
	)
})
