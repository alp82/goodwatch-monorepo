import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("signing in dismisses the guest intro and member replays have no signup action", () => {
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/intro/member-transition.test-support.tsx",
		],
		{ encoding: "utf8", stdio: "pipe" },
	)
})
