import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { FingerprintView, SidesView } from "../taste-portrait/view.ts"
const { tasteFromPortrait } = await import("./taste.server.ts")

test("compact taste retains only carriers rated at least eight as loved", () => {
	const fingerprint = {
		status: "ready",
		subject: { kind: "member" },
		attributes: [
			{
				key: "tension",
				label: "Tension",
				family: "feel",
				edge: 1,
				tier: 2,
				carriers: [1e12 + 1, 1e12 + 2, 2e12 + 3],
			},
		],
		titles: {
			[1e12 + 1]: { title: "Eight", mine: 8, year: 2000, poster: "/eight" },
			[1e12 + 2]: { title: "Seven", mine: 7, year: 2000, poster: null },
			[2e12 + 3]: { title: "Unrated", mine: null, year: null, poster: null },
			[1e12 + 4]: {
				title: "Not a carrier",
				mine: 10,
				year: 2000,
				poster: null,
			},
		},
	} as unknown as FingerprintView
	const sides = {
		status: "ready",
		sides: [
			{
				id: "side-0",
				name: "Tense stories",
				attributes: [{ key: "tension" }],
				count: 3,
			},
		],
	} as SidesView
	const taste = tasteFromPortrait(fingerprint, sides)
	assert.deepEqual(taste?.loved, {
		"movie-1": { title: "Eight", year: 2000, poster: "/eight", score: 8 },
	})
	assert.deepEqual(taste?.attributes[0].carriers, [
		"movie-1",
		"movie-2",
		"show-3",
	])
	assert.deepEqual(taste?.groups, [
		{ id: "side-0", name: "Tense stories", keys: ["tension"], count: 3 },
	])
	fingerprint.status = "empty"
	assert.equal(tasteFromPortrait(fingerprint, sides), null)
	fingerprint.status = "ready"
	sides.status = "unavailable"
	assert.equal(tasteFromPortrait(fingerprint, sides), null)
})
