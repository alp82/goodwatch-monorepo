import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("unchanged Browse skips parent work while its controls and new data still update", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/browse/browse-render-interaction.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 30000 },
	)
	assert.match(result, /__BROWSE_INTERACTION_PASSED__/)
})
