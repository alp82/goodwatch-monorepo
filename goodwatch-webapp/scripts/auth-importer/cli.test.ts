import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"

for (const [name, env, args] of [
	[
		"remote Postgres",
		{
			AUTH_IMPORT_SOURCE_URL:
				"postgresql://fake:fake@db.example.test:15651/auth_copy",
		},
		[],
	],
	[
		"remote CrateDB",
		{ AUTH_IMPORT_CRATE_ORIGIN: "http://production.example.test:4200" },
		[],
	],
	[
		"Postgres query overrides",
		{
			AUTH_IMPORT_SOURCE_URL:
				"postgresql://fake:fake@127.0.0.1:15651/auth_copy?host=db.example.test",
		},
		[],
	],
	["missing copy declaration", { AUTH_IMPORT_COPY_ONLY: "" }, []],
	["unknown arguments", {}, ["--force"]],
] as const)
	test(`CLI refuses ${name} before connecting and never prints connection secrets`, () => {
		const result = spawnSync(
			process.execPath,
			["scripts/auth-importer/import.ts", ...args],
			{
				encoding: "utf8",
				env: Object.assign(
					{
						...process.env,
						AUTH_IMPORT_SOURCE_URL:
							"postgresql://fake:never-print-this-password@127.0.0.1:15651/auth_copy",
						AUTH_IMPORT_CRATE_ORIGIN: "http://127.0.0.1:15648",
						AUTH_IMPORT_PAYLOAD_SECRET:
							"never-print-this-encryption-secret-551",
						AUTH_IMPORT_COPY_ONLY: "yes",
					},
					env,
				),
			},
		)
		assert.equal(result.status, 1)
		assert.match(result.stdout, /configuration_refused/)
		assert.ok(!result.stdout.includes("never-print"))
		assert.equal(result.stderr, "")
	})
