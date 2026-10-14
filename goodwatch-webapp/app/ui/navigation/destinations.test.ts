// What a person reads for the home destination: the hub tile and the palette's "Go to ..." row use `label`, the dock
// uses `short`. Both say Home, so the palette's `${label} ${short}` match words find "home" once and never offer a
// second Home row.
import assert from "node:assert/strict"
import { test } from "node:test"
import { getDestinations } from "./destinations.ts"

test("the home destination is called Home on the tile, in the palette and on the dock", () => {
	const { home } = getDestinations()
	assert.equal(home.label, "Home")
	assert.equal(home.short, "Home")
})

test("no two destinations share a label, so the palette never lists one twice", () => {
	const labels = Object.values(getDestinations()).map(
		(destination) => destination.label,
	)
	assert.equal(new Set(labels).size, labels.length)
})
