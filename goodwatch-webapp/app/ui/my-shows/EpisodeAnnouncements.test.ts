import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
test("My shows keeps episode news through navigation and dismisses it without removing Continue", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/my-shows/announcements-interaction.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 20000 },
	)
	assert.match(result, /__ANNOUNCEMENT_INTERACTION_PASSED__/)
})
