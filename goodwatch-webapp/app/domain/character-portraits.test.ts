import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type CharacterPortrait,
	type CharacterRole,
	byRenown,
	characterNamePatterns,
	characterQuery,
	escapeLike,
	foldName,
	isSelfRole,
	matchBoost,
	matchBoostPatterns,
	matchName,
	onePerTitle,
	pickRole,
	portraitLookup,
	rankCharacterMatches,
} from "./character-portraits.ts"

const portrait = (p: Partial<CharacterPortrait>): CharacterPortrait => ({
	mediaType: "show",
	tmdbId: 1396,
	character: "Walter White",
	personName: "Bryan Cranston",
	personTmdbId: null,
	image: "https://artworks.thetvdb.com/a.jpg",
	actorImage: null,
	...p,
})

const role = (p: Partial<CharacterRole>): CharacterRole => ({
	...portrait(p),
	title: "Breaking Bad",
	year: 2008,
	posterPath: null,
	popularity: 1,
	votes: 0,
	...p,
})

test("names fold to lowercase words without accents or punctuation", () => {
	assert.equal(foldName("  Zoë  D'Amato "), "zoe d amato")
	assert.equal(foldName("Penélope Cruz"), "penelope cruz")
	assert.equal(foldName("Walter White, Jr."), "walter white jr")
})

test("a lookup needs two characters, keeps single spaces and lowercase, and is capped", () => {
	assert.equal(characterQuery(" w "), null)
	assert.equal(characterQuery("Walter   WH"), "walter wh")
	assert.equal(characterQuery("x".repeat(100))?.length, 60)
})

test("LIKE patterns match the name's start or a word's start, with wildcards in the text escaped", () => {
	assert.deepEqual(characterNamePatterns("walter"), ["walter%", "% walter%"])
	assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b")
	assert.deepEqual(characterNamePatterns("50%"), ["50\\%%", "% 50\\%%"])
})

test("self and narrator roles are no characters", () => {
	assert.equal(isSelfRole("Himself"), true)
	assert.equal(isSelfRole("Self - Host"), true)
	assert.equal(isSelfRole("Narrator (voice)"), true)
	assert.equal(isSelfRole("Selfridge"), false)
	assert.equal(isSelfRole("Walter White"), false)
})

test("search matches drop self roles and duplicates, then rank by fame times the name's match", () => {
	const ranked = rankCharacterMatches(
		[
			role({ character: "Skyler White", votes: 150 }),
			role({ character: "Walter White", votes: 150, popularity: 2 }),
			role({ character: "walter white", votes: 150 }),
			role({ character: "Himself", votes: 900 }),
			role({ tmdbId: 2, character: "White Goodman", votes: 100 }),
			role({ tmdbId: 3, character: "Whitey Bulger", votes: 120 }),
		],
		"white",
		10,
	)
	assert.deepEqual(
		ranked.map((r) => r.character),
		// Whole words: White Goodman 101 × 4 is below 151 × 4 (popularity breaks the tie); Whitey only starts with it.
		["Walter White", "Skyler White", "White Goodman", "Whitey Bulger"],
	)
	assert.equal(rankCharacterMatches(ranked, "white", 1).length, 1)
})

test("jon finds Jon Snow before Jonathan and the Joneses, and fame still leads within a kind of match", () => {
	const ranked = rankCharacterMatches(
		[
			role({ tmdbId: 1, character: "Indiana Jones", votes: 1_100_000 }),
			role({ tmdbId: 2, character: "Morgan Jones", votes: 1_200_000 }),
			role({ tmdbId: 3, character: "Jonathan Byers", votes: 1_700_000 }),
			role({ tmdbId: 4, character: "Jon Snow", votes: 2_600_000 }),
			role({ tmdbId: 5, character: "Jon Arbuckle", votes: 40_000 }),
		],
		"Jon",
		10,
	)
	assert.deepEqual(
		ranked.map((r) => r.character),
		[
			"Jon Snow",
			"Jonathan Byers",
			"Morgan Jones",
			"Indiana Jones",
			"Jon Arbuckle",
		],
	)
})

