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
		},
		crew: {
			directors: [],
			writers: [],
			composers: [],
			producers: [
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

test("show JSON-LD uses the visible Producer selection", () => {
	const media = show([]) as { crew: { producers: unknown[] } }
	media.crew.producers = [{ id: 9, name: "Credited producer" }]
	const jsonLd = buildJsonLdDetail(page, media as never) as {
		producer: { name: string }[]
	}
	assert.deepEqual(jsonLd.producer.map((person) => person.name), [
		"Credited producer",
	])
})

test("movie JSON-LD keeps five director and composer credits", () => {
	const people = Array.from({ length: 5 }, (_, id) => ({
		id, name: `Person ${id}`,
	}))
	const jsonLd = buildJsonLdDetail(page, {
		mediaType: "movie",
		details: { title: "Movie" },
		credits: { actors: [], directors: people, composers: people },
	} as never) as { director: { name: string }[]; musicBy: { name: string }[] }
	assert.deepEqual(
		jsonLd.director.map((person) => person.name),
		people.map((person) => person.name),
	)
	assert.deepEqual(
		jsonLd.musicBy.map((person) => person.name),
		people.map((person) => person.name),
	)
})

test("a title without actors has no actor property", () => {
	const jsonLd = buildJsonLdDetail(page, show([])) as { actor?: unknown }
	assert.equal(jsonLd.actor, undefined)
})

test("a title's structured data has no null value and no empty list", () => {
	const bare = show([]) as {
		details: Record<string, unknown>
		credits: Record<string, unknown>
		crew: Record<string, unknown>
	}
	Object.assign(bare.details, { genres: [], number_of_seasons: null, number_of_episodes: 0 })
	bare.crew.producers = []
	const json = JSON.stringify(buildJsonLdDetail(page, bare as never))
	assert.doesNotMatch(json, /null|\[\]/)
	const parsed = JSON.parse(json)
	for (const key of ["genre", "numberOfSeasons", "numberOfEpisodes", "producer", "actor"])
		assert.equal(key in parsed, false, key)
})

test("a page's Open Graph image is the JPEG under /og/, with index for the home page", () => {
	assert.equal(
		ogImageUrl("https://goodwatch.app/"),
		"https://goodwatch.app/og/index.jpg?brand=D2",
	)
	assert.equal(
		ogImageUrl("https://goodwatch.app/movie/603-the-matrix"),
		"https://goodwatch.app/og/movie/603-the-matrix.jpg?brand=D2",
	)
	assert.equal(
		ogImageUrl("/movies/moods/"),
		"https://goodwatch.app/og/movies/moods.jpg?brand=D2",
	)
})

test("a card with its own version names it in its image address, so previews fetch the new design", () => {
	assert.equal(
		ogImageUrl("https://goodwatch.app/taste/quiz?view=taste"),
		"https://goodwatch.app/og/taste/quiz.jpg?brand=D2&card=2",
	)
	assert.equal(
		ogImageUrl("https://goodwatch.app/taste"),
		"https://goodwatch.app/og/taste.jpg?brand=D2",
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
	assert.equal(
		pagedUrl(url, "?utm_source=x&page=12&country=DE"),
		`${url}?page=12`,
	)
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
		"https://goodwatch.app/og/movies/moods/scary.jpg?brand=D2",
	)
})

test("a category page's title, description, and image description carry no emoji", async () => {
	const { plainPageMeta, withoutEmoji } = await import("./meta.ts")
	assert.equal(
		withoutEmoji(
			"Discover the best Mind-Bending 🌀 Movies to watch right now.",
		),
		"Discover the best Mind-Bending Movies to watch right now.",
	)
	assert.equal(withoutEmoji("Feel Good ❤️ Shows"), "Feel Good Shows")
	assert.equal(withoutEmoji("Scary 👻: chills"), "Scary: chills")
	assert.equal(withoutEmoji("Family 👨‍👩‍👧 and 👍🏽 fun"), "Family and fun")
	assert.equal(withoutEmoji("Disney+ © 2026 ™"), "Disney+ © 2026 ™")
	assert.equal(withoutEmoji("Rock’n’roll – loud"), "Rock’n’roll – loud")
	const tags = buildMeta({
		pageMeta: plainPageMeta({
			title: "Scary 👻 Movies | GoodWatch",
			description: "Discover the best Scary 👻 Movies to watch right now.",
			url: "https://goodwatch.app/movies/moods/scary",
			image: "",
			alt: "Scary 👻 Movies on GoodWatch",
		}),
	})
	const text = JSON.stringify(tags)
	assert.doesNotMatch(text, /\p{Extended_Pictographic}/u)
	assert.ok(tags.some((tag) => tag.title === "Scary Movies | GoodWatch"))
	assert.ok(
		tags.some(
			(tag) =>
				tag.property === "og:description" &&
				tag.content === "Discover the best Scary Movies to watch right now.",
		),
	)
})

test("a page has one robots tag: index by default, or the directive it asks for", () => {
	const robots = (tags: Record<string, unknown>[]) =>
		tags.filter((tag) => tag.name === "robots").map((tag) => tag.content)
	assert.deepEqual(robots(buildMeta({ pageMeta: page })), ["index, follow"])
	assert.deepEqual(
		robots(buildMeta({ pageMeta: page, robots: "noindex, follow" })),
		["noindex, follow"],
	)
	assert.deepEqual(
		robots(buildMeta({ pageMeta: page, robots: "noindex, nofollow" })),
		["noindex, nofollow"],
	)
})

test("a ranked list page carries its entries as an ItemList and links its neighbor pages", () => {
	const tags = buildMeta({
		pageMeta: { ...page, url: "https://goodwatch.app/movies/best?page=2" },
		itemList: {
			paths: ["/movie/238-the-godfather", "/movie/389-12-angry-men"],
			first: 251,
		},
		pages: { prev: "/movies/best", next: "/movies/best?page=3" },
	}) as Record<string, unknown>[]
	const list = tags.find(
		(tag) =>
			(tag["script:ld+json"] as { "@type"?: string } | undefined)?.["@type"] ===
			"ItemList",
	)?.["script:ld+json"]
	assert.deepEqual(list, {
		"@context": "https://schema.org",
		"@type": "ItemList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 251,
				url: "https://goodwatch.app/movie/238-the-godfather",
			},
			{
				"@type": "ListItem",
				position: 252,
				url: "https://goodwatch.app/movie/389-12-angry-men",
			},
		],
	})
	const link = (rel: string) =>
		tags.find((tag) => tag.tagName === "link" && tag.rel === rel)?.href
	assert.equal(link("canonical"), "https://goodwatch.app/movies/best?page=2")
	assert.equal(link("prev"), "https://goodwatch.app/movies/best")
	assert.equal(link("next"), "https://goodwatch.app/movies/best?page=3")
	assert.equal(
		tags.find((tag) => tag.name === "robots")?.content,
		"index, follow",
	)
})

test("a page without list entries or neighbors has no ItemList and no prev or next link", () => {
	const tags = buildMeta({
		pageMeta: page,
		itemList: { paths: [], first: 1 },
		pages: {},
	}) as Record<string, unknown>[]
	assert.ok(!tags.some((tag) => JSON.stringify(tag).includes("ItemList")))
	assert.ok(!tags.some((tag) => tag.rel === "prev" || tag.rel === "next"))
})

test("the Explorer card has a new preview address while category cards keep theirs", () => {
	assert.match(ogImageUrl("https://goodwatch.app/map"), /&card=2$/)
	for (const path of [
		"/movies/moods/feel-good",
		"/shows/moods/feel-good",
		"/movies/moods/mind-bending",
		"/shows/moods/mind-bending",
	])
		assert.doesNotMatch(ogImageUrl(`https://goodwatch.app${path}`), /[?&]card=/)
})
