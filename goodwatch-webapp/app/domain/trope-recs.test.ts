import assert from "node:assert/strict"
import { test } from "node:test"
import {
	findTrope,
	rankLine,
	readRecsQuery,
	tropeByName,
	tropeRecsPath,
	tropeSlug,
} from "./trope-recs.ts"

const MAIN = "https://tvtropes.org/pmwiki/pmwiki.php/Main/AntiHero"
const OTHER = "https://tvtropes.org/pmwiki/pmwiki.php/UsefulNotes/FilmNoir"
const LABEL = 'label:["Loner Hero",""]'
const tropes = [
	{
		id: MAIN,
		name: "Anti-Hero",
		rank: 1,
		count: 12,
		loved: 9,
		labels: ["Anti Hero", "AntiHero"],
	},
	{
		id: OTHER,
		name: "Film Noir",
		rank: 2,
		count: 10,
		loved: 7,
		labels: ["FilmNoir"],
	},
	{
		id: LABEL,
		name: "Loner Hero",
		rank: 3,
		count: 10,
		loved: 6,
		labels: ["Loner Hero"],
	},
]

test("a trope's key: Main page name, Namespace.Page, or the identity itself", () => {
	assert.equal(tropeSlug(MAIN), "AntiHero")
	assert.equal(tropeSlug(OTHER), "UsefulNotes.FilmNoir")
	assert.equal(tropeSlug(LABEL), LABEL)
})

test("findTrope reads a key in any case or a full id, and only the member's own tropes", () => {
	assert.equal(findTrope(tropes, "AntiHero")?.id, MAIN)
	assert.equal(findTrope(tropes, "antihero")?.id, MAIN)
	assert.equal(findTrope(tropes, MAIN)?.id, MAIN)
	assert.equal(findTrope(tropes, "UsefulNotes.FilmNoir")?.id, OTHER)
	assert.equal(findTrope(tropes, LABEL)?.id, LABEL)
	assert.equal(findTrope(tropes, "FilmNoir"), null)
	assert.equal(findTrope(tropes, "Unknown"), null)
	assert.equal(findTrope(tropes, null), null)
	assert.equal(findTrope(tropes, ""), null)
})

test("addresses round-trip through the page's query", () => {
	assert.equal(tropeRecsPath(), "/watch/for-you/tropes")
	assert.equal(tropeRecsPath({ kind: "all" }), "/watch/for-you/tropes")
	assert.equal(
		tropeRecsPath({ trope: MAIN, kind: "show" }),
		"/watch/for-you/tropes?trope=AntiHero&kind=show",
	)
	const label = tropeRecsPath({ trope: LABEL })
	const query = readRecsQuery(new URL(label, "https://x.test").searchParams)
	assert.equal(findTrope(tropes, query.trope)?.id, LABEL)
	assert.deepEqual(readRecsQuery(new URLSearchParams("kind=movie")), {
		trope: null,
		kind: "movie",
	})
	assert.deepEqual(readRecsQuery(new URLSearchParams("kind=x&trope=")), {
		trope: null,
		kind: "all",
	})
})

test("a title page's trope names find the member's trope through its labels", () => {
	const find = tropeByName(tropes)
	assert.equal(find("AntiHero")?.id, MAIN)
	assert.equal(find("anti-hero")?.id, MAIN)
	assert.equal(find("Film Noir")?.id, OTHER)
	assert.equal(find("Loner Hero")?.id, LABEL)
	assert.equal(find("Big Bad"), null)
	assert.equal(find("---"), null)
})

test("the rank line", () => {
	assert.equal(rankLine(1, 100, 5), "#1 · 100 · 5 of your tropes")
	assert.equal(rankLine(12, 87), "#12 · 87")
})
