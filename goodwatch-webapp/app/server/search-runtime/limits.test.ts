import assert from "node:assert/strict"
import { test } from "node:test"
import { encoderWorkers, encoderSpinning } from "./limits.server.ts"

test("encoder workers default to one and accept integers from one to sixteen", () => {
	for (const value of [undefined, "", "0", "-1", "17", "1.5", "Infinity", "bad"]) {
		assert.equal(encoderWorkers({ SEARCH_ENCODER_WORKERS: value }), 1)
	}
	for (const value of [1, 4, 16]) {
		assert.equal(encoderWorkers({ SEARCH_ENCODER_WORKERS: String(value) }), value)
	}
})

test("encoder spinning is explicit or left to the runtime", () => {
	assert.equal(encoderSpinning({ SEARCH_ENCODER_SPINNING: "0" }), false)
	assert.equal(encoderSpinning({ SEARCH_ENCODER_SPINNING: "1" }), true)
	for (const value of [undefined, "", "true", "false", "2", " 1 "]) {
		assert.equal(encoderSpinning({ SEARCH_ENCODER_SPINNING: value }), undefined)
	}
})
