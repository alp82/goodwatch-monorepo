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
	[
		"incomplete CrateDB credentials",
		{
			AUTH_IMPORT_CRATE_USERNAME: "copy-reader",
			AUTH_IMPORT_CRATE_PASSWORD: "",
		},
		[],
	],
	["unknown arguments", {}, ["--force"]],
	["unknown target profile", { AUTH_IMPORT_TARGET_PROFILE: "production" }, []],
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

const productionEnv = {
	AUTH_IMPORT_TARGET_PROFILE: "production",
	AUTH_IMPORT_SOURCE_URL:
		"postgresql://auth_copy_reader:never-print-source@127.0.0.1:15651/auth_copy",
	AUTH_IMPORT_CRATE_ORIGIN: "http://127.0.0.1:15648",
	AUTH_IMPORT_CRATE_USERNAME: "goodwatch_auth",
	AUTH_IMPORT_CRATE_PASSWORD: "never-print-target",
	AUTH_IMPORT_PAYLOAD_SECRET: "never-print-root-secret-at-least-32-characters",
	AUTH_IMPORT_ENCRYPTION_KEYS: JSON.stringify({
		active: "launch",
		keys: { launch: "never-print-key-secret-at-least-32-characters" },
	}),
	AUTH_IMPORT_WRITERS_STOPPED: "yes",
	AUTH_IMPORT_RECEIPT: "/private/receipt.json",
}
for (const [name, env, args] of [
	["missing explicit opt-in", {}, []],
	[
		"copy declaration in production",
		{ AUTH_IMPORT_COPY_ONLY: "yes" },
		["--allow-production"],
	],
	[
		"writers not stopped",
		{ AUTH_IMPORT_WRITERS_STOPPED: "" },
		["--allow-production"],
	],
	[
		"admin target credentials",
		{ AUTH_IMPORT_CRATE_USERNAME: "crate" },
		["--allow-production"],
	],
	[
		"missing target password",
		{ AUTH_IMPORT_CRATE_PASSWORD: "" },
		["--allow-production"],
	],
	[
		"source admin",
		{
			AUTH_IMPORT_SOURCE_URL:
				"postgresql://postgres:never-print@127.0.0.1:15651/auth_copy",
		},
		["--allow-production"],
	],
	[
		"missing key ring",
		{ AUTH_IMPORT_ENCRYPTION_KEYS: "" },
		["--allow-production"],
	],
	[
		"invalid key ring",
		{ AUTH_IMPORT_ENCRYPTION_KEYS: "{}" },
		["--allow-production"],
	],
	["missing receipt", { AUTH_IMPORT_RECEIPT: "" }, ["--allow-production"]],
	["rerun without apply", {}, ["--allow-production", "--rerun"]],
	["duplicate flags", {}, ["--allow-production", "--allow-production"]],
	[
		"remote target",
		{ AUTH_IMPORT_CRATE_ORIGIN: "http://10.0.0.11:4200" },
		["--allow-production"],
	],
] as const)
	test(`production CLI refuses ${name} without exposing secrets`, () => {
		const result = spawnSync(
			process.execPath,
			["scripts/auth-importer/import.ts", ...args],
			{
				encoding: "utf8",
				env: {
					...process.env,
					AUTH_IMPORT_COPY_ONLY: undefined,
					...productionEnv,
					...env,
				},
			},
		)
		assert.equal(result.status, 1)
		assert.match(result.stdout, /configuration_refused/)
		assert.ok(!result.stdout.includes("never-print"))
		assert.equal(result.stderr, "")
	})
