import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("family positions preserve all four individual dials across ties and the full-page threshold", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/server/browse/dial-positions.test-support.ts",
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
	assert.match(output, /family positions match individual dials/)
})
