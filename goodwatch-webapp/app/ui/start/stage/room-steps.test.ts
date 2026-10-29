// How a guest's room lights up step by step (room-steps.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { DARK_ROOM, LIT_ROOM, roomLight, roomStep } from "./room-steps.ts"

test("the steps: ask, pick, For you", () => {
	assert.equal(roomStep({ asked: false, picksShown: false }), 0)
	assert.equal(roomStep({ asked: true, picksShown: false }), 1)
	assert.equal(roomStep({ asked: true, picksShown: true }), 2)
	// The picks only show after the guest asked; they win either way.
	assert.equal(roomStep({ asked: false, picksShown: true }), 2)
})

test("step 0 is dark and close, step 2 lit at its normal framing", () => {
	assert.deepEqual(roomLight(0, { loved: 2, moods: true }), {
		night: 0.9,
		camera: 1.12,
	})
	assert.deepEqual(roomLight(0, { loved: 0, moods: false }), DARK_ROOM)
	assert.deepEqual(roomLight(2, { loved: 3, moods: false }), LIT_ROOM)
	assert.deepEqual(LIT_ROOM, { night: 0, camera: 1 })
})

test("each loved title lights the room and pulls the camera back", () => {
	const search = [0, 1, 2, 3].map((loved) =>
		roomLight(1, { loved, moods: false }),
	)
	assert.deepEqual(
		search.map((l) => l.night),
		[0.55, 0.43, 0.31, 0.19],
	)
	assert.deepEqual(
		search.map((l) => l.camera),
		[1.07, 1.053, 1.036, 1.019],
	)
	// Moods start lighter, and the night never drops under 0.16.
	assert.deepEqual(
		[0, 1, 2, 3].map((loved) => roomLight(1, { loved, moods: true }).night),
		[0.42, 0.3, 0.18, 0.16],
	)
})
