import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import { RAMP_DOWN_MS, RAMP_UP_MS, filmClock, rampRate } from "./speed.ts"

describe("rampRate", () => {
	it("starts at the old pace and reaches the new one at the ramp's end", () => {
		assert.equal(rampRate(1, 2, 0), 1)
		assert.equal(rampRate(1, 2, RAMP_UP_MS), 2)
		assert.equal(rampRate(2, 1, RAMP_DOWN_MS), 1)
		assert.equal(rampRate(1, 2, 10_000), 2)
	})
	it("is past halfway at the ramp's middle: it speeds up quickly", () => {
		assert.ok(rampRate(1, 2, RAMP_UP_MS / 2) > 1.5)
		assert.ok(rampRate(2, 1, RAMP_DOWN_MS / 2) < 1.5)
	})
})

describe("filmClock", () => {
	beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "Date"] }))
	afterEach(() => mock.timers.reset())

	it("fires on time at 1x", () => {
		const clock = filmClock(() => Date.now())
		let fired = 0
		clock.after(1000, () => fired++)
		mock.timers.tick(999)
		assert.equal(fired, 0)
		mock.timers.tick(1)
		assert.equal(fired, 1)
	})
	it("fires in half the time at 2x", () => {
		const clock = filmClock(() => Date.now())
		let fired = 0
		clock.after(1000, () => fired++)
		clock.setRate(2)
		mock.timers.tick(500)
		assert.equal(fired, 1)
	})
	it("keeps the film time already passed when the speed changes", () => {
		const clock = filmClock(() => Date.now())
		let fired = 0
		clock.after(1000, () => fired++)
		mock.timers.tick(400) // 400 ms of film at 1x
		clock.setRate(2)
		mock.timers.tick(200) // 400 more at 2x
		clock.setRate(1)
		mock.timers.tick(199)
		assert.equal(fired, 0)
		mock.timers.tick(1)
		assert.equal(fired, 1)
	})
	it("cancels", () => {
		const clock = filmClock(() => Date.now())
		let fired = 0
		const cancel = clock.after(100, () => fired++)
		cancel()
		clock.setRate(2)
		mock.timers.tick(1000)
		assert.equal(fired, 0)
	})
})
