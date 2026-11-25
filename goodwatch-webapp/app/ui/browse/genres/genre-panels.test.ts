import { execFileSync } from "node:child_process"
import test from "node:test"

test("genre panel intent, selection, retries and viewer changes reuse only the correct response", () => {
	execFileSync("node_modules/.bin/vite-node", [
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/ui/browse/genres/genre-panels.test-support.ts",
	])
})
