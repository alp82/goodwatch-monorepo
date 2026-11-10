import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("Ready to watch keeps its described switch, focused sibling tooltip, hover and touch behavior", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/discover-bar/discover-controls-test-vite.config.ts",
			"app/ui/discover-bar/ready-switch.test-support.tsx",
		],
		{
			encoding: "utf8",
			timeout: 30000,
			env: { ...process.env, CHOKIDAR_USEPOLLING: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		},
	)
	assert.match(output, /__READY_SWITCH_PASSED__/)
})
