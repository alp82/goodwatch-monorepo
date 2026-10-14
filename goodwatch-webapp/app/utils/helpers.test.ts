import assert from "node:assert/strict"
import { test } from "node:test"

const { titlePath, titleRedirectPath, titleToDashed } = await import(
	"./helpers.ts"
)

const matrix = { mediaType: "movie", tmdbId: 603, title: "The Matrix" } as const
const at = (
	pathname: string,
	search = "",
	title: {
		mediaType: "movie" | "show"
		tmdbId: number
		title: string
	} = matrix,
) => titleRedirectPath({ pathname, search, ...title })

test("the canonical path stays where it is", () => {
	assert.equal(at("/movie/603-the-matrix"), null)
	assert.equal(at("/movie/603-the-matrix", "?country=DE"), null)
})

test("a link from the old search journey moves to the title page with its own parameters only", () => {
	assert.equal(
		at(
			"/movie/603-the-matrix",
			"?searchJourney=1&q=matrix&type=movie&minYear=1990&country=US&language=de",
		),
		"/movie/603-the-matrix?country=US&language=de",
	)
	assert.equal(
		at("/movie/603-the-matrix", "?q=heist&searchJourney=1"),
		"/movie/603-the-matrix",
	)
	assert.equal(
		at("/movie/603", "?searchJourney=1&country=DE"),
		"/movie/603-the-matrix?country=DE",
	)
	// Without the journey's mark, any other parameter stays as it is.
	assert.equal(at("/movie/603-the-matrix", "?q=matrix"), null)
})

test("a wrong slug moves to the canonical path", () => {
	assert.equal(at("/movie/603-the-matrices"), "/movie/603-the-matrix")
	assert.equal(at("/movie/603-mad-max"), "/movie/603-the-matrix")
})

test("junk after the slug moves to the canonical path", () => {
	// Three private use characters, as a crawler sends them.
	assert.equal(
		at("/movie/603-the-matrix%EE%85%8D%EE%A2%9E%EE%A2%B6"),
		"/movie/603-the-matrix",
	)
	assert.equal(at("/movie/603-the-matrix-"), "/movie/603-the-matrix")
	assert.equal(at("/movie/603-the-matrix/"), "/movie/603-the-matrix")
})

test("a missing slug moves to the canonical path", () => {
	assert.equal(at("/movie/603"), "/movie/603-the-matrix")
	assert.equal(at("/movie/603-"), "/movie/603-the-matrix")
	assert.equal(at("/movie/0603-the-matrix"), "/movie/603-the-matrix")
})

test("another case or an encoded spelling moves to the canonical path", () => {
	assert.equal(at("/movie/603-The-Matrix"), "/movie/603-the-matrix")
	assert.equal(at("/movie/603-the-matri%78"), "/movie/603-the-matrix")
	assert.equal(at("/movie/603%2Dthe-matrix"), "/movie/603-the-matrix")
})

test("the query string is kept", () => {
	assert.equal(
		at("/movie/603", "?country=DE&tab=streaming"),
		"/movie/603-the-matrix?country=DE&tab=streaming",
	)
})

test("a show moves under /show", () => {
	const show = {
		mediaType: "show",
		tmdbId: 1396,
		title: "Breaking Bad",
	} as const
	assert.equal(at("/show/1396-breaking-bad", "", show), null)
	assert.equal(at("/show/1396-x", "?a=1", show), "/show/1396-breaking-bad?a=1")
})

// Every title's canonical path must be a fixed point: asked for as written, it gets no redirect.
const oddTitles = [
	"WALL·E",
	"Amélie",
	"千と千尋の神隠し",
	"",
	"   ",
	" Leading and trailing ",
	"8½",
	"Se7en",
	"What If...?",
	"50% Off / 100% Fun",
	"Tom & Jerry: The Movie",
	"#Alive",
	"Spider-Man: Across the Spider-Verse",
	"__init__",
	"İstanbul",
	"A\tB\nC",
	"..",
	"a?b#c",
	"100 % Wolf",
	"-",
]

test("a title with odd characters has a canonical path that never moves again", () => {
	for (const title of oddTitles) {
		const odd = { mediaType: "movie", tmdbId: 7, title } as const
		const canonical = titlePath("movie", 7, title)
		assert.match(canonical, /^\/movie\/7-[a-z0-9_-]*$/, title)
		// A request for it reaches the loader with the same path, and stays.
		assert.equal(
			new URL(canonical, "https://goodwatch.app").pathname,
			canonical,
			title,
		)
		assert.equal(at(canonical, "", odd), null, title)
		assert.equal(at(canonical, "?x=1", odd), null, title)
		assert.equal(at("/movie/7-wrong", "?x=1", odd), `${canonical}?x=1`, title)
	}
})

test("a title without Latin letters keeps the path its canonical tag names", () => {
	const spirited = {
		mediaType: "movie",
		tmdbId: 129,
		title: "千と千尋の神隠し",
	} as const
	assert.equal(titleToDashed(spirited.title), "")
	assert.equal(at("/movie/129-", "", spirited), null)
	assert.equal(at("/movie/129", "", spirited), "/movie/129-")
})

test("no redirect without a usable id or title", () => {
	assert.equal(at("/movie/x", "", { ...matrix, tmdbId: Number.NaN }), null)
	assert.equal(at("/movie/0", "", { ...matrix, tmdbId: 0 }), null)
	assert.equal(
		at("/movie/603", "", { ...matrix, title: null as unknown as string }),
		null,
	)
})
