import assert from "node:assert/strict"
import { test } from "node:test"
import { beginSearchTelemetry } from "./telemetry.server.ts"

test("delivery evidence keeps first usable latency independent of full computation and records one finish", () => {
	let now = 100
	const events: Record<string, unknown>[] = []
	const recorder = beginSearchTelemetry(event => events.push(event), () => now)
	now = 120
	recorder.delivered(false, false, 20, [])
	now = 140
	recorder.delivered(false, true, 40, [])
	now = 230
	recorder.delivered(true, true, 120, ["Title lookup unavailable", "private query/account sentinel"])
	now = 240
	recorder.finish("completed")
	recorder.finish("failed")
	assert.equal(events.length, 2)
	assert.equal(events[0].phase, "accepted")
	assert.equal(events[1].id, events[0].id)
	assert.equal(events[1].firstResultsMs, 40)
	assert.equal(events[1].computationMs, 120)
	assert.equal(events[1].titleLookupFailed, true)
	assert.equal(events[1].status, "completed")
	assert.ok(!JSON.stringify(events).includes("sentinel"))
})

test("failures before delivery and cancelled delivered searches remain visible without a history row", () => {
	for (const delivered of [false, true]) {
		let now = 10
		const events: Record<string, unknown>[] = []
		const recorder = beginSearchTelemetry(event => events.push(event), () => now)
		now = 30
		if (delivered) recorder.delivered(false, true, 20, [])
		now = 50
		recorder.finish(delivered ? "aborted" : "failed")
		assert.equal(events[1].firstResultsMs, delivered ? 20 : null)
		assert.equal(events[1].status, delivered ? "aborted" : "failed")
		assert.equal(events[1].computationMs, null)
	}
})
