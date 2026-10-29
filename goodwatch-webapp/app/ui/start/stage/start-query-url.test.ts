// The start page's query in the URL (start-query-url.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { EMPTY_QUERY, reduceQuery } = await import("./start-query.ts")
const { queryFromParams, queryParams } = await import("./start-query-url.ts")
type Action = Parameters<typeof reduceQuery>[1]

const run = (...actions: Action[]) => actions.reduce(reduceQuery, EMPTY_QUERY)

test("the URL holds the searched text in q and the picks in Discover's parameters, keeping the rest", () => {
	const query = run(
		{ type: "search", text: "rainy day whodunit" },
		{ type: "picks", picks: ["t:crime", "m:funny"] },
	)
	const params = queryParams(query, new URLSearchParams("member=1&q=old"))
	assert.equal(
		params.toString(),
		"member=1&q=rainy+day+whodunit&moods=funny&themes=crime",
	)
	assert.deepEqual(queryFromParams(params), {
		draft: "rainy day whodunit",
		text: "rainy day whodunit",
		picks: ["m:funny", "t:crime"],
	})
	assert.equal(queryParams(EMPTY_QUERY, params).toString(), "member=1")
})

test("a URL's unknown words and picks past the third are left out, and its text is trimmed", () => {
	const query = queryFromParams(
		new URLSearchParams(
			"q=%20heist%20&moods=funny,nope,scary&styles=slow,talky",
		),
	)
	assert.equal(query.text, "heist")
	assert.deepEqual(query.picks, ["m:funny", "m:scary", "s:slow"])
	assert.deepEqual(queryFromParams(new URLSearchParams("")), EMPTY_QUERY)
})
