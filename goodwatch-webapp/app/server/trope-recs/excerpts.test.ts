import assert from "node:assert/strict"
import { test } from "node:test"
import { excerptKeys, readRecommendationExcerpts } from "./excerpts.ts"
import type { CandidateIndex } from "./ranking.ts"
import type { CatalogRead } from "../profile/tropes-data.ts"
const canonical = "https://tvtropes.org/pmwiki/pmwiki.php/Main/Canonical"
const alias = "https://tvtropes.org/pmwiki/pmwiki.php/Main/Old"
const label = 'label:["Exact Name",""]'
const index: CandidateIndex = {
	tropes: [canonical, label],
	names: ["Canonical", "Exact Name"],
	references: [[alias, canonical], []],
	titles: Array.from({ length: 180 }, (_, n) => ({
		id: `movie-${n + 1}`,
		kind: "movie",
		name: "Title",
		poster: "/p",
		year: 2000,
		gwScore: 80,
		popularity: 1,
		href: "/",
		tropes: [{ i: n === 1 ? 1 : 0, d: 50 }],
	})),
}

test("excerpt membership includes candidates beyond ranked limits, rejects exclusions and other tropes", () => {
	assert.deepEqual(
		excerptKeys(index, new Set(["movie-1"]), canonical, [
			"movie-1",
			"movie-2",
			"movie-180",
			"movie-180",
			"movie-999",
		]),
		["movie-180"],
	)
	assert.deepEqual(excerptKeys(index, new Set(), "unknown", ["movie-180"]), [])
})

test("excerpt SQL reads only source routes, paginates, and keeps the longest authorized example", async () => {
	let calls = 0
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		assert.match(sql, /AND url IN \(\?,\?\)/)
		assert.deepEqual(params, ["movie", 180, alias, canonical])
		calls++
		const row = {
			media_tmdb_id: 180,
			name: "Old",
			url: alias,
			content: "<b>example</b>",
		}
		return (calls === 1
			? Array.from({ length: 1000 }, () => row)
			: [
					{ ...row, content: "A longer example" },
					{
						...row,
						url: "other",
						content: "unrelated text that must be ignored",
					},
					{ ...row, media_tmdb_id: 999, content: "unauthorized" },
				]) as unknown as T[]
	}
	assert.deepEqual(
		await readRecommendationExcerpts(read, index, canonical, ["movie-180"]),
		[{ key: "movie-180", text: "A longer example", label: "Old" }],
	)
	assert.equal(calls, 2)
})

test("null URL name fallback verifies exact identity after full-text matching", async () => {
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		assert.match(sql, /AND url IS NULL AND match\(name, \?\)/)
		assert.deepEqual(params, ["movie", 2, "Exact Name"])
		return [
			{ media_tmdb_id: 2, name: "Exact Name", url: null, content: "right" },
			{
				media_tmdb_id: 2,
				name: "Exact",
				url: null,
				content: "longer wrong text",
			},
			{
				media_tmdb_id: 2,
				name: "Exact Name",
				url: alias,
				content: "wrong route",
			},
		] as unknown as T[]
	}
	assert.deepEqual(
		await readRecommendationExcerpts(read, index, label, ["movie-2"]),
		[{ key: "movie-2", text: "right", label: "Exact Name" }],
	)
})

test("unresolved contextual identities sharing a non-general source URL keep exact names", async () => {
	const source = "https://tvtropes.org/pmwiki/pmwiki.php/Film/Work"
	const trope = `label:${JSON.stringify(["Context", source])}`
	const contextual: CandidateIndex = {
		...index,
		tropes: [trope],
		references: [[source]],
	}
	const read: CatalogRead = async <T extends {}>() =>
		[
			{ media_tmdb_id: 1, name: "Context", url: source, content: "right" },
			{
				media_tmdb_id: 1,
				name: "Other",
				url: source,
				content: "wrong longer example",
			},
		] as unknown as T[]
	assert.deepEqual(
		await readRecommendationExcerpts(read, contextual, trope, ["movie-1"]),
		[{ key: "movie-1", text: "right", label: "Context" }],
	)
})
