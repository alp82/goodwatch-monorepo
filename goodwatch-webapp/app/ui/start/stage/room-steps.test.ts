// How the start page's room is lit (room-steps.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { DIM_NIGHT, guestNight, memberNight } from "./room-steps.ts"

const guest = {
	lamp: true,
	open: false,
	picksShown: false,
	loved: 0,
	moods: false,
}

test("the room loads dim until its lamp comes on, for guests and members", () => {
	assert.equal(guestNight({ ...guest, lamp: false }), DIM_NIGHT)
	assert.equal(guestNight({ ...guest, lamp: false, open: true }), DIM_NIGHT)
	assert.equal(memberNight({ lamp: false, open: true }), DIM_NIGHT)
})

test("a guest's room rests a little dimmed, lights up with each loved title, and is lit for the picks", () => {
	assert.equal(guestNight(guest), 0.32)
	const open = { ...guest, open: true }
	assert.equal(guestNight(open), 0.22)
	assert.equal(guestNight({ ...open, loved: 1 }), 0.16)
	assert.equal(guestNight({ ...open, loved: 2 }), 0.1)
	// Never quite lit before the picks show, and never past three.
	assert.equal(guestNight({ ...open, loved: 3 }), 0.04)
	assert.equal(guestNight({ ...open, loved: 5 }), 0.04)
	assert.equal(guestNight({ ...open, picksShown: true, loved: 3 }), 0)
})

test("mood picks start a guest's open room lighter, so their color grade shows", () => {
	const open = { ...guest, open: true, moods: true }
	assert.equal(guestNight(open), 0.16)
	assert.equal(guestNight({ ...open, loved: 2 }), 0.04)
	assert.ok(guestNight(open) < guestNight({ ...open, moods: false }))
})

test("a member's room rests lighter than a guest's and is lit once the card is open", () => {
	assert.equal(memberNight({ lamp: true, open: false }), 0.28)
	assert.ok(memberNight({ lamp: true, open: false }) < guestNight(guest))
	assert.equal(memberNight({ lamp: true, open: true }), 0)
})
