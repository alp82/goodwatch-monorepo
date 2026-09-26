import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
	type IndexedPerson,
	HIGH_CONFIDENCE,
	MEDIUM_CONFIDENCE,
	buildPeopleIndex,
	gatePeople,
	isOwnActingCredit,
	nameMatchConfidence,
	nameWords,
	peopleInQuery,
} from "./matching.server.ts"

const person = (
	id: number,
	name: string,
	popularity: number,
): IndexedPerson => ({
	id,
	name,
	popularity,
	profile: null,
	department: "Acting",
})
const bradPitt = person(287, "Brad Pitt", 12)
const clooney = person(1461, "George Clooney", 9)
const hanks = person(31, "Tom Hanks", 20)
const cruise = person(500, "Tom Cruise", 25)
const hardy = person(2524, "Tom Hardy", 15)
const minorTom = person(9, "Tom Minor", 2)
const index = buildPeopleIndex([
	bradPitt,
	clooney,
	hanks,
	cruise,
	hardy,
	minorTom,
	person(10, "Brad Pitt", 1.5),
	person(11, "Zendaya", 30),
	person(12, "Stephen King", 8),
	person(13, "Robert Downey Jr.", 10),
	person(14, "Penélope Cruz", 7),
])
const ids = (people: IndexedPerson[]) => people.map((p) => p.id)

describe("nameWords", () => {
	test("folds case, diacritics, possessives and punctuation", () => {
		assert.deepEqual(nameWords("Penélope Cruz's  BEST films!"), [
			"penelope",
			"cruz",
			"best",
			"films",
		])
	})
})

describe("peopleInQuery", () => {
	test("finds a full name inside a phrase and ranks the rest", () => {
		const found = peopleInQuery("funny brad pitt movies", index)
		assert.deepEqual(ids(found.named), [287])
		assert.equal(found.rest, "funny movies")
		assert.deepEqual(found.offered, [])
	})

	test("keeps the most popular person with a shared name", () => {
		assert.deepEqual(ids(peopleInQuery("brad pitt drama", index).named), [287])
	})

	test("drops joining words next to names", () => {
		const two = peopleInQuery("brad pitt and george clooney heist", index)
		assert.deepEqual(ids(two.named), [287, 1461])
		assert.equal(two.rest, "heist")
		const inSpace = peopleInQuery("movies with tom hanks in space", index)
		assert.deepEqual(ids(inSpace.named), [31])
		assert.equal(inSpace.rest, "movies in space")
	})

	test("keeps joining words away from names", () => {
		assert.equal(
			peopleInQuery("love and war with tom hanks", index).rest,
			"love and war",
		)
	})

	test("drops a possessive s after a name", () => {
		assert.equal(
			peopleInQuery("brad pitt's best movies", index).rest,
			"best movies",
		)
		assert.equal(
			peopleInQuery("brad pitt s best movies", index).rest,
			"best movies",
		)
	})

	test("matches longer names first, with diacritics and suffixes", () => {
		assert.deepEqual(
			ids(peopleInQuery("robert downey jr comedies", index).named),
			[13],
		)
		assert.deepEqual(
			ids(peopleInQuery("penelope cruz drama", index).named),
			[14],
		)
	})

	test("leaves one-word names to the title lookup", () => {
		const found = peopleInQuery("zendaya movies", index)
		assert.deepEqual(found.named, [])
		assert.equal(found.rest, "zendaya movies")
	})

	test("a query that is only a name leaves nothing to rank", () => {
		const found = peopleInQuery("Tom Hanks", index)
		assert.deepEqual(ids(found.named), [31])
		assert.equal(found.rest, "")
	})

	test("offers famous people for a single name word in a phrase", () => {
		const found = peopleInQuery("funny tom", index)
		assert.deepEqual(found.named, [])
		assert.equal(found.rest, "funny tom")
		// Most popular first; Tom Minor is below the popularity bar.
		assert.deepEqual(ids(found.offered), [500, 31, 2524])
	})

	test("a single word alone offers nobody", () => {
		assert.deepEqual(peopleInQuery("tom", index).offered, [])
	})

	test("ordinary words and short words offer nobody", () => {
		assert.deepEqual(peopleInQuery("scary king movies", index).offered, [])
		assert.deepEqual(peopleInQuery("jr movies", index).offered, [])
	})

	test("descriptive queries name nobody", () => {
		const found = peopleInQuery("sad movies like the notebook", index)
		assert.deepEqual(found.named, [])
		assert.deepEqual(found.offered, [])
		assert.equal(found.rest, "sad movies like the notebook")
	})
})

