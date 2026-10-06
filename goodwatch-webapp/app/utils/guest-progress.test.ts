// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { readGuestInteractions } = await import("./guest-progress.ts")

const globals = globalThis as { window?: unknown; localStorage?: unknown }

// What the server's HTML is rendered with: no window, so no stored marks.
const onServer = readGuestInteractions()

const inBrowserWith = (stored: string | null) => {
	globals.window = globalThis
	globals.localStorage = { getItem: () => stored }
}

afterEach(() => {
	globals.window = undefined
	globals.localStorage = undefined
})

test("a visitor without stored marks reads the very list the server rendered with", () => {
	// The same list means that the browser's first read changes nothing, and no component renders again for it.
	for (const stored of [null, "[]", "not json", '[{"tmdb_id":0}]']) {
		inBrowserWith(stored)
		assert.equal(readGuestInteractions(), onServer, `stored: ${stored}`)
	}
})

test("a visitor with stored marks reads them, and the same list again while nothing changed", () => {
	inBrowserWith(
		JSON.stringify([
			{ tmdb_id: 603, media_type: "movie", type: "score", score: 9, timestamp: 5 },
		]),
	)
	const marks = readGuestInteractions()
	assert.equal(marks.length, 1)
	assert.equal(marks[0].tmdb_id, 603)
	assert.equal(readGuestInteractions(), marks)
})
