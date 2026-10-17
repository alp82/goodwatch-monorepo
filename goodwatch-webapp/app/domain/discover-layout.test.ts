import assert from "node:assert/strict"
import { test } from "node:test"
import { withSides } from "./discover-layout.ts"

test("Discover defaults to side rows; linked grids keep the same API query on the server and browser", () => {
	assert.equal(
		withSides("services=all&unseen=0", null),
		"services=all&unseen=0&sides=rows",
	)
	assert.equal(withSides("", null, false), "sides=grid")
	assert.equal(
		withSides("genres=Drama", null, false),
		"genres=Drama&sides=grid",
	)
	assert.equal(withSides("", "a&b", false), "sides=grid&side=a%26b")
})
