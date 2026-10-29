// The intro theater on the page (IntroTheater.tsx, background-lock.ts) and the TV corner that opens it
// (HowItWorksCorner.tsx); the support file asserts it in happy-dom.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("the corner retries a failed load; the theater locks the page behind and Close hands it back", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/how/intro-theater.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 30000 },
	)
	assert.match(result, /__INTRO_THEATER_PASSED__/)
})
