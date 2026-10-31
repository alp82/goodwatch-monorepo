import assert from "node:assert/strict"
import { test } from "node:test"
import { ambientFor } from "./ambient.ts"
import { EFFECTS } from "./pixelfx/registry.js"

const island = (
	group: string | undefined,
	name: string,
	color = "#3366cc",
) => ({
	group,
	name,
	color,
})

test("an island's ambient follows its grouping and name", () => {
	assert.equal(ambientFor(island("mood", "Scary")).id, "cinema/amb-bats")
	assert.equal(ambientFor(island("mood", "Cozy")).id, "cinema/amb-fireflies")
	assert.equal(ambientFor(island("theme", "Crime")).id, "cinema/amb-policewash")
	assert.equal(ambientFor(island("theme", "Money")).id, "cinema/amb-coins")
	assert.equal(ambientFor(island("decade", "1980s")).id, "cinema/amb-disco")
})

test("the same name in another grouping can play another ambient", () => {
	assert.equal(ambientFor(island("theme", "Family")).id, "cinema/amb-fireflies")
	assert.equal(ambientFor(island("occasion", "Kids")).id, "cinema/amb-bubbles")
})

test("without its grouping, an island's name still finds its ambient", () => {
	assert.equal(ambientFor(island(undefined, "  Scary ")).id, "cinema/amb-bats")
})

test("an island nothing fits twinkles in its own color", () => {
	const a = ambientFor(island("mood", "Unheard of", "#ff0000"))
	assert.equal(a.id, "cinema/amb-twinkle")
	const palette = a.opts?.palette as string[]
	assert.equal(palette.length, 5)
	// Dark to bright around red.
	assert.match(palette[0], /^#[0-9a-f]{2}0000$/)
	assert.equal(palette[2], "#ff1a1a")
})

test("every ambient the table names ships with the map", () => {
	for (const group of [
		"mood",
		"theme",
		"style",
		"occasion",
		"decade",
		"country",
	])
		for (const name of [
			"Funny",
			"Dark",
			"Crime",
			"Showbiz",
			"Talky",
			"Binge",
			"2020s",
			"Germany",
			"Rest of world",
		]) {
			const a = ambientFor(island(group, name))
			assert.ok(EFFECTS[a.id], `${group}:${name} -> ${a.id}`)
		}
})
