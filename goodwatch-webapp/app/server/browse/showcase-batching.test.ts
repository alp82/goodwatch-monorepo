import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("batched showcases preserve ordered choices across missing, overlapping and newly promoted candidates", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/server/browse/showcase-batching.test-support.ts",
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
	assert.match(output, /showcase selection preserved/)
})
