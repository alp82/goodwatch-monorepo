// Example prompts must read like something a person typed (the owner's rule, October 17, 2026): no capitals, no full
// stop, no "best match", and the short "s2e4" form instead of spelled-out seasons and episodes.
import assert from "node:assert/strict"
import { test } from "node:test"
import { ALL_EXAMPLE_PROMPTS } from "./example-prompts.ts"

test("every example prompt is lowercase", () => {
	for (const prompt of ALL_EXAMPLE_PROMPTS)
		assert.equal(prompt, prompt.toLowerCase(), prompt)
})

test("no example prompt ends with a full stop", () => {
	for (const prompt of ALL_EXAMPLE_PROMPTS)
		assert.ok(!prompt.endsWith("."), prompt)
})

test("no example prompt uses product words or spelled-out episodes", () => {
	for (const prompt of ALL_EXAMPLE_PROMPTS) {
		assert.ok(!/best match/.test(prompt), prompt)
		assert.ok(!/\b(season|episode) \d/.test(prompt), prompt)
		assert.ok(!/out of 10/.test(prompt), prompt)
	}
})

test("example prompts stay short", () => {
	for (const prompt of ALL_EXAMPLE_PROMPTS)
		assert.ok(prompt.split(" ").length <= 9, prompt)
})
