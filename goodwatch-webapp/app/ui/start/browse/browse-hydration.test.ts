import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("early search input hydrates without synchronously hydrating Browse, whose complete HTML and controls remain", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/browse/browse-hydration.test-support.tsx",
		],
		{
			encoding: "utf8",
			timeout: 30000,
			env: { ...process.env, CHOKIDAR_USEPOLLING: "1" },
		},
	)
	assert.match(result, /__BROWSE_HYDRATION_PASSED__/)
})
