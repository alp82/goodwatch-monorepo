import assert from "node:assert/strict"
import { test } from "node:test"
import type { CatalogRead } from "../profile/tropes-data.ts"
import { defining } from "../profile/tropes-model.ts"
import { timeSlice } from "../time-slice.ts"
import {
	ASSOCIATION_LIMIT,
	associationOrder,
	buildCandidateIndex,
	candidateTropes,
} from "./candidates.ts"
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
	assert.deepEqual(tropes[1], { id: url("Rare"), d: 0, name: "Rare" })
	assert.equal(tropes[0].name, "Old")
	assert.equal(tropes[2].name, "Missing")
	assert.equal(tropes[2].id, 'label:["Missing",""]')
})

test("shared candidate build uses popular eligible movies and shows, one unordered association read per batch, without content", async () => {
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
		assert.doesNotMatch(sql, /ORDER BY|OFFSET/)
		assert.match(sql, /LIMIT 60000$/)
		return [
			{ media_tmdb_id: 1, name: "B", url: url("B"), length: 200 },
			{ media_tmdb_id: 1, name: "A", url: url("A"), length: 100 },
		] as unknown as T[]
	}
	let resolves = 0
	const titles = await buildCandidateIndex(
		read,
		async (urls) => {
			resolves++
			assert.deepEqual(urls.sort(), [url("A"), url("B")])
			return {}
		},
		(kind, id) => `/${kind}/${id}`,
	)
	assert.deepEqual(
		titles.titles.map((t) => t.id),
		["movie-1", "show-1"],
	)
	assert.equal(titles.titles[0].tropes.length, 2)
	assert.equal(titles.titles[0].gwScore, 72.2)
	assert.equal(statements.length, 4)
	assert.equal(resolves, 1)
	// Rows are put in name order before the build reads them, as the sorted query returned them.
	assert.deepEqual(titles.tropes, [url("A"), url("B")])
	assert.deepEqual(titles.titles[0].tropes, titles.titles[1].tropes)
	assert.deepEqual(Object.keys(titles.titles[0].tropes[0]).sort(), ["d", "i"])
})

test("a batch whose associations reach the row limit is read again in halves", async () => {
	const batches: number[][] = []
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	): Promise<T[]> => {
		if (sql.includes("FROM show")) return []
		if (sql.includes("FROM movie"))
			return [1, 2, 3].map((id) => ({
				tmdb_id: id,
				title: "Title",
				release_year: 2000,
				poster_path: "/p",
				gw: 80,
				popularity: 1,
				tropes: ["A"],
			})) as unknown as T[]
		const ids = params.slice(1).map(Number)
		batches.push(ids)
		const rows = ids.includes(1)
			? ASSOCIATION_LIMIT * (ids.length === 1 ? 0.5 : 1)
			: 1
		return Array.from({ length: rows }, (_, k) => ({
			media_tmdb_id: ids[k % ids.length],
			name: "A",
			url: url("A"),
			length: k,
		})) as unknown as T[]
	}
	const index = await buildCandidateIndex(
		read,
		async () => ({}),
		() => "/",
	)
	assert.deepEqual(batches, [[1, 2, 3], [1, 2], [1], [2], [3]])
	assert.equal(index.titles.length, 3)
})

test("association order matches Crate's: ID, name and URL in code point order, missing URL last, then length", () => {
	const rows = [
		{ media_tmdb_id: 2, name: "A", url: url("A"), length: 1 },
		{ media_tmdb_id: 1, name: "B", url: null, length: 1 },
		{ media_tmdb_id: 1, name: "B", url: url("B"), length: 5 },
		{ media_tmdb_id: 1, name: "B", url: url("B"), length: 2 },
		{ media_tmdb_id: 1, name: "\u{1F600}", url: null, length: 0 },
		{ media_tmdb_id: 1, name: "\uFF21", url: null, length: 0 },
		{ media_tmdb_id: 1, name: "A", url: url("A"), length: 0 },
	]
	assert.deepEqual(
		[...rows]
			.sort(associationOrder)
			.map((r) => [r.media_tmdb_id, r.name, r.length]),
		[
			[1, "A", 0],
			[1, "B", 2],
			[1, "B", 5],
			[1, "B", 1],
			[1, "\uFF21", 0],
			[1, "\u{1F600}", 0],
			[2, "A", 1],
		],
	)
})

test("one union resolution spans 200-title batches, with shared numeric alias and unresolved identities", async () => {
	let resolves = 0
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		if (sql.includes("FROM show")) return []
		if (sql.includes("FROM movie"))
			return Array.from({ length: 201 }, (_, i) => ({
				tmdb_id: i + 1,
				title: "Title",
				release_year: 2000,
				poster_path: "/p",
				gw: 80,
				popularity: 1,
				tropes: ["Old", "Missing"],
			})) as unknown as T[]
		return params.slice(1).flatMap((id) => [
			{
				media_tmdb_id: id,
				name: "Old",
				url: url(Number(id) === 201 ? "Other" : "Old"),
				length: 100,
			},
			{ media_tmdb_id: id, name: "Unknown", url: url("Unknown"), length: 0 },
		]) as unknown as T[]
	}
	const index = await buildCandidateIndex(
		read,
		async (urls) => {
			resolves++
			assert.deepEqual(
				urls.sort(),
				[url("Old"), url("Other"), url("Unknown")].sort(),
			)
			return Object.fromEntries(
				["Old", "Other"].map((s) => [
					url(s),
					{ url: url("Canonical"), title: "Canonical" },
				]),
			)
		},
		() => "/",
	)
	assert.equal(resolves, 1)
	assert.equal(index.titles.length, 201)
	assert.equal(index.tropes.length, 3)
	assert.equal(
		index.names[index.tropes.indexOf('label:["Missing",""]')],
		"Missing",
	)
	assert.deepEqual(index.titles[0].tropes, index.titles[200].tropes)
	assert.deepEqual(index.references[index.tropes.indexOf(url("Canonical"))], [
		url("Old"),
		url("Other"),
	])
})

test("the build yields to the event loop whenever its time slice is used up", async () => {
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		if (sql.includes("FROM show")) return []
		if (sql.includes("FROM movie"))
			return Array.from({ length: 450 }, (_, i) => ({
				tmdb_id: i + 1,
				title: "Title",
				release_year: 2000,
				poster_path: "/p",
				gw: 80,
				popularity: 1,
				tropes: ["A"],
			})) as unknown as T[]
		return params.slice(1).map((id) => ({
			media_tmdb_id: id,
			name: "A",
			url: url("A"),
			length: 10,
		})) as unknown as T[]
	}
	// Reads above settle on microtasks only, so an immediate can run during the build only where it yields.
	let clock = 0
	let turns = 0
	let counting = true
	const count = () => {
		turns++
		if (counting) setImmediate(count)
	}
	const index = await buildCandidateIndex(
		read,
		async () => {
			setImmediate(count)
			return {}
		},
		() => "/",
		// A clock that has always used up its slice: the build yields at every check.
		timeSlice(10, () => (clock += 10)),
	)
	counting = false
	assert.equal(index.titles.length, 450)
	assert.ok(turns >= 450, `expected a turn per title, got ${turns}`)
})
