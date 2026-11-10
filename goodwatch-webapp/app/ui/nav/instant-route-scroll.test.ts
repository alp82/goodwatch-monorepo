import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("scroll-preserving query navigation avoids root mutations while resets, history and hashes retain their scroll behavior", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/nav/instant-route-scroll.test-support.tsx",
		],
		{
			encoding: "utf8",
			env: { ...process.env, CHOKIDAR_USEPOLLING: "true" },
			timeout: 30000,
		},
	)
	assert.match(output, /__INSTANT_ROUTE_SCROLL_OK__/)
})
