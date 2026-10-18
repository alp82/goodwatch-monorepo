// The trail of title and category pages, and its BreadcrumbList structured data.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { breadcrumbJsonLd, categoryCrumbs, titleTrail } = await import(
	"./breadcrumb-trail.ts"
)
const { titleBreadcrumb } = await import(
	"../../server/title-breadcrumb.server.ts"
)
const { buildMeta } = await import("../../utils/meta.ts")

// The genre pages the sitemap lists, the ones a title's trail may link to.
const sitemapGenrePages = new Set(
	[
		...readFileSync("public/sitemaps/sitemap_categories.xml", "utf8").matchAll(
			/<loc>https:\/\/goodwatch\.app(\/[a-z]+\/genres\/[^<]+)<\/loc>/g,
		),
	].map((match) => match[1]),
)

test("a title's trail is its hub and the genre page of its first genre that has one", () => {
	assert.deepEqual(titleBreadcrumb("movie", ["Science Fiction", "Action"]), [
		{ label: "Movies", path: "/movies" },
		{ label: "Science Fiction", path: "/movies/genres/science-fiction" },
	])
	assert.deepEqual(titleBreadcrumb("show", ["Animation", "Comedy"]), [
		{ label: "Shows", path: "/shows" },
		{ label: "Animation", path: "/shows/genres/animation" },
	])
})

test("a show's TMDB genre names find their show genre pages", () => {
	for (const [genre, path] of [
		["Sci-Fi & Fantasy", "/shows/genres/scifi-and-fantasy"],
		["Action & Adventure", "/shows/genres/action-and-adventure"],
		["War & Politics", "/shows/genres/war-and-politics"],
		["Talk", "/shows/genres/talk"],
		["Kids", "/shows/genres/kids"],
	])
		assert.equal(titleBreadcrumb("show", [genre])[1]?.path, path, genre)
})

test("a genre without a page for the title's type is passed over", () => {
	// Movie genres have no show page, and the reverse.
	assert.deepEqual(titleBreadcrumb("show", ["Science Fiction", "Drama"])[1], {
		label: "Drama",
		path: "/shows/genres/drama",
	})
	assert.deepEqual(titleBreadcrumb("movie", ["Talk"]), [
		{ label: "Movies", path: "/movies" },
	])
	assert.deepEqual(titleBreadcrumb("movie", null), [
		{ label: "Movies", path: "/movies" },
	])
})

test("every genre page a trail links to is in the sitemap", () => {
	const movieGenres = [
		"Action",
		"Adventure",
		"Animation",
		"Comedy",
		"Crime",
		"Documentary",
		"Drama",
		"Family",
		"Fantasy",
		"History",
		"Horror",
		"Music",
		"Mystery",
		"Romance",
		"Science Fiction",
		"Thriller",
		"TV Movie",
		"War",
		"Western",
	]
	const showGenres = [
		"Action & Adventure",
		"Animation",
		"Comedy",
		"Crime",
		"Documentary",
		"Drama",
		"Family",
		"Kids",
		"Mystery",
		"News",
		"Reality",
		"Sci-Fi & Fantasy",
		"Soap",
		"Talk",
		"War & Politics",
		"Western",
	]
	for (const [type, names] of [
		["movie", movieGenres],
		["show", showGenres],
	] as const)
		for (const name of names) {
			const genrePage = titleBreadcrumb(type, [name])[1]
			assert.ok(genrePage, `${type} ${name} has a genre page`)
			assert.ok(
				sitemapGenrePages.has(genrePage.path),
				`${genrePage.path} is in the sitemap`,
			)
		}
})

test("a category page's trail is its path, the page's own label last", () => {
	assert.deepEqual(
		categoryCrumbs("/movies/moods/mind-bending", "Mind-Bending 🌀"),
		[
			{ label: "Movies", path: "/movies" },
			{ label: "Moods", path: "/movies/moods" },
			{ label: "Mind-Bending", path: "/movies/moods/mind-bending" },
		],
	)
	assert.equal(
		categoryCrumbs("/shows/genres/scifi-and-fantasy", "Sci-Fi & Fantasy")[2]
			.label,
		"Sci-Fi & Fantasy",
	)
	assert.equal(categoryCrumbs("/movies/moods/epic", "Epic ⚔️")[2].label, "Epic")
	assert.equal(
		categoryCrumbs("/movies/moods/atmospheric", "Atmospheric 🌫️")[2].label,
		"Atmospheric",
	)
	assert.deepEqual(
		categoryCrumbs("/shows/genres").map((crumb) => crumb.label),
		["Shows", "Genres"],
	)
})

test("the BreadcrumbList names every item with a full URL, the page last", () => {
	const trail = titleTrail(
		titleBreadcrumb("show", ["Animation"]),
		"The Simpsons",
		"/show/456-the-simpsons",
	)
	assert.deepEqual(breadcrumbJsonLd(trail), {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: "Shows",
				item: "https://goodwatch.app/shows",
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Animation",
				item: "https://goodwatch.app/shows/genres/animation",
			},
			{
				"@type": "ListItem",
				position: 3,
				name: "The Simpsons",
				item: "https://goodwatch.app/show/456-the-simpsons",
			},
		],
	})
	assert.equal(breadcrumbJsonLd([{ label: "Movies", path: "/movies" }]), null)
	assert.deepEqual(titleTrail([], "The Simpsons", "/show/456-the-simpsons"), [])
})

test("a page with a trail gets the BreadcrumbList as its own structured data block", () => {
	const pageMeta = {
		title: "Mind Bending",
		description: "",
		url: "https://goodwatch.app/movies/moods/mind-bending",
		image: "",
		alt: "",
	}
	const blocks = buildMeta({
		pageMeta,
		breadcrumbs: categoryCrumbs(
			"/movies/moods/mind-bending",
			"Mind-Bending 🌀",
		),
	})
		.filter((tag) => "script:ld+json" in tag)
		.map((tag) => tag["script:ld+json"] as { "@type": string })
	assert.deepEqual(
		blocks.map((block) => block["@type"]),
		["BreadcrumbList"],
	)
	assert.equal(
		buildMeta({ pageMeta }).some((tag) => "script:ld+json" in tag),
		false,
	)
})
