import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("place identity families load independently on later and concurrent requests", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/server/browse/identity-marks.test-support.ts",
		],
		{
			encoding: "utf8",
			timeout: 30000,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				CRATE_HOSTS: "127.0.0.1",
				CRATE_PORT: "1",
				AVAILABILITY_PRELOAD_COUNTRIES: "",
			},
		},
	)
	assert.match(output, /independent mark families preserved/)
})
