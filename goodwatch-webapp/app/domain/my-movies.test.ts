// My movies (#385): "How long?", the fourth choice of the control strip, and what a movie that does not fit says.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"

const { TIME_CHOICES, timeOf, timeLabel, minutesOver, misfitOf, misfitWords, durationWords } =
	await import("./my-movies.ts")

test("How long? offers any length and three limits", () => {
	assert.deepEqual(TIME_CHOICES, [90, 120, 150])
	assert.equal(timeLabel(null), "Any length")
	assert.equal(timeLabel(90), "Up to 1h 30")
	assert.equal(timeLabel(120), "Up to 2h")
	assert.equal(timeLabel(150), "Up to 2h 30")
})

test("the URL names a limit in minutes; anything else is any length", () => {
	assert.equal(timeOf("120"), 120)
	assert.equal(timeOf("90"), 90)
	assert.equal(timeOf(null), null)
	assert.equal(timeOf(""), null)
	assert.equal(timeOf("100"), null)
	assert.equal(timeOf("2h"), null)
})

test("a movie fits when it runs no longer than the time the person has", () => {
	assert.equal(minutesOver(120, 120), 0)
	assert.equal(minutesOver(95, 120), 0)
	assert.equal(minutesOver(155, 120), 35)
	// Any length: nothing runs over.
	assert.equal(minutesOver(240, null), 0)
	// A movie without a known runtime is not said to run over.
	assert.equal(minutesOver(null, 90), 0)
	assert.equal(minutesOver(0, 90), 0)
})

test("a movie that does not fit says why, the time first", () => {
	assert.deepEqual(misfitOf({ over: 35, inMood: false, onServices: false }), { why: "time", over: 35 })
	assert.deepEqual(misfitOf({ over: 0, inMood: false, onServices: false }), { why: "mood" })
	assert.deepEqual(misfitOf({ over: 0, inMood: true, onServices: false }), { why: "services" })
	assert.equal(misfitOf({ over: 0, inMood: true, onServices: true }), null)
	assert.equal(misfitWords({ why: "time", over: 35 }), "35 min over")
	assert.equal(misfitWords({ why: "time", over: 60 }), "1h over")
	assert.equal(misfitWords({ why: "time", over: 75 }), "1h 15m over")
	assert.equal(misfitWords({ why: "mood" }), "Another mood")
	assert.equal(misfitWords({ why: "services" }), "Not on your services")
})

test("a duration reads in hours and minutes", () => {
	assert.equal(durationWords(45), "45 min")
	assert.equal(durationWords(120), "2h")
	assert.equal(durationWords(132), "2h 12m")
})
