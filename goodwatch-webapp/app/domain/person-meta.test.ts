import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { personMetaText, titleCounts } = await import("./person-meta.ts")

const person = {
	name: "Ada Example",
	department: "Acting" as string | null | undefined,
	movies: 18,
	shows: 1,
	titles: 19,
	knownFor: ["First", "Second", "Third", "Fourth"],
	hasPortrait: true,
}

test("an actor's meta text names movies and TV shows", () => {
	assert.deepEqual(personMetaText(person), {
		title: "Ada Example: Movies and TV Shows | GoodWatch",
		description:
			"Ada Example's movies and TV shows: 18 movies and 1 TV show, including First, Second, Third. See what their work feels like, who they work with, and their best-rated titles.",
		alt: "Ada Example (actor, 19 titles) on GoodWatch, with portrait",
		jobTitle: "Acting",
	})
})

test("another department is named in lower case", () => {
	const text = personMetaText({ ...person, department: "Directing" })
	assert.equal(text.title, "Ada Example: Filmography | GoodWatch")
	assert.match(text.description, /^Ada Example's directing credits: /)
	assert.equal(
		text.alt,
		"Ada Example (directing, 19 titles) on GoodWatch, with portrait",
	)
	assert.equal(text.jobTitle, "Directing")
})

test("a person without a department gets meta text without one", () => {
	for (const department of [null, undefined, "", "  "]) {
		const text = personMetaText({
			...person,
			department,
			hasPortrait: false,
		})
		assert.deepEqual(text, {
			title: "Ada Example: Filmography | GoodWatch",
			description:
				"Ada Example's credits: 18 movies and 1 TV show, including First, Second, Third. See what their work feels like, who they work with, and their best-rated titles.",
			alt: "Ada Example (19 titles) on GoodWatch",
			jobTitle: undefined,
		})
		for (const value of Object.values(text))
			assert.doesNotMatch(String(value ?? ""), /null|undefined/)
	}
})

test("a person without titles or known-for titles still reads well", () => {
	const text = personMetaText({
		...person,
		department: null,
		movies: 0,
		shows: 0,
		titles: 0,
		knownFor: [],
	})
	assert.equal(
		text.description,
		"Ada Example's credits. See what their work feels like, who they work with, and their best-rated titles.",
	)
})

test("title counts leave out a zero part", () => {
	assert.equal(titleCounts(18, 0), "18 movies")
	assert.equal(titleCounts(4, 1), "4 movies and 1 TV show")
	assert.equal(titleCounts(0, 0), "")
})
