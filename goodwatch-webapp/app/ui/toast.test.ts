import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("notifications load on demand, keep the first messages and preserve rich actions", () => {
	const output = execFileSync("node_modules/.bin/vite-node", [
		"--config", "app/ui/imports/source-import-test-vite.config.ts", "app/ui/toast.test-support.tsx",
	], { encoding: "utf8", timeout: 30000, env: { ...process.env, CHOKIDAR_USEPOLLING: "true" }, stdio: ["ignore", "pipe", "pipe"] })
	assert.match(output, /__TOAST_LAZY_OK__/)
})
