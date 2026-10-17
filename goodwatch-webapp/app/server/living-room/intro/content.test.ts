// The intro's snapshot (content.json): what every scene relies on is there.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const content = JSON.parse(
	readFileSync(new URL("./content.json", import.meta.url), "utf8"),
)

test("the titles start with Interstellar, each once, each with feeling words", () => {
	const keys = content.pool.map((t: { key: number }) => t.key)
	assert.equal(keys[0], 1_000_000_157_336)
	assert.equal(new Set(keys).size, keys.length)
	assert.ok(keys.length >= 24 && keys.length <= 60)
	for (const t of content.pool) assert.ok(Array.isArray(t.feels))
})

test("every scene's content is there", () => {
	for (const name of [
		"score",
		"feel",
		"atlas",
		"islands",
		"filters",
		"catalog",
		"pick",
		"pickFeel",
		"franchise",
	])
		assert.ok(content[name], name)
	assert.ok(content.feel.searches.space.reading.length > 0)
	assert.ok(content.atlas.wall.length >= 128)
	assert.ok(content.filters.steps.length >= 5)
	assert.ok(content.catalog.movies + content.catalog.shows > 1_000_000)
})

test("the pick is an intro title", () => {
	assert.ok(
		content.pool.some((t: { key: number }) => t.key === content.pick.pick),
	)
})
