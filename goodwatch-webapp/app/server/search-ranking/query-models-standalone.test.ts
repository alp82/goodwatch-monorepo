import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

// The image build's models stage copies this one file and runs it (see the Dockerfile). An import from the app
// fails that build, as it did on October 7, 2026.
test("query-models.server.ts imports only Node's own modules", () => {
	const source = readFileSync(
		new URL("./query-models.server.ts", import.meta.url),
		"utf8",
	)
	const specifiers = [
		...source.matchAll(/^\s*(?:import|export)\s[^"']*from\s+["']([^"']+)["']/gm),
		...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
	].map((match) => match[1])
	assert.ok(specifiers.length > 0)
	assert.deepEqual(
		specifiers.filter((specifier) => !specifier.startsWith("node:")),
		[],
	)
})
