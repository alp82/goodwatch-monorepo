import assert from "node:assert/strict"
import { test } from "node:test"
import { candidateTropes, buildCandidateIndex } from "./candidates.ts"
import { defining } from "../profile/tropes-model.ts"
import type { CatalogRead } from "../profile/tropes-data.ts"
const url = (s: string) => `https://tvtropes.org/pmwiki/pmwiki.php/Main/${s}`

test("candidate identities use the profile resolver; aliases merge with max excerpt length and no frequency threshold", () => {
	const rows = [
		{ media_tmdb_id: 1, name: "Old", url: url("Old"), length: 100 },
		{ media_tmdb_id: 1, name: "Other", url: url("Other"), length: 1000 },
		{ media_tmdb_id: 1, name: "Rare", url: url("Rare"), length: null },
	]
	const tropes = candidateTropes(["Old", "Other", "Rare", "Missing"], rows, {
		[url("Old")]: { url: url("Canonical"), title: "Canonical" },
		[url("Other")]: { url: url("Canonical"), title: "Canonical" },
	})
	assert.equal(tropes.length, 3)
	assert.equal(tropes[0].id, url("Canonical"))
	assert.equal(tropes[0].d, Math.round(defining(1000, 4) * 100))
	assert.deepEqual(tropes[1], { id: url("Rare"), d: 0 })
	assert.equal(tropes[2].id, 'label:["Missing",""]')
})

test("shared candidate build uses popular eligible movies and shows, paginates associations without loading content", async () => {
	const statements: string[] = []
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	): Promise<T[]> => {
		statements.push(sql)
		assert.doesNotMatch(sql, /\bcontent\b/)
		if (/FROM (movie|show)\b/.test(sql)) {
			assert.match(sql, /score_normalized_percent >= 66/)
			assert.match(sql, /array_length\(tropes, 1\) >= 12/)
			assert.match(sql, /poster_path IS NOT NULL/)
			assert.match(
				sql,
				/ORDER BY popularity DESC NULLS LAST, tmdb_id LIMIT 6000/,
			)
			return [
				{
					tmdb_id: 1,
					title: "Title",
					release_year: 2000,
					poster_path: "/poster",
					gw: 72.2,
					popularity: 100,
					tropes: ["A"],
				},
			] as unknown as T[]
		}
		assert.equal(params[1], 1)
		if (/OFFSET 0$/.test(sql))
			return Array.from({ length: 10000 }, () => ({
				media_tmdb_id: 1,
				name: "A",
				url: url("A"),
				length: 100,
			})) as unknown as T[]
		assert.match(sql, /OFFSET 10000$/)
		return [
			{ media_tmdb_id: 1, name: "B", url: url("B"), length: 200 },
		] as unknown as T[]
	}
	const titles = await buildCandidateIndex(
		read,
		async () => ({}),
		(kind, id) => `/${kind}/${id}`,
	)
	assert.deepEqual(
		titles.map((t) => t.id),
		["movie-1", "show-1"],
	)
	assert.equal(titles[0].tropes.length, 2)
	assert.equal(titles[0].gwScore, 72.2)
	assert.equal(statements.length, 6)
})
