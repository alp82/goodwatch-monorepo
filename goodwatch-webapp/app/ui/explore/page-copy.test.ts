import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { explorePageCopy, exploreCategoryCopy, exploreHubCopy } = await import(
	"./page-copy.ts"
)
const { mainHierarchy } = await import("./main-nav.ts")

const types = ["movies", "shows"] as const
type Category = keyof typeof mainHierarchy
const categories = Object.keys(mainHierarchy) as Category[]

const everyPage = () =>
	types.flatMap((type) =>
		categories.flatMap((category) =>
			Object.values(mainHierarchy[category])
				.filter((pageData) => ["all", type].includes(pageData.type))
				.map((pageData) => ({
					type,
					category,
					pageData,
					copy: explorePageCopy(type, category, pageData),
				})),
		),
	)

test("a list is named in the words a searcher uses", () => {
	const { moods, genres, streaming } = mainHierarchy
	assert.equal(
		explorePageCopy("movies", "moods", moods["mind-bending"]).heading,
		"Mind-bending movies",
	)
	assert.equal(
		explorePageCopy("shows", "genres", genres.animation).heading,
		"Best animated TV shows",
	)
	assert.equal(
		explorePageCopy("shows", "streaming", streaming["amazon-prime"]).heading,
		"TV shows on Amazon Prime Video",
	)
})

test("the hubs and the category lists have their own heading", () => {
	assert.equal(
		exploreHubCopy("movies").heading,
		"The best movies and where to stream them",
	)
	assert.equal(
		exploreCategoryCopy("shows", "genres").heading,
		"The best TV shows by genre",
	)
})

test("every page has its own heading and intro", () => {
	const copies = [
		...everyPage().map(({ copy }) => copy),
		...types.flatMap((type) => [
			exploreHubCopy(type),
			...categories.map((category) => exploreCategoryCopy(type, category)),
		]),
	]
	assert.equal(new Set(copies.map((copy) => copy.heading)).size, copies.length)
	assert.equal(new Set(copies.map((copy) => copy.intro)).size, copies.length)
})

test("a heading has no emoji and the intro no markdown", () => {
	for (const { copy } of everyPage()) {
		assert.match(copy.heading, /^[\p{L}\p{N} &'+-]+$/u, copy.heading)
		assert.doesNotMatch(copy.intro, /\*/, copy.intro)
	}
})

test("the intro of a list keeps its category's description", () => {
	const scary = mainHierarchy.moods.scary
	const intro = explorePageCopy("shows", "moods", scary).intro
	assert.ok(intro.startsWith(scary.description), intro)
	assert.ok(
		intro.endsWith("The most popular scary TV shows on GoodWatch come first."),
	)
})
