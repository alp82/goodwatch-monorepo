import { execFileSync } from "node:child_process"
import test from "node:test"

test("facts availability drives tiles, chips and badges across pending responses; status counts reserve space", () => {
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/discover-bar/facts-test-vite.config.ts",
			"app/ui/discover-bar/facts.test-support.tsx",
		],
		{ stdio: ["ignore", "pipe", "pipe"] },
	)
})