describe("nameMatchConfidence", () => {
	test("an exact name is certain", () => {
		assert.equal(nameMatchConfidence("tom hanks", "Tom Hanks", 20), 1)
		assert.equal(nameMatchConfidence("Penelope Cruz", "Penélope Cruz", 7), 1)
	})

	test("all query words in the name is high", () => {
		assert.ok(
			nameMatchConfidence("hanks tom", "Tom Hanks", 1) >= HIGH_CONFIDENCE,
		)
		// The last word may still be typed.
		assert.ok(nameMatchConfidence("tom han", "Tom Hanks", 1) >= HIGH_CONFIDENCE)
	})

	test("one name word shows only famous people", () => {
		const famous = nameMatchConfidence("nolan", "Christopher Nolan", 10)
		const unknown = nameMatchConfidence("nolan", "Nolan North", 2)
		assert.equal(famous, 0.45 + 0.25)
		assert.ok(famous >= MEDIUM_CONFIDENCE)
		assert.ok(unknown < MEDIUM_CONFIDENCE)
	})

	test("a one-word name needs fame too, even when it is the whole name", () => {
		// TMDB has people credited as just "Nolan".
		assert.ok(nameMatchConfidence("nolan", "Nolan", 0.6) < MEDIUM_CONFIDENCE)
		assert.ok(
			nameMatchConfidence("Zendaya", "Zendaya", 30) >= MEDIUM_CONFIDENCE,
		)
	})

	test("a prefix alone stays below the bar unless very famous", () => {
		assert.ok(
			nameMatchConfidence("heat", "Heather Graham", 4) < MEDIUM_CONFIDENCE,
		)
		assert.equal(nameMatchConfidence("heat", "Heather Graham", 100), 0.25 + 0.3)
	})

	test("a query with words outside the name scores nothing", () => {
		assert.equal(nameMatchConfidence("funny tom", "Tom Hanks", 20), 0)
		assert.equal(nameMatchConfidence("sad movies", "Sad Man", 20), 0)
		assert.equal(nameMatchConfidence("", "Tom Hanks", 20), 0)
	})
})

describe("gatePeople", () => {
	const lookup = (p: IndexedPerson) => ({ ...p, profile: "/from-lookup.jpg" })

	test("shows people the whole query names, most certain first", () => {
		const shown = gatePeople("nolan", {
			named: [],
			offered: [],
			lookup: [
				person(1, "Nolan North", 2),
				person(525, "Christopher Nolan", 10),
				person(2, "Jonathan Nolan", 3),
			],
		})
		assert.deepEqual(ids(shown), [525])
	})

	test("descriptive queries show nobody", () => {
		const shown = gatePeople("heat", {
			named: [],
			offered: [],
			lookup: [person(3, "Heather Graham", 5), person(4, "Heath Ledger", 9)],
		})
		assert.deepEqual(shown, [])
	})

	test("prefers the title lookup's entry for a person found twice", () => {
		const shown = gatePeople("Tom Hanks", {
			named: [hanks],
			offered: [],
			lookup: [lookup(hanks), lookup(person(33, "Colin Hanks", 3))],
		})
		assert.deepEqual(shown, [lookup(hanks)])
	})

	test("names in the phrase lead, offered people follow by fame", () => {
		const shown = gatePeople("brad pitt and tom", {
			named: [bradPitt],
			offered: [hanks, cruise],
			lookup: [],
		})
		assert.deepEqual(ids(shown), [287, 500, 31])
	})

	test("shows at most eight people", () => {
		const many = Array.from({ length: 12 }, (_, i) =>
			person(100 + i, `Tom ${i}`, i),
		)
		assert.equal(
			gatePeople("funny tom", { named: [], offered: many, lookup: [] }).length,
			8,
		)
	})
})

describe("isOwnActingCredit", () => {
	const credit = (
		media_type: string,
		character: string | null,
		order_default: number | null,
	) => ({ media_type, character, order_default })

	test("counts roles in movies and regular roles in shows", () => {
		assert.ok(isOwnActingCredit(credit("movie", "Tyler Durden", 1)))
		assert.ok(isOwnActingCredit(credit("movie", "Cameo", 900)))
		assert.ok(isOwnActingCredit(credit("show", "Rachel Green", 0)))
		assert.ok(isOwnActingCredit(credit("show", null, null)))
	})

	test("skips appearances as themselves", () => {
		assert.ok(!isOwnActingCredit(credit("movie", "Himself", 3)))
		assert.ok(!isOwnActingCredit(credit("show", "Self - Guest", 2)))
		assert.ok(
			!isOwnActingCredit(credit("movie", "Themselves (archive footage)", 1)),
		)
		// A character whose name merely starts with the word is a role.
		assert.ok(isOwnActingCredit(credit("movie", "Selfridge", 2)))
	})

	test("skips TV guest spots", () => {
		assert.ok(!isOwnActingCredit(credit("show", "Will's Brother", 290)))
		assert.ok(!isOwnActingCredit(credit("show", "Doctor", 100)))
	})
})
