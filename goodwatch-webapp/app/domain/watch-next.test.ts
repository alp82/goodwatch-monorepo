import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { WATCH_NEXT_SORTS, watchNextChoiceOf, watchNextSortOf } = await import(
	"./watch-next.ts"
)

const choice = (query: string) => watchNextChoiceOf(new URLSearchParams(query))

test("a sort key in the URL is the sort; none or an unknown one is the viewer's default", () => {
	for (const sort of WATCH_NEXT_SORTS) assert.equal(watchNextSortOf(sort), sort)
	assert.equal(watchNextSortOf(null), null)
	assert.equal(watchNextSortOf(undefined), null)
	assert.equal(watchNextSortOf(""), null)
	assert.equal(watchNextSortOf("relevance"), null)
	assert.equal(watchNextSortOf("Match"), null)
})

test("Top rated keeps working under its earlier key", () => {
	assert.equal(watchNextSortOf("score"), "top")
})

test("the choice without parameters: the default sort, no moods, On my services", () => {
	assert.deepEqual(choice(""), { sort: null, moods: [], onMyServices: true })
})

test("the choice reads sort, moods, and services as the filter bar writes them", () => {
	assert.deepEqual(choice("sort=waiting&moods=funny,scary&services=all"), {
		sort: "waiting",
		moods: ["funny", "scary"],
		onMyServices: false,
	})
	assert.equal(choice("services=mine").onMyServices, true)
	assert.equal(choice("sort=match").sort, "match")
	assert.equal(choice("sort=score").sort, "top")
})

test("unknown and repeated moods are dropped, and at most three stay", () => {
	assert.deepEqual(choice("moods=funny,nope,funny").moods, ["funny"])
	assert.ok(choice("moods=funny,scary,heavy,cozy,tense").moods.length <= 3)
})

test("other filter bar parameters don't touch the choice", () => {
	assert.deepEqual(choice("genres=Drama&score=80&match=90&unseen=1"), {
		sort: null,
		moods: [],
		onMyServices: true,
	})
})
