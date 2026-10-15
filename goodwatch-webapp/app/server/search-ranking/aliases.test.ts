// Localized names (aliases): the decoded table, the palette's prefix tiers, and "like X".
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import {
	aliasReference,
	aliasTable,
	buildAliasTable,
	emptyAliasTable,
	exactAliases,
	matchedAlias,
} from "./aliases.server.ts"
import { matchingRows } from "./name-prefix.server.ts"
import type { SearchIndex } from "./search-index.server.ts"

// references.server.ts reads a JSON file, which Node imports only with an import attribute.
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
		if (url.endsWith(".json") && url.includes("/search-ranking/"))
			return {
				format: "module",
				source: `export default ${readFileSync(new URL(url), "utf8")}`,
				shortCircuit: true,
			}
		return next(url, context)
	},
})
const { resolveReference } = await import("./references.server.ts")

const movie = (id: number) => 1e12 + id
// Rows: Spirited Away, The Dark Knight, Star Wars, Lone Star (a canonical word match for "star"), an adult title, and
// The Thing (1982) and The Thing (1951), which share their German name.
const titles = [
	["Spirited Away", "千と千尋の神隠し", 900_000],
	["The Dark Knight", "The Dark Knight", 3_000_000],
	["Star Wars", "Star Wars", 2_000_000],
	["Lone Star", "Lone Star", 20_000],
	["Sternchen", "Sternchen", 50_000],
	["The Thing", "The Thing", 500_000],
	["The Thing from Another World", "The Thing from Another World", 30_000],
	["The Godfather", "The Godfather", 2_400_000],
] as const
const aliasDoc = {
	version: 1,
	rows: [0, 0, 1, 2, 2, 3, 4, 5, 6],
	names: [
		"Chihiros Reise ins Zauberland",
		"Le Voyage de Chihiro",
		"Mroczny Rycerz",
		"Gwiezdne wojny",
		"Sternenkrieg",
		"Einsamer Stern",
		"Sternbild",
		"Das Ding aus einer anderen Welt",
		"Das Ding aus einer anderen Welt",
	],
	languages: ["de", "fr", "pl", "pl", "de", "de", "de", "de", "de"],
}
function fixture(aliases = aliasTable(aliasDoc, titles.length)): SearchIndex {
	const pointIds = titles.map((_, i) => movie(i + 1))
	return {
		titleTable: {
			size: titles.length,
			pointIds,
			rowOf: new Map(pointIds.map((id, row) => [id, row])),
			titles: titles.map((t) => t[0]),
			originalTitles: titles.map((t) => t[1]),
			votes: Float64Array.from(titles.map((t) => t[2])),
			years: new Int32Array(titles.length),
			popularity: new Float64Array(titles.length),
			flagNames: ["adult"],
			// Sternchen is adult.
			flags: Int32Array.from(titles.map((_, i) => (i === 4 ? 1 : 0))),
		},
		words: { df: new Map(), spellVocabulary: [], spellByLength: new Map() },
		names: { entityOf: new Map(), entities: [], fullNames: [] },
		referenceTitles: new Map([
			["the dark knight", 1],
			["dark knight", 1],
			["star wars", 2],
		]),
		franchiseTitles: [],
		aliases,
	} as unknown as SearchIndex
}

test("the table decodes rows, languages, word starts, and an exact lookup", () => {
	const table = aliasTable(aliasDoc, titles.length)
	assert.equal(table.size, 9)
	assert.equal(table.version, 1)
	assert.deepEqual([...table.rows], [0, 0, 1, 2, 2, 3, 4, 5, 6])
	assert.deepEqual(
		[...table.wordStarts.subarray(table.startAt[0], table.startAt[1])],
		[0, 8, 13, 16],
	)
	assert.equal(table.squashed[0], "chihirosreiseinszauberland")
	assert.deepEqual(matchedAlias(table, 2), {
		text: "Mroczny Rycerz",
		language: "pl",
	})
	assert.deepEqual(exactAliases(table, "dasdingauseineranderenwelt"), [7, 8])
	assert.deepEqual(exactAliases(table, "levoyagedechihiro"), [1])
	assert.deepEqual(exactAliases(table, "levoyage"), [])
	assert.deepEqual(exactAliases(table, "zzz"), [])
})

test("a build without the file, or with rows outside the title table, has no aliases or fails", () => {
	const empty = aliasTable(undefined, 3)
	assert.equal(empty.size, 0)
	assert.equal(empty.version, 0)
	assert.deepEqual(emptyAliasTable(3), empty)
	assert.throws(
		() => aliasTable({ ...aliasDoc, rows: [0, 0, 1, 2, 2, 3, 4, 5, 9] }, 7),
		/don't match/,
	)
	assert.throws(
		() => aliasTable({ ...aliasDoc, rows: [1, 0, 1, 2, 2, 3, 4, 5, 6] }, 7),
		/don't match/,
	)
	// A load never fails for its aliases: a table that doesn't fit is skipped.
	const logged = console.error
	console.error = () => {}
	try {
		assert.equal(buildAliasTable({ ...aliasDoc, rows: [9] }, 7, "test").size, 0)
	} finally {
		console.error = logged
	}
	assert.equal(buildAliasTable(aliasDoc, 7, "test").size, 9)
})

