import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
const { filterChangeState, navigationSearchOrigin, searchNavigationState } = await import(
	"./search-attribution.ts"
)

test("navigation carries the source without adding it to the URL and survives repeated renders", () => {
	for (const surface of [
		"header",
		"title_tag",
		"title_trope",
		"discover",
	] as const) {
		const state = searchNavigationState(" quiet movies ", surface, "enter")
		for (let render = 0; render < 3; render++)
			assert.deepEqual(navigationSearchOrigin("quiet movies", state, "PUSH"), {
				surface,
				trigger: "enter",
			})
	}
})

test("reload, back/forward, new tabs and a different query never reuse an old click label", () => {
	const state = searchNavigationState("quiet movies", "header", "enter")
	const navigation = { surface: "discover", trigger: "navigation" }
	assert.deepEqual(
		navigationSearchOrigin("quiet movies", state, "POP"),
		navigation,
	)
	assert.deepEqual(
		navigationSearchOrigin("quiet movies", undefined, "PUSH"),
		navigation,
	)
	assert.deepEqual(
		navigationSearchOrigin("different", state, "REPLACE"),
		navigation,
	)
	assert.deepEqual(
		navigationSearchOrigin(
			"quiet movies",
			{ searchInvocation: { ...state.searchInvocation, page: -1 } },
			"PUSH",
		),
		navigation,
	)
})

test("a filter the person changes labels the search filter_change; back/forward to that entry is navigation", () => {
	const params = new URLSearchParams({ q: " quiet movies ", type: "movie" })
	const state = filterChangeState(params)
	const filterChange = { surface: "discover", trigger: "filter_change" }
	for (const type of ["REPLACE", "PUSH"])
		assert.deepEqual(navigationSearchOrigin("quiet movies", state, type), filterChange)
	assert.deepEqual(navigationSearchOrigin("quiet movies", state, "POP"), { surface: "discover", trigger: "navigation" })
	// An older link's words in `asked` are the query the page compares.
	assert.deepEqual(navigationSearchOrigin("dark heist", filterChangeState(new URLSearchParams({ asked: "dark heist", q: "heist" })), "REPLACE"), filterChange)
	// Browsing without a search carries no label.
	assert.equal(filterChangeState(new URLSearchParams({ type: "movie" })), undefined)
})
