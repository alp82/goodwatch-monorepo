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
		origin + "/discover",
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
