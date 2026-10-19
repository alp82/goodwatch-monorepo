import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("poster badges and detail scores agree on unrated titles", () => {
	const output = execFileSync("node_modules/.bin/vite-node", [
		"--config", "app/ui/imports/source-import-test-vite.config.ts",
		"app/ui/ratings/ratings-render.test-support.tsx",
	], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
	assert.match(output, /Score rendering passed/)
})
