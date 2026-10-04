import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { buildJsonLdDetail, jsonLdPeople } = await import("./meta.ts")

const page = {
	title: "Stranger Things",
	description: "A show",
	url: "https://goodwatch.app/show/66732-stranger-things",
	image: "",
	alt: "",
}
const show = (actors: { id: number; name: string }[]) =>
	({
		mediaType: "show",
		details: {
			title: "Stranger Things",
			genres: ["Drama"],
			number_of_seasons: 5,
			number_of_episodes: 42,
		},
		credits: {
			actors,
			directors: [],
			composers: [],
			executive_producers: [
				{ id: 1, name: "Matt Duffer" },
				{ id: 2, name: "Ross Duffer" },
				{ id: 1, name: "Matt Duffer" },
			],
		},
	}) as never

test("a person with two credits is named once, at the first position", () => {
	assert.deepEqual(
		jsonLdPeople([
			{ id: 10, name: "Winona Ryder" },
			{ id: 20, name: "David Harbour" },
			{ id: 10, name: "Winona Ryder" },
			{ id: 30, name: "Millie Bobby Brown" },
		]).map((person) => person.name),
		["Winona Ryder", "David Harbour", "Millie Bobby Brown"],
	)
})

test("two people with the same name stay two people", () => {
	const people = jsonLdPeople([
		{ id: 1, name: "Chris Evans" },
		{ id: 2, name: "Chris Evans" },
	])
	assert.equal(people.length, 2)
	assert.notEqual(people[0].url, people[1].url)
})

test("the title's structured data names each actor and producer once", () => {
	const jsonLd = buildJsonLdDetail(
		page,
		show([
			{ id: 10, name: "Winona Ryder" },
			{ id: 10, name: "Winona Ryder" },
			{ id: 20, name: "David Harbour" },
		]),
	) as { actor: { url: string }[]; producer: { url: string }[] }
	assert.equal(jsonLd.actor.length, 2)
	assert.equal(new Set(jsonLd.actor.map((actor) => actor.url)).size, 2)
	assert.equal(jsonLd.producer.length, 2)
})

test("a title without actors has no actor property", () => {
	const jsonLd = buildJsonLdDetail(page, show([])) as { actor?: unknown }
	assert.equal(jsonLd.actor, undefined)
})
