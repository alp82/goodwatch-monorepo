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
