import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { buildJsonLdDetail, buildMeta, jsonLdPeople, ogImageUrl, pagedUrl } =
	await import("./meta.ts")

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

test("a page's Open Graph image is the JPEG under /og/, with index for the home page", () => {
	assert.equal(
		ogImageUrl("https://goodwatch.app/"),
		"https://goodwatch.app/og/index.jpg",
	)
	assert.equal(
		ogImageUrl("https://goodwatch.app/movie/603-the-matrix"),
		"https://goodwatch.app/og/movie/603-the-matrix.jpg",
	)
	assert.equal(
		ogImageUrl("/movies/moods/"),
		"https://goodwatch.app/og/movies/moods.jpg",
	)
})

const jsonLdTags = (tags: Record<string, unknown>[]) =>
	tags.filter((tag) => "script:ld+json" in tag)

test("a page without structured data has no JSON-LD tag, not an empty one", () => {
	assert.deepEqual(jsonLdTags(buildMeta({ pageMeta: page })), [])
	assert.deepEqual(jsonLdTags(buildMeta({ pageMeta: page, items: [] })), [])
})

test("a page with a title or a list has one JSON-LD tag with content", () => {
	const [detail, ...moreDetail] = jsonLdTags(
		buildMeta({ pageMeta: page, item: show([]) }),
	)
	assert.equal(moreDetail.length, 0)
	assert.equal(
		(detail["script:ld+json"] as { "@type": string })["@type"],
		"TVSeries",
	)

	const [list, ...moreList] = jsonLdTags(
		buildMeta({ pageMeta: page, items: [{ title: "Dark" }] as never }),
	)
	assert.equal(moreList.length, 0)
	assert.equal(
		(list["script:ld+json"] as { "@type": string })["@type"],
		"CollectionPage",
	)
})

test("the first page of a list has the list's address, with or without a page parameter", () => {
	const url = "https://goodwatch.app/movies/moods/scary"
	assert.equal(pagedUrl(url, ""), url)
	assert.equal(pagedUrl(url, "?page=1"), url)
	assert.equal(pagedUrl(url, "?page=0"), url)
	assert.equal(pagedUrl(url, "?page=abc"), url)
	assert.equal(pagedUrl(url, "?watchedType=didnt-watch"), url)
})

test("a later page of a list has its page number in the address and no other parameter", () => {
	const url = "https://goodwatch.app/movies/moods/scary"
	assert.equal(pagedUrl(url, "?page=2"), `${url}?page=2`)
	assert.equal(pagedUrl(url, "?utm_source=x&page=12&country=DE"), `${url}?page=12`)
	assert.equal(pagedUrl(url, "?page=02"), `${url}?page=2`)
})

test("the canonical address and og:url of a later page name that page", () => {
	const url = pagedUrl("https://goodwatch.app/movies/moods/scary", "?page=3")
	const tags = buildMeta({ pageMeta: { ...page, url } }) as {
		rel?: string
		href?: string
		property?: string
		content?: string
	}[]
	assert.equal(tags.find((tag) => tag.rel === "canonical")?.href, url)
	assert.equal(tags.find((tag) => tag.property === "og:url")?.content, url)
	assert.equal(
		tags.find((tag) => tag.property === "og:image")?.content,
		"https://goodwatch.app/og/movies/moods/scary.jpg",
	)
})