test("the palette finds a title by a localized name, whatever the language", () => {
	const index = fixture()
	for (const prefix of [
		"chihiros reise",
		"chihiro",
		"le voyage de chi",
		"mroczny",
		"gwiezdne wojny",
	]) {
		const { rows, aliases } = matchingRows(index, prefix, 8)
		assert.ok(rows.length, prefix)
		assert.ok(aliases.has(rows[0]), prefix)
	}
	const { rows, aliases } = matchingRows(index, "mroczny rycerz", 8)
	assert.deepEqual(rows, [1])
	assert.deepEqual(matchedAlias(index.aliases, aliases.get(1) as number), {
		text: "Mroczny Rycerz",
		language: "pl",
	})
	// A row found by its title or original title carries no alias.
	const original = matchingRows(index, "千と千尋", 8)
	assert.deepEqual(original.rows, [0])
	assert.equal(original.aliases.size, 0)
})

test("localized names come after every title match, a start before a later word", () => {
	// "star": Star Wars starts with it (title start), Lone Star has it as a later word (title word). "stern":
	// Sternenkrieg starts (alias start) for Star Wars, Einsamer Stern has a later word (alias word) for Lone Star, and
	// Sternchen (title start) and Sternbild (alias start) belong to an adult title.
	const index = fixture()
	assert.deepEqual(matchingRows(index, "star", 8).rows, [2, 3])
	const stern = matchingRows(index, "stern", 8)
	assert.deepEqual(stern.rows, [2, 3])
	assert.equal(stern.total, 2, "the adult title isn't counted")
	// Without aliases the canonical answer is unchanged.
	const canonical = fixture(emptyAliasTable(titles.length))
	assert.deepEqual(matchingRows(canonical, "star", 8).rows, [2, 3])
	assert.deepEqual(matchingRows(canonical, "stern", 8).rows, [])
	// A title's later word beats an alias start, whatever the votes: The Dark Knight (3,000,000 votes) is called
	// "Star of the North" here, and comes after Lone Star (20,000 votes), whose title has "star" as a later word.
	const tiers = fixture(
		aliasTable(
			{
				version: 1,
				rows: [1, 3],
				names: ["Star of the North", "Lone Rider"],
				languages: ["fr", "it"],
			},
			titles.length,
		),
	)
	const star = matchingRows(tiers, "star", 8)
	assert.deepEqual(star.rows, [2, 3, 1])
	assert.deepEqual(
		[...star.aliases],
		[[1, 0]],
		"only the row found by its alias carries it",
	)
	// A row a title matches never takes an alias: Lone Star is found by its title, not by "Lone Rider".
	assert.deepEqual(matchingRows(tiers, "lone", 8).rows, [3])
	assert.equal(matchingRows(tiers, "lone", 8).aliases.size, 0)
	// The limit keeps the titles: with one place, Star Wars.
	assert.deepEqual(matchingRows(tiers, "star", 1).rows, [2])
})

test("a name several titles share resolves by votes, never by language", () => {
	const index = fixture()
	const { rows } = matchingRows(index, "das ding aus", 8)
	assert.deepEqual(rows, [5, 6])
	assert.equal(aliasReference(index, "das ding aus einer anderen welt"), 5)
})

test("like X takes a localized name after the titles, with the vote floor", () => {
	const index = fixture()
	const ref = resolveReference(
		index,
		"like Chihiros Reise ins Zauberland",
		"like Chihiros Reise ins Zauberland",
		true,
	)
	assert.equal(ref?.kind, "title")
	assert.deepEqual(ref?.seeds, [0])
	// "like star wars": the title's key, not Sternenkrieg's.
	assert.deepEqual(
		resolveReference(index, "like star wars", "like star wars", false)?.seeds,
		[2],
	)
	// A title below 10,000 votes isn't a reference by its localized name either.
	assert.equal(aliasReference(index, "einsamer stern"), 3)
	const low = fixture()
	;(low.titleTable.votes as Float64Array)[3] = 9_000
	assert.equal(aliasReference(low, "einsamer stern"), undefined)
})

test("the evaluation set holds five localized names per launch language, 20 titles, and 10 shared names", () => {
	const set = JSON.parse(
		readFileSync(new URL("./alias-eval.fixture.json", import.meta.url), "utf8"),
	) as {
		localized: { query: string; language: string; expect: string }[]
		canonical: { query: string; expect: string }[]
		ambiguous: { query: string; expect: string; why: string }[]
	}
	const languages = "en de fr es it pt ja ko zh pl ru ar".split(" ")
	for (const language of languages)
		assert.equal(
			set.localized.filter((c) => c.language === language).length,
			5,
			language,
		)
	assert.equal(set.localized.length, 60)
	assert.equal(set.canonical.length, 20)
	assert.equal(set.ambiguous.length, 10)
	for (const c of [...set.localized, ...set.canonical, ...set.ambiguous])
		assert.match(c.expect, /^(movie|show):\d+$/, c.query)
})

test("like X takes a two-character Chinese, Japanese or Korean name, and still no two-letter Latin key", () => {
	const index = fixture(
		aliasTable(
			{
				version: 1,
				rows: [7, 7, 7],
				names: ["教父", "대부", "Pa"],
				languages: ["zh", "ko", "it"],
			},
			titles.length,
		),
	)
	const seeds = (q: string) => {
		const text = `like ${q}`
		const ref = resolveReference(index, text, text, true)
		return ref?.kind === "title" ? ref.seeds : null
	}
	assert.deepEqual(seeds("教父"), [7])
	assert.deepEqual(seeds("대부"), [7])
	assert.equal(seeds("pa"), null)
	assert.equal(aliasReference(index, "pa"), 7, "the alias itself is there")
})
