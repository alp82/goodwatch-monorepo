import { test } from "node:test"
import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import {
	configureTitleSnapshotReader,
	startTitleSnapshot,
	stopTitleSnapshot,
	getTitleSnapshot,
} from "./index.server.ts"
test("An injected snapshot reader is configured before loading; stop leaves its connection with the caller and cannot reconfigure after start", async () => {
	const calls: string[] = []
	let disconnected = false
	const reader = {
		get: async (key: string) => {
			calls.push(key)
			return null
		},
		getBuffer: async () => null,
		disconnect() {
			disconnected = true
		},
	}
	configureTitleSnapshotReader(reader)
	startTitleSnapshot()
	try {
		for (let i = 0; i < 30 && !calls.length; i++) await delay(5)
		assert.deepEqual(calls, ["title-snapshot:current"])
		assert.equal(getTitleSnapshot(), null)
		assert.throws(() => configureTitleSnapshotReader(reader), /before loading/)
	} finally {
		stopTitleSnapshot()
	}
	assert.equal(disconnected, false)
	assert.throws(() => configureTitleSnapshotReader(reader), /before loading/)
	reader.disconnect()
	assert.equal(disconnected, true)
})
