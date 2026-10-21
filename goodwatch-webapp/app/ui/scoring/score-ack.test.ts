import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	ACK_MS,
	type AckState,
	IDLE,
	ackLeaving,
	ackScore,
	ackTransition,
	isRepeatPress,
	pressesButtonAgain,
	takesPress,
} from "./score-ack.ts"

const eight = { kind: "score", score: 8 } as const
const press = (key: string, at = 1000, answer: (typeof eight) | { kind: "skip" } = eight) =>
	({ type: "press", key, answer, at }) as const

describe("the answer to How was it?", () => {
	it("lights at once: the chosen score shows while it is saved", () => {
		const saving = ackTransition(IDLE, press("movie-603"))
		assert.equal(saving.phase, "saving")
		assert.equal(ackScore(saving, "movie-603"), 8)
		assert.equal(ackLeaving(saving, "movie-603"), false)
	})

	it("holds until ACK_MS after the press once saved, then ends", () => {
		const saving = ackTransition(IDLE, press("movie-603", 1000))
		const held = ackTransition(saving, { type: "saved", at: 1200 })
		assert.deepEqual(held, { phase: "held", key: "movie-603", answer: eight, until: 1000 + ACK_MS })
		assert.equal(ackLeaving(held, "movie-603"), true)
		assert.equal(ackTransition(held, { type: "done" }), IDLE)
	})

	it("a slow save holds no longer: the next title follows the save", () => {
		const saving = ackTransition(IDLE, press("movie-603", 1000))
		const held = ackTransition(saving, { type: "saved", at: 2500 }) as Extract<AckState, { phase: "held" }>
		assert.equal(held.until, 2500)
	})

	it("ignores every press while an answer is saved or held, so a quick second press never scores the next title", () => {
		const saving = ackTransition(IDLE, press("movie-603", 1000))
		assert.equal(ackTransition(saving, press("movie-603", 1050, { kind: "score", score: 2 } as never)), saving)
		const held = ackTransition(saving, { type: "saved", at: 1100 })
		assert.equal(ackTransition(held, press("show-1396", 1150)), held)
		assert.equal(takesPress(saving), false)
		assert.equal(takesPress(held), false)
	})

	it("a failed save keeps the title, shows no score and takes a new answer", () => {
		const failed = ackTransition(ackTransition(IDLE, press("movie-603")), { type: "failed" })
		assert.equal(failed.phase, "failed")
		assert.equal(ackScore(failed, "movie-603"), null)
		assert.equal(ackLeaving(failed, "movie-603"), false)
		assert.equal(takesPress(failed), true)
		assert.equal(ackTransition(failed, press("movie-603", 3000)).phase, "saving")
		// A failure never moves on.
		assert.equal(ackTransition(failed, { type: "done" }), failed)
	})

	it("Haven't seen it is acknowledged the same way, without a score", () => {
		const saving = ackTransition(IDLE, press("movie-603", 1000, { kind: "skip" }))
		assert.equal(ackScore(saving, "movie-603"), null)
		assert.equal(ackTransition(saving, { type: "saved", at: 1001 }).phase, "held")
	})

	it("leaving cancels: nothing is held, and a late save or hold changes nothing", () => {
		const saving = ackTransition(IDLE, press("movie-603"))
		const gone = ackTransition(saving, { type: "cancel" })
		assert.equal(gone, IDLE)
		assert.equal(ackTransition(gone, { type: "saved", at: 2000 }), IDLE)
		assert.equal(ackTransition(gone, { type: "failed" }), IDLE)
		assert.equal(ackTransition(gone, { type: "done" }), IDLE)
	})

	it("belongs to its title: another title shows nothing of it", () => {
		const saving = ackTransition(IDLE, press("movie-603"))
		assert.equal(ackScore(saving, "show-1396"), null)
		assert.equal(ackLeaving(ackTransition(saving, { type: "saved", at: 1 }), "show-1396"), false)
	})
})

describe("a held key", () => {
	it("is a repeat, never a new press", () => {
		assert.equal(isRepeatPress({ repeat: true }), true)
		assert.equal(isRepeatPress({ repeat: false }), false)
	})

	it("doesn't press a focused button again with Enter or Space", () => {
		const button = { tagName: "BUTTON" }
		assert.equal(pressesButtonAgain({ key: "Enter", repeat: true }, button), true)
		assert.equal(pressesButtonAgain({ key: " ", repeat: true }, button), true)
		assert.equal(pressesButtonAgain({ key: "Enter", repeat: true }, { tagName: "a" }), true)
		// The first press goes through: the person pressed it.
		assert.equal(pressesButtonAgain({ key: "Enter", repeat: false }, button), false)
	})

	it("still types in a text field and leaves other keys alone", () => {
		assert.equal(pressesButtonAgain({ key: " ", repeat: true }, { tagName: "INPUT" }), false)
		assert.equal(pressesButtonAgain({ key: "Enter", repeat: true }, { tagName: "TEXTAREA" }), false)
		assert.equal(
			pressesButtonAgain({ key: "Enter", repeat: true }, { tagName: "DIV", isContentEditable: true }),
			false,
		)
		assert.equal(pressesButtonAgain({ key: "ArrowDown", repeat: true }, { tagName: "BUTTON" }), false)
		assert.equal(pressesButtonAgain({ key: "Enter", repeat: true }, null), false)
	})
})
