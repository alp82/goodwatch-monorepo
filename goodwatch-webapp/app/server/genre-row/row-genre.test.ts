import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const { genrePool, rowGenre, sitemapPaths } = await import("./row-genre.ts")
const { FLAG_ADULT, FLAG_POSTER } = await import(
	"../title-snapshot/format.server.ts"
)
const { genreRowHeading } = await import("./pick.ts")

const listed = sitemapPaths(
	readFileSync(
		new URL("../../../public/sitemaps/sitemap_categories.xml", import.meta.url),
		"utf8",
	),
)
const heading = (
	mediaType: "movie" | "show",
	genres: string[],
	pages = listed,
) => {
	const genre = rowGenre(mediaType, genres, pages)
	return (
		genre && {
			heading: genreRowHeading(genre.page.label, mediaType),
			path: genre.page.path,
			young: genre.young,
		}
	)
}

test("the sitemap lists the Kids and Family genre pages a row may link to", () => {
	assert.ok(listed.has("/shows/genres/kids"))
	assert.ok(listed.has("/shows/genres/family"))
	assert.ok(listed.has("/movies/genres/family"))
	assert.ok(
		!listed.has("/movies/genres/kids"),
		"TMDB has no Kids genre for movies",
	)
})

test("a Kids or Family genre wins over the breadcrumb's, with its own heading and link", () => {
	// Paw Patrol, Peppa Pig: TMDB lists Animation first.
	assert.deepEqual(heading("show", ["Animation", "Kids"]), {
		heading: "More kids shows",
		path: "/shows/genres/kids",
		young: true,
	})
	// Home Alone.
	assert.deepEqual(heading("movie", ["Comedy", "Family"]), {
		heading: "More family movies",
		path: "/movies/genres/family",
		young: true,
	})
	// Bluey: Kids wins over Family, in whatever order TMDB lists them.
	assert.equal(
		heading("show", ["Animation", "Comedy", "Family", "Kids"])?.path,
		"/shows/genres/kids",
	)
	assert.equal(
		heading("show", ["Comedy", "Family"])?.path,
		"/shows/genres/family",
	)
})

test("without a listed Kids or Family page, the row keeps the breadcrumb's genre but only Kids or Family titles", () => {
	// No Kids page for movies.
	assert.deepEqual(heading("movie", ["Animation", "Kids"]), {
		heading: "More animated movies",
		path: "/movies/genres/animation",
		young: true,
	})
	// A page the sitemap doesn't list.
	const withoutKids = new Set(
		[...listed].filter((path) => path !== "/shows/genres/kids"),
	)
	assert.deepEqual(heading("show", ["Animation", "Kids"], withoutKids), {
		heading: "More animated shows",
		path: "/shows/genres/animation",
		young: true,
	})
})

test("a title for grown-ups keeps the breadcrumb's genre and every title of it", () => {
	// Love, Death & Robots.
	assert.deepEqual(heading("show", ["Animation", "Sci-Fi & Fantasy"]), {
		heading: "More animated shows",
		path: "/shows/genres/animation",
		young: false,
	})
	assert.equal(heading("movie", []), null)
})

test("a young pool takes only Kids or Family titles, in the sitemap part and the fallback", () => {
	const genreNames = ["Animation", "Family", "Kids", "Sci-Fi & Fantasy"]
	const bits = (...names: string[]) =>
		names.reduce((all, name) => all | (1 << genreNames.indexOf(name)), 0)
	const SHOW = 2e12
	const rows = [
		{ key: SHOW + 1, genres: bits("Animation", "Kids"), votes: 900 },
		{
			key: SHOW + 2,
			genres: bits("Animation", "Sci-Fi & Fantasy"),
			votes: 5000,
		}, // adult animation
		{ key: SHOW + 3, genres: bits("Animation", "Family"), votes: 700 },
		{ key: SHOW + 4, genres: bits("Animation"), votes: 8000 }, // in the sitemap, not for children
		{ key: SHOW + 5, genres: bits("Animation", "Kids"), votes: 600 }, // in the sitemap
		{
			key: SHOW + 6,
			genres: bits("Animation", "Kids"),
			votes: 9000,
			flags: FLAG_POSTER | FLAG_ADULT,
		},
		{ key: SHOW + 7, genres: bits("Kids"), votes: 9999 }, // not Animation
		{ key: 1e12 + 8, genres: bits("Animation", "Kids"), votes: 9999 }, // a movie
	]
	const columns = {
		pointIds: Float64Array.from(
			rows.map((row) => row.key).sort((a, b) => a - b),
		),
		genreNames,
		genres: Uint32Array.from(
			[...rows].sort((a, b) => a.key - b.key).map((row) => row.genres),
		),
		votes: Uint32Array.from(
			[...rows].sort((a, b) => a.key - b.key).map((row) => row.votes),
		),
		flags: Uint8Array.from(
			[...rows]
				.sort((a, b) => a.key - b.key)
				.map((row) => row.flags ?? FLAG_POSTER),
		),
	}
	const options = {
		mediaType: "show" as const,
		genre: "Animation",
		preferred: new Set([SHOW + 4, SHOW + 5]),
		fallbackSize: 64,
	}
	const keys = (titles: { key: number }[]) => titles.map((title) => title.key)
	const young = genrePool(columns, { ...options, young: true })
	assert.deepEqual(keys(young.preferred), [SHOW + 5])
	assert.deepEqual(
		keys(young.fallback),
		[SHOW + 1, SHOW + 3],
		"most voted first, no adult animation",
	)
	const all = genrePool(columns, { ...options, young: false })
	assert.deepEqual(keys(all.preferred), [SHOW + 4, SHOW + 5])
	assert.deepEqual(keys(all.fallback), [SHOW + 2, SHOW + 1, SHOW + 3])
})
