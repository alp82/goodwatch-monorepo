// Reload jitter keeps instances from rebuilding together.
import assert from "node:assert/strict"
import { test } from "node:test"

import { reloadDelayMs } from "./search-index-retry.server.ts"

test("reload jitter bounds and measurement cap", () => {
	const previous = process.env.RELOAD_JITTER_MAX_MS
	try {
		delete process.env.RELOAD_JITTER_MAX_MS
		assert.equal(reloadDelayMs(0), 0)
		assert.equal(reloadDelayMs(0.999999), 239999)
		process.env.RELOAD_JITTER_MAX_MS = "100"
		assert.equal(reloadDelayMs(0.5), 50)
		process.env.RELOAD_JITTER_MAX_MS = "0"
		assert.equal(reloadDelayMs(0.99), 0)
		process.env.RELOAD_JITTER_MAX_MS = "999999"
		assert.equal(reloadDelayMs(0.5), 120000)
		process.env.RELOAD_JITTER_MAX_MS = "invalid"
		assert.equal(reloadDelayMs(0.5), 120000)
	} finally {
		if (previous === undefined) delete process.env.RELOAD_JITTER_MAX_MS
		else process.env.RELOAD_JITTER_MAX_MS = previous
	}
})
