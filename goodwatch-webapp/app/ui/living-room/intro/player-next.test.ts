import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("Next advances once per press, including during an automatic chapter handover, and the end has no Replay", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/intro/player-next.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 20000 },
	)
	assert.match(result, /__NEXT_PASSED__/)
})
