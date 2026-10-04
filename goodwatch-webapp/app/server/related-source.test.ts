import assert from "node:assert/strict"
import { test } from "node:test"
import { relatedSourceFromSnapshot } from "./related-source.ts"

const keys = ["adrenaline", "tension", "wonder"] as const
const missing = 255
const fingerprint = new Uint8Array([7, missing, 0])

test("a source without a fingerprint is unknown", () => {
	assert.deepEqual(
		relatedSourceFromSnapshot(null, "adrenaline", keys, missing),
		{
			known: false,
		},
	)
})

test("a known source supplies the score in snapshot key order, including zero", () => {
	for (const [key, score] of [
		["adrenaline", 7],
		["wonder", 0],
	] as const) {
		assert.deepEqual(
			relatedSourceFromSnapshot(fingerprint, key, keys, missing),
			{
				known: true,
				score,
			},
		)
	}
})

test("a missing score leaves the source known without a score filter", () => {
	assert.deepEqual(
		relatedSourceFromSnapshot(fingerprint, "tension", keys, missing),
		{
			known: true,
			score: null,
		},
	)
})

test("an unknown key leaves the source known without a score filter", () => {
	assert.deepEqual(
		relatedSourceFromSnapshot(fingerprint, "unknown", keys, missing),
		{
			known: true,
			score: null,
		},
	)
})

test("the overall panel needs a known source but no attribute score", () => {
	assert.deepEqual(
		relatedSourceFromSnapshot(fingerprint, undefined, keys, missing),
		{
			known: true,
			score: null,
		},
	)
})
