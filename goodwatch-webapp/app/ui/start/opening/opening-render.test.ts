import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("cached guest HTML hydrates its pre-paint gate for fresh/returning and reduced-motion visits; member and client navigation skip", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/opening/opening-render.test-support.tsx",
		],
		{
			encoding: "utf8",
			env: { ...process.env, CHOKIDAR_USEPOLLING: "1" },
			stdio: ["ignore", "pipe", "pipe"],
		},
	)
	assert.match(output, /__OPENING_HYDRATION_OK__/)
})
