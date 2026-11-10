import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("Done paints its feedback before returning focus and cancels stale focus without stealing a new choice", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/moods/panel-done-focus.test-support.tsx",
		],
		{
			encoding: "utf8",
			timeout: 30000,
			env: { ...process.env, CHOKIDAR_USEPOLLING: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		},
	)
	assert.match(output, /__PANEL_DONE_FOCUS_PASSED__/)
})
