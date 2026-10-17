import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
const { rankForYou } = await import("../../domain/for-you.ts")
import { titleKey } from "../../utils/title-key.ts"
const { searchView } = await import("./search-view.ts")

const titles = Array.from({ length: 50 }, (_, i) => ({
	media_type: "movie" as const,
	tmdb_id: i + 1,
	title: `Movie ${i}`,
	release_year: 2020,
}))
test("defaults include all seen titles and use the site's For you order over the full batch", () => {
	const ranks = titles.map((_, i) => (i % 2 ? 100 : 0))
	const result = searchView(titles, {}, [titleKey("movie", 1)], () => ranks)
	assert.deepEqual(result.titles, rankForYou(titles, ranks, "search").order)
	assert.deepEqual(result.view, {
		for_you: true,
		exclude_seen: false,
		for_you_applied: true,
		availability: "everywhere",
	})
	assert.equal(result.titles.length, 50)
	assert.notDeepEqual(result.titles, titles)
	assert.deepEqual(
		searchView(titles, { for_you: false }, [], () => ranks).titles,
		titles,
	)
	assert.deepEqual(searchView(titles, {}).titles, titles)
})
test("unseen filtering is canonical, namespace-safe, and runs before pagination", () => {
	const result = searchView(
		[
			...titles,
			{ ...titles[0], tmdb_id: 5338654 },
			{ ...titles[0], tmdb_id: 658039 },
			{ ...titles[0], media_type: "show", tmdb_id: 658039 },
		],
		{ exclude_seen: true },
		[titleKey("movie", 1), titleKey("movie", 5338654)],
	)
	assert.equal(result.titles.length, 50)
	assert.equal(result.titles[0].tmdb_id, 2)
	assert.equal(result.titles.at(-1)?.media_type, "show")
	assert.equal(
		result.titles.some((t) => t.media_type === "movie" && t.tmdb_id === 658039),
		false,
	)
})
