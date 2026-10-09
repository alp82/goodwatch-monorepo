import assert from "node:assert/strict"
import { test } from "node:test"
import { encoderThreads, searchInFlightLimit } from "./limits.server.ts"

for (const role of [undefined, "page", "both", "search", " SEARCH ", "unknown"]) {
	test(`encoder threads for role ${role}`, () => {
		for (const cores of [1, 2, 3, 4, 6, 8, 16, 64]) {
			const expected = role?.trim().toLowerCase() === "search"
				? 2 : Math.min(4, Math.max(1, Math.floor(cores / 2)))
			for (const value of [undefined, "", "0", "-1", "abc", "2.5", "65", "Infinity"]) {
				assert.equal(encoderThreads({ WEBAPP_ROLE: role, SEARCH_ENCODER_THREADS: value }, cores), expected)
			}
			for (const value of [1, 2, 4, 8, 64]) {
				assert.equal(encoderThreads({ WEBAPP_ROLE: role, SEARCH_ENCODER_THREADS: String(value) }, cores), value)
			}
		}
		assert.equal(searchInFlightLimit({ WEBAPP_ROLE: role }), 4)
	})
}
