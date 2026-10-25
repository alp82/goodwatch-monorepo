import assert from "node:assert/strict"
import { test } from "node:test"
import { pillMark } from "./pill-mark.ts"

test("a show status other than Seen comes first", () => {
	assert.equal(
		pillMark({ score: 8, want: true, status: "watching" }),
		"watching",
	)
	assert.equal(
		pillMark({ score: null, want: false, status: "on_hold" }),
		"on_hold",
	)
})

test("the Wishlist bookmark shows unless the list is the Wishlist", () => {
	assert.equal(pillMark({ score: null, want: true, status: null }), "want")
	assert.equal(pillMark({ score: null, want: true, status: null }, true), null)
})

test("Seen shows only without a score", () => {
	assert.equal(pillMark({ score: null, want: false, status: "seen" }), "seen")
	assert.equal(pillMark({ score: 7, want: false, status: "seen" }), null)
	assert.equal(pillMark({ score: null, want: false, status: null }), null)
})
