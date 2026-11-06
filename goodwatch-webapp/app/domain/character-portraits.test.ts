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

test("search matches drop self roles and duplicates, then rank popular titles and name starts first", () => {
	const ranked = rankCharacterMatches(
		[
			role({ character: "Skyler White", popularity: 150 }),
			role({ character: "Walter White", popularity: 150 }),
			role({ character: "walter white", popularity: 150 }),
			role({ character: "Himself", popularity: 900 }),
			role({ tmdbId: 2, character: "White Goodman", popularity: 100 }),
		],
		"white",
		10,
	)
	assert.deepEqual(
		ranked.map((r) => r.character),
		// White Goodman starts with the text: 100 × 2 beats 150.
		["White Goodman", "Skyler White", "Walter White"],
	)
	assert.equal(rankCharacterMatches(ranked, "white", 1).length, 1)
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
