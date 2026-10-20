import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
const { inlineTaste } = await import("./inline.server.ts")
const { TASTE_LENGTH } = await import("./formula.server.ts")
const { NO_TASTE } = await import("./taste.server.ts")
const { defaultFilterState } = await import("../../domain/filter-state.ts")
const state = defaultFilterState({ onMyServices: false, notSeenYet: false })
const fingerprint = new Uint8Array(TASTE_LENGTH).fill(0)
fingerprint[0] = 10
const snapshot = {
	version: "inline-test",
	fingerprint: (key: number) => (key === 1 ? fingerprint : null),
	forEach: () => {},
} as unknown as TitleSnapshot

test("one loved title attracts and one disliked title repels without saved taste", () => {
	const loved = inlineTaste(NO_TASTE, { ...state, loved: [1] }, snapshot)
	const disliked = inlineTaste(NO_TASTE, { ...state, disliked: [1] }, snapshot)
	assert.equal(loved?.vector?.[0], 1)
	assert.equal(disliked?.vector?.[0], -1)
	assert.equal(NO_TASTE.vector, null)
})
test("missing fingerprints and cleared preferences preserve the original taste", () => {
	assert.equal(inlineTaste(NO_TASTE, state, snapshot), NO_TASTE)
	assert.equal(
		inlineTaste(NO_TASTE, { ...state, loved: [99] }, snapshot),
		NO_TASTE,
	)
})

test("more disliked titles cannot reverse features shared with loved titles", () => {
	const shared = {
		...snapshot,
		fingerprint: () => fingerprint,
	} as unknown as TitleSnapshot
	const taste = inlineTaste(
		NO_TASTE,
		{
			...state,
			loved: [1, 2, 3, 4, 5, 6],
			disliked: [7, 8, 9, 10, 11, 12, 13],
		},
		shared,
	)
	assert.ok(
		(taste?.vector?.[0] ?? 0) > 0,
		"shared features must stay anchored to loved titles",
	)
})
