import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("TV offers and read-only fingerprint use the title page's data and semantics", () => {
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/title-extras.test-support.tsx",
		],
		{ stdio: "pipe" },
	)
})
