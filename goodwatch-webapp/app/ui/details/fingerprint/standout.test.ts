// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { standoutReadings } = await import("./standout.ts")
const { SCALE_GROUPS, readScale } = await import("./scales.ts")
const { matrix, toyStory } = await import("./titles.test-support.ts")

const strength = (t: typeof matrix, name: string) => {
	const scale = SCALE_GROUPS.flatMap((g) => g.scales).find((sc) => sc.name === name)!
	const { position } = readScale(scale, t)
	return scale.fromMiddle ? Math.abs(position - 0.5) * 2 : position
}

test("two readings, from two areas, in Feel, Story, Look order", () => {
	for (const t of [matrix, toyStory]) {
		const two = standoutReadings(t)
		assert.equal(two.length, 2)
		assert.notEqual(two[0].scale.area, two[1].scale.area)
		assert.ok(two[0].order < two[1].order)
	}
})

test("no reading of another area reads stronger than the weaker of the two", () => {
	for (const t of [matrix, toyStory]) {
		const two = standoutReadings(t)
		const weaker = Math.min(...two.map((r) => r.strength))
		const taken = new Set(two.map((r) => r.scale.area))
		for (const scale of SCALE_GROUPS.flatMap((g) => g.scales))
			if (!taken.has(scale.area))
				assert.ok(strength(t, scale.name) <= weaker + 1e-9, `${t.title}: ${scale.name}`)
	}
})

test("each reading keeps the full readings' own word and position", () => {
	for (const r of standoutReadings(matrix)) {
		const { position, word } = readScale(r.scale, matrix)
		assert.equal(r.word, word)
		assert.equal(r.position, position)
	}
})
