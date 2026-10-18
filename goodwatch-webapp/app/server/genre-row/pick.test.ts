import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const {
	GENRE_ROW_SIZE,
	genreRowHeading,
	pickGenreRow,
	rankGenreRow,
	sitemapSelection,
} = await import("./pick.ts")
const { titleGenrePage } = await import("../title-breadcrumb.server.ts")

const MOVIE = 1e12
const titles = (from: number, count: number, votes = (id: number) => id) =>
	Array.from({ length: count }, (_, at) => ({
		key: MOVIE + from + at,
		votes: votes(from + at),
	}))
const keys = (picked: { key: number }[]) => picked.map((title) => title.key)

test("a row takes eight sitemap titles of the genre, most voted first", () => {
	const row = pickGenreRow({
		page: MOVIE + 1,
		preferred: titles(100, 40),
		fallback: titles(500, 40),
		exclude: new Set(),
	})
	assert.equal(row.length, GENRE_ROW_SIZE)
	assert.ok(
		row.every((title) => title.key < MOVIE + 500),
		"only sitemap titles",
	)
	const votes = row.map((title) => title.votes)
	assert.deepEqual(
		votes,
		[...votes].sort((a, b) => b - a),
	)
})

test("a row leaves out the page, the titles the page shows elsewhere, and repeats", () => {
	const preferred = titles(100, 12)
	const page = preferred[0].key
	const exclude = new Set(keys(preferred.slice(1, 5)))
	const row = pickGenreRow({
		page,
		// The same title twice, and a sitemap title in the fallback too.
		preferred: [...preferred, preferred[6]],
		fallback: [preferred[7], ...titles(500, 10)],
		exclude,
	})
	const picked = keys(row)
	assert.equal(picked.length, GENRE_ROW_SIZE)
	assert.equal(new Set(picked).size, picked.length, "no title twice")
	assert.ok(!picked.includes(page), "not the page itself")
	assert.ok(!picked.some((key) => exclude.has(key)), "not a related title")
	// 12 sitemap titles less the page and 4 excluded leave 7; the eighth comes from the fallback.
	assert.equal(picked.filter((key) => key < MOVIE + 500).length, 7)
})

test("a row is the same for the same page, in whatever order its candidates come", () => {
	const preferred = titles(100, 60)
	const fallback = titles(500, 20)
	const input = {
		page: MOVIE + 7,
		preferred,
		fallback,
		exclude: new Set<number>(),
	}
	const first = keys(pickGenreRow(input))
	assert.deepEqual(keys(pickGenreRow(input)), first)
	assert.deepEqual(
		keys(
			pickGenreRow({
				...input,
				preferred: [...preferred].reverse(),
				fallback: [...fallback].reverse(),
			}),
		),
		first,
	)
	// Another page gets another row.
	assert.notDeepEqual(keys(pickGenreRow({ ...input, page: MOVIE + 8 })), first)
})

test("a genre with few sitemap titles fills from its other titles, and a small genre gives a short row", () => {
	const short = pickGenreRow({
		page: MOVIE + 1,
		preferred: titles(100, 3),
		fallback: titles(500, 30),
		exclude: new Set(),
	})
	assert.equal(short.length, GENRE_ROW_SIZE)
	assert.equal(
		short.filter((title) => title.key < MOVIE + 500).length,
		3,
		"every sitemap title",
	)

	const tiny = pickGenreRow({
		page: MOVIE + 1,
		preferred: [],
		fallback: titles(500, 5),
		exclude: new Set([MOVIE + 500]),
	})
	assert.deepEqual(keys(tiny), keys(titles(501, 4)).reverse())
	assert.deepEqual(
		pickGenreRow({
			page: MOVIE + 1,
			preferred: [],
			fallback: [],
			exclude: new Set(),
		}),
		[],
	)
})

test("the row is the first titles of a longer ranking that the later exclusion leaves", () => {
	const preferred = titles(100, 30)
	const fallback = titles(500, 30)
	const page = MOVIE + 3
	const early = rankGenreRow({
		page,
		preferred,
		fallback,
		exclude: new Set(),
		size: 24,
	})
	// The related map, known later, holds five of the early ranking and a title outside it.
	const related = new Set([
		...keys(early.slice(0, 10)).filter((_, at) => at % 2 === 0),
		MOVIE + 129,
	])
	const row = keys(
		pickGenreRow({ page, preferred, fallback, exclude: related }),
	)
	const fromEarly = keys(early)
		.filter((key) => !related.has(key))
		.slice(0, GENRE_ROW_SIZE)
	assert.deepEqual(new Set(row), new Set(fromEarly))
})

test("across pages, the sitemap titles get about the same number of links", () => {
	const preferred = titles(100, 200)
	const counts = new Map<number, number>(
		preferred.map((title) => [title.key, 0]),
	)
	const pages = 2000
	for (let page = 0; page < pages; page++)
		for (const title of pickGenreRow({
			page: MOVIE + 10_000 + page * 37,
			preferred,
			fallback: [],
			exclude: new Set(),
		}))
			counts.set(title.key, (counts.get(title.key) ?? 0) + 1)
	// 2,000 rows of 8 over 200 titles: 80 links each on average.
	const values = [...counts.values()]
	assert.ok(Math.min(...values) >= 50, `fewest ${Math.min(...values)}`)
	assert.ok(Math.max(...values) <= 115, `most ${Math.max(...values)}`)
})

test("the sitemap files name their 700 movies and 300 shows in the selection comment", () => {
	for (const [kind, count] of [
		["movie", 700],
		["show", 300],
	] as const) {
		const xml = readFileSync(
			new URL(
				`../../../public/sitemaps/sitemap_${kind}_detail_0.xml`,
				import.meta.url,
			),
			"utf8",
		)
		const ids = sitemapSelection(xml)
		assert.equal(ids.length, count, kind)
		const listed = [...xml.matchAll(new RegExp(`/${kind}/(\\d+)`, "g"))].map(
			(m) => Number(m[1]),
		)
		assert.deepEqual(
			new Set(ids),
			new Set(listed),
			`${kind}: the comment matches the URLs`,
		)
	}
	assert.deepEqual(sitemapSelection("<urlset></urlset>"), [])
})

test("the heading names the breadcrumb's genre and the media type", () => {
	assert.equal(genreRowHeading("Drama", "movie"), "More drama movies")
	assert.equal(
		genreRowHeading("Sci-Fi & Fantasy", "show"),
		"More sci-fi & fantasy shows",
	)
	assert.equal(genreRowHeading("Talk Shows", "show"), "More talk shows")
	assert.equal(genreRowHeading("Animation", "show"), "More animated shows")
	assert.equal(genreRowHeading("TV Movie", "movie"), "More TV movies")
	assert.equal(genreRowHeading("Documentary", "movie"), "More documentaries")
})

test("the row's genre is the breadcrumb's, by its TMDB name", () => {
	assert.deepEqual(titleGenrePage("movie", ["Science Fiction", "Action"]), {
		genre: "Science Fiction",
		label: "Science Fiction",
		path: "/movies/genres/science-fiction",
	})
	// TMDB calls it Talk; its page says Talk Shows.
	assert.equal(titleGenrePage("show", ["Talk"])?.genre, "Talk")
	assert.equal(titleGenrePage("movie", null), null)
})
