import assert from "node:assert/strict"
import { test } from "node:test"
import { withPageLink } from "./links.ts"

const origin = "https://goodwatch.app"
test("page links use existing website filters and encode search text", () => {
	const data = { items: [] }
	for (const [filter, path] of [
		["want_to_see", "/my-library"],
		["seen", "/my-library?status=seen"],
		["watching", "/my-library?status=watching"],
		["on_hold", "/my-library?status=on_hold"],
		["dropped", "/my-library?status=dropped"],
		["unrated", "/my-library?status=unrated"],
		["not_interested", "/settings/hidden"],
	])
		assert.equal(
			withPageLink(origin, "get_library", { filter }, data).page_url,
			origin + path,
		)
	for (const filter of ["rated", "all"])
		assert.ok(withPageLink(origin, "get_library", { filter }, data).page_note)
	const query = "Arrival & aliens / 日本"
	const link = withPageLink(origin, "search_titles", { query }, data)
	assert.equal(new URL(String(link.page_url)).pathname, "/discover")
	assert.equal(new URL(String(link.page_url)).searchParams.get("q"), query)
	assert.equal(
		withPageLink(origin, "search_titles", {}, data).page_url,
		`${origin}/discover?services=all&unseen=0&foryou=1`,
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
		`${origin}/my-library?status=seen&sort=score`,
	)
	assert.equal(
		withPageLink(
			origin,
			"get_library",
			{ filter: "want_to_see", sort: "title" },
			{},
		).page_url,
		`${origin}/my-library?sort=title`,
	)
})
