import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("person filters are buttons before and after hydration and navigate on activation", () => {
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/person/filter-button.test-support.tsx",
		],
		{ stdio: "pipe" },
	)
})
