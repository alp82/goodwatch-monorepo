import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
const { navigationSearchOrigin, searchNavigationState } = await import(
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
