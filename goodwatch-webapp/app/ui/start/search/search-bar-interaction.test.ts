import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("the actual search field owns typing and commits its query across actions and navigation", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/search/search-bar-interaction.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 30000 },
	)
	assert.match(result, /__SEARCH_BAR_INTERACTION_PASSED__/)
})
