import assert from "node:assert/strict"
import { test } from "node:test"
import { titleKey } from "../../utils/title-key.ts"
import type { RawTitle } from "../../ui/related-map/engine.ts"
import "../title-filter/test-alias.ts"
const { similarTitleView } = await import("./similar-titles.ts")
const source = {
	media_type: "movie" as const,
	tmdb_id: 603,
	title: "Matrix",
	release_year: 1999,
}
const neighbors: RawTitle[] = [
	["m603", "Matrix", "1999", "x.jpg", 1000, ""],
	["m1", "One", "2000", "x.jpg", 990, ""],
	["s1", "Show one", "2000", "x.jpg", 980, ""],
	["m2", "Two", "2000", "x.jpg", 970, ""],
	["m3", "Three", "2000", "x.jpg", 960, ""],
	["m4", "Four", "2000", "x.jpg", 950, ""],
]
test("Similarity filters source, hidden and types before paging, includes seen by default", () => {
	const hidden = [titleKey("movie", 2)],
		seen = [titleKey("movie", 1)]
	const first = similarTitleView(
		neighbors,
		source,
		{ for_you: false, limit: 2 },
		hidden,
		seen,
	)
	assert.deepEqual(
		first.items.map((t) => `${t.media_type}:${t.tmdb_id}`),
		["movie:1", "show:1"],
	)
	assert.equal(first.next_cursor, "offset:2")
	assert.equal(first.total, 4)
	assert.equal(first.items[0].similarity, 0.99)
	const filtered = similarTitleView(
		neighbors,
		source,
		{ for_you: false, exclude_seen: true, kind: "movie", limit: 1 },
		hidden,
		seen,
	)
	assert.equal(filtered.items[0].tmdb_id, 3)
	assert.equal(filtered.total, 2)
	assert.equal(filtered.availability, "everywhere")
	assert.equal(
		similarTitleView(
			neighbors,
			source,
			{
				for_you: false,
				exclude_seen: true,
				kind: "movie",
				limit: 1,
				cursor: filtered.next_cursor!,
			},
			hidden,
			seen,
		).items[0].tmdb_id,
		4,
	)
})
test("For you uses site browse lift over full eligible neighborhood before paging; missing taste retains similarity", () => {
	const plain = similarTitleView(neighbors, source, { limit: 1 }, [], [])
	assert.equal(plain.items[0].tmdb_id, 1)
	assert.equal(plain.for_you_applied, false)
	const lifted = similarTitleView(
		neighbors,
		source,
		{ limit: 1 },
		[],
		[],
		(keys) => keys.map((key) => (key === titleKey("movie", 4) ? 100 : 0)),
	)
	assert.equal(lifted.items[0].tmdb_id, 4)
	assert.equal(lifted.for_you_applied, true)
	assert.equal(
		similarTitleView(
			neighbors,
			source,
			{ for_you: false, limit: 1 },
			[],
			[],
			(keys) => keys.map(() => 100),
		).items[0].tmdb_id,
		1,
	)
})
test("Canonical aliases cannot duplicate or bypass hidden/seen filtering; namespaces stay separate", () => {
	const aliases: RawTitle[] = [
		["m3635601", "Old", "2020", "x.jpg", 990, ""],
		["m872517", "New", "2020", "x.jpg", 980, ""],
		["s3635601", "Show", "2020", "x.jpg", 970, ""],
	]
	assert.equal(similarTitleView(aliases, source, {}, [], []).total, 2)
	const view = similarTitleView(
		aliases,
		source,
		{ exclude_seen: true },
		[],
		[titleKey("movie", 3635601)],
	)
	assert.equal(view.total, 1)
	assert.equal(view.items[0].media_type, "show")
})
