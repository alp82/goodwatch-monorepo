// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { readTitle, AXES } = await import("./reading.ts")
const { nextSelection, startSelection, lightOf, dialLight, MAX_SELECTED } =
	await import("./selection.ts")
const { matrix, grandBudapest } = await import(
	"../fingerprint/titles.test-support.ts"
)

const reading = readTitle(matrix)
const rows = reading.rows.map((p) => p.r.effect.id)
const outside = reading.all.find((r) => !rows.includes(r.effect.id))?.effect
	.id as string

test("reads twelve dials, Originality last", () => {
	assert.equal(reading.scales.length, 12)
	assert.equal(reading.scales[11].sc.name, "Originality")
	assert.ok(reading.rows.length > 0 && reading.rows.length <= 5)
	assert.equal(reading.axes.length, AXES.length)
})

test("a row toggles its effect, and a fourth pushes the oldest out", () => {
	const [a, b, c] = rows
	assert.deepEqual(nextSelection([], { kind: "effect", id: a }, reading), [a])
	assert.deepEqual(nextSelection([a, b], { kind: "effect", id: a }, reading), [
		b,
	])
	const full = [a, b, c]
	const next = nextSelection(full, { kind: "effect", id: outside }, reading)
	assert.equal(next.length, MAX_SELECTED)
	assert.deepEqual(next, [b, c, outside])
})

test("an area adds its leading effect, or takes out what's selected on it", () => {
	const axis = reading.axes[0]
	const lead = axis.lead.effect.id
	const added = nextSelection([], { kind: "axis", id: axis.axis.id }, reading)
	assert.deepEqual(added, [lead])
	const other = axis.axis.members.find((m) => m !== lead) as string
	assert.deepEqual(
		nextSelection([other], { kind: "axis", id: axis.axis.id }, reading),
		[],
	)
})

test("starts on the rarest pair with at most one end outside the rows", () => {
	const pairs = [
		{ a: outside, b: "nope", both: 1 },
		{ a: outside, b: outside, both: 2 },
		{ a: rows[1], b: outside, both: 3 },
		{ a: rows[0], b: rows[1], both: 4 },
	]
	// The unknown effect is skipped; the second pair has no row; the third does.
	assert.deepEqual(startSelection(pairs, reading), [rows[1], outside])
	// Without a pair that touches the rows, the rarest known pair.
	assert.deepEqual(startSelection(pairs.slice(0, 2), reading), [
		outside,
		outside,
	])
	assert.deepEqual(startSelection([], reading), [rows[0]])
	assert.deepEqual(startSelection(null, reading), [rows[0]])
})

test("a selection of three names at most nine ingredients, needs first", () => {
	const light = lightOf(rows.slice(0, 3), reading)
	assert.ok(light)
	assert.ok(light.keys.filter((k) => k.named).length <= 9)
	assert.equal(light.id, rows.slice(0, 3).join("+"))
	assert.equal(lightOf([], reading), null)
})

test("a two-ended dial lights both ends, the low one as a brake", () => {
	const r = readTitle(grandBudapest)
	const tone = r.scales.find((s) => s.sc.name === "Tone")
	assert.ok(tone)
	const light = dialLight(tone, grandBudapest.fingerprint.scores)
	assert.deepEqual(
		light.keys.map((k) => [k.key, k.role]),
		[
			["hopefulness", "need"],
			["bleakness", "brake"],
		],
	)
	assert.equal(light.axes.size, 0)
})
