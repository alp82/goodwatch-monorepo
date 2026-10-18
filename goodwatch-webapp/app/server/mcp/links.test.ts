import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
const { withPageLink } = await import("./links.ts")

const origin = "https://goodwatch.app"
test("page links use existing website filters and encode search text", () => {
	const data = { items: [] }
	for (const [filter, path] of [
		["want_to_see", "/my-library/want"],
		["seen", "/my-library/seen"],
		["watching", "/my-library/watching"],
		["on_hold", "/my-library/on-hold"],
		["dropped", "/my-library/dropped"],
		["unrated", "/my-library/not-rated"],
		["rated", "/my-library/scores"],
		["not_interested", "/settings/hidden"],
	])
		assert.equal(
			withPageLink(origin, "get_library", { filter }, data).page_url,
			origin + path,
		)
	for (const filter of ["all"])
		assert.ok(withPageLink(origin, "get_library", { filter }, data).page_note)
	const query = "Arrival & aliens / 日本"
	const link = withPageLink(origin, "search_titles", { query }, data)
	assert.equal(new URL(String(link.page_url)).pathname, "/discover")
	assert.equal(new URL(String(link.page_url)).searchParams.get("q"), query)
	assert.equal(
		withPageLink(origin, "search_titles", {}, data).page_url,
		`${origin}/discover?services=all&unseen=0&sort=popular&foryou=1&layout=grid`,
	)
	assert.deepEqual(withPageLink(origin, "get_title", {}, data), data)
})

test("title links include a year and escape Markdown label punctuation", async () => {
	const { titleLink } = await import("./links.ts")
	assert.equal(
		titleLink("The Matrix", 1999, "https://goodwatch.app/movie/603-the-matrix"),
		"[The Matrix (1999)](https://goodwatch.app/movie/603-the-matrix)",
	)
	assert.equal(
		titleLink("A [title]", null, "https://goodwatch.app/movie/1-a-title"),
		"[A \\[title\\] (Year unknown)](https://goodwatch.app/movie/1-a-title)",
	)
})

test("Watch next links to the matching movies/shows list", () => {
	for (const kind of ["movie", "show"]) {
		const result = withPageLink(
			origin,
			"get_tonight",
			{},
			{ pick: { title: { id: `${kind}:1` } } },
		)
		assert.equal(
			result.page_url,
			origin + (kind === "movie" ? "/my-movies" : "/my-shows"),
		)
	}
})

test("Search links override saved availability and seen filters", () => {
	const result = withPageLink(
		origin,
		"search_titles",
		{ query: "aliens", ranked: true },
		{},
	)
	const url = new URL(String(result.page_url))
	assert.equal(url.searchParams.get("services"), "all")
	assert.equal(url.searchParams.get("unseen"), "0")
	assert.equal(url.searchParams.get("foryou"), "1")
	const unseen = withPageLink(
		origin,
		"search_titles",
		{ query: "aliens", exclude_seen: true },
		{},
	)
	assert.equal(new URL(String(unseen.page_url)).searchParams.get("unseen"), "1")
})

test("Library links preserve supported UI sorts", () => {
	assert.equal(
		withPageLink(origin, "get_library", { filter: "seen", sort: "score" }, {})
			.page_url,
		`${origin}/my-library/seen?sort=score`,
	)
	assert.equal(
		withPageLink(
			origin,
			"get_library",
			{ filter: "want_to_see", sort: "title" },
			{},
		).page_url,
		`${origin}/my-library/want?sort=title`,
	)
})

test("Richer title and More like this lists link to the real title page and related section", () => {
	const source = { url: "https://goodwatch.app/movie/603-the-matrix" }
	const detail = withPageLink(
		"https://goodwatch.app",
		"get_title",
		{ include: ["episodes"] },
		{ title: source },
	)
	assert.equal(detail.page_url, source.url)
	const related = withPageLink(
		"https://goodwatch.app",
		"get_similar_titles",
		{ exclude_seen: true },
		{ source, items: [] },
	)
	assert.equal(related.page_url, `${source.url}#related`)
	assert.match(String(related.page_note), /broader/)
})

test("Discover options link to the real filter view", () => {
	const result = withPageLink(
		origin,
		"get_discover_filters",
		{},
		{ genres: ["Drama"], providers: [{ id: 8, name: "Netflix" }] },
	)
	const url = new URL(String(result.page_url))
	assert.equal(url.pathname, "/discover")
	assert.equal(url.searchParams.get("services"), "all")
	assert.equal(url.searchParams.get("unseen"), "0")
	assert.equal(url.searchParams.get("layout"), "grid")
	assert.equal(result.page_note, undefined)
})

test("blank searches link the identical discovery view without a name-lookup note", () => {
	for (const args of [
		{},
		{ query: "  ", order: "newest" as const },
		{ genres: ["Comedy"], exclude_seen: true },
	]) {
		assert.deepEqual(
			withPageLink(origin, "search_titles", args, {}),
			withPageLink(origin, "discover_titles", args, {}),
		)
	}
})