test("a name's match: a whole word counts 4, the name's start 2, a later word's start 1", () => {
	assert.equal(matchBoost("jon snow", "jon"), 4)
	assert.equal(matchBoost("jon snow", "snow"), 4)
	assert.equal(matchBoost("jon", "jon"), 4)
	assert.equal(matchBoost("lord jon snow", "jon"), 4)
	assert.equal(matchBoost("walter white jr", "walter white"), 4)
	assert.equal(matchBoost("jonathan byers", "jon"), 2)
	assert.equal(matchBoost("walter white", "walter wh"), 2)
	assert.equal(matchBoost("morgan jones", "jon"), 1)
	assert.deepEqual(matchBoostPatterns("jon"), {
		word: ["jon", "jon %", "% jon", "% jon %"],
		start: "jon%",
	})
	assert.deepEqual(matchBoostPatterns("5_%").start, "5\\_\\%%")
})

/** ILIKE with the patterns' escapes, as Crate runs it. */
const ilike = (text: string, pattern: string) => {
	const re = pattern.replace(/\\(.)|%|_|[.*+?^${}()|[\]]/g, (m, esc) =>
		esc !== undefined
			? esc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			: m === "%"
				? ".*"
				: m === "_"
					? "."
					: `\\${m}`,
	)
	return new RegExp(`^${re}$`, "is").test(text)
}

test("the SQL ranking scores names exactly like matchBoost, so its cutoff keeps the final top", () => {
	const sqlBoost = (character: string, q: string) => {
		const name = character.trim()
		const p = matchBoostPatterns(q)
		if (p.word.some((w) => ilike(name, w))) return 4
		return ilike(name, p.start) ? 2 : 1
	}
	const names = [
		"Jon-Snow",
		"Jon Snow",
		" Jon Snow",
		"Jonathan Byers",
		"Morgan Jones",
		"JON",
		"Zoë Jon",
		"Mr. Jon Arbuckle",
	]
	for (const q of ["jon", "snow", "jon snow", "zoë"])
		for (const name of names)
			assert.equal(
				matchBoost(matchName(name), characterQuery(q) ?? ""),
				sqlBoost(name, q),
				`${name} / ${q}`,
			)
})

test("of several portraits in one title, the one matching the credit's character wins", () => {
	const list = [
		portrait({ character: "Hal" }),
		portrait({ character: "Walter White" }),
	]
	assert.equal(
		pickRole(list, ["Walter White / Heisenberg"])?.character,
		"Walter White",
	)
	assert.equal(pickRole(list, ["Someone else"])?.character, "Hal")
	assert.equal(pickRole([], ["x"]), undefined)
})

test("a cast member finds their portrait by TMDB id, else by folded name", () => {
	const of = portraitLookup([
		portrait({
			personTmdbId: 84497,
			personName: "Aaron Paul",
			character: "Jesse Pinkman",
		}),
		portrait({ personName: "Bryan  Cranston", character: "Walter White" }),
		portrait({ personName: "Anna Gunn", character: "Skyler White" }),
	])
	assert.equal(of({ id: 84497, name: "A. Paul" })?.character, "Jesse Pinkman")
	assert.equal(
		of({ id: 17419, name: "bryan cranston" })?.character,
		"Walter White",
	)
	assert.equal(of({ id: 1, name: "Nobody" }), undefined)
	assert.equal(of({ id: 1, name: null }), undefined)
})

test("a person's roles keep one per title, best known first", () => {
	const roles = [
		role({ tmdbId: 1, votes: 10, character: "A" }),
		role({ tmdbId: 2, votes: 500, character: "B" }),
		role({ tmdbId: 2, votes: 500, character: "C" }),
	].sort(byRenown)
	assert.deepEqual(
		onePerTitle(roles).map((r) => r.character),
		["B", "A"],
	)
})
