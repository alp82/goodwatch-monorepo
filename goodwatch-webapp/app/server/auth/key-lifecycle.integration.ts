import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { authTestOptions } from "./fixtures.integration.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { rotateAuthEncryption } from "./maintenance.server.ts"
import { authTestCrateOrigins } from "./store-fixtures.integration.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const first = {
	active: "first",
	keys: { first: "first-disposable-payload-encryption-key-565" },
}
const second = {
	active: "second",
	keys: {
		...first.keys,
		second: "second-disposable-payload-encryption-key-565",
	},
}

test("payload keys rotate durably without changing credentials or the permanent email lookup secret", async () => {
	const old = crateAuthAdapter({
		sql,
		encryptionSecret,
		encryptionKeys: first,
	})(authTestOptions)
	const member = await old.create({
		model: "user",
		data: { email: `${randomUUID()}@example.test`, name: "Member" },
	})
	const account = await old.create({
		model: "account",
		data: {
			userId: member.id,
			accountId: randomUUID(),
			providerId: "google",
			accessToken: "credential that must survive rotation",
		},
	})
	for (const model of ["user", "account"]) {
		let cursor: string | undefined
		for (;;) {
			const report = await rotateAuthEncryption({
				sql,
				encryptionSecret,
				encryptionKeys: second,
				model,
				batchSize: 2,
				cursor,
			})
			if (report.complete) break
			assert.ok(report.cursor)
			cursor = report.cursor
		}
	}
	const restarted = crateAuthAdapter({
		sql,
		encryptionSecret,
		encryptionKeys: {
			active: "second",
			keys: { second: second.keys.second },
			allowLegacy: false,
		},
	})(authTestOptions)
	assert.equal(
		(
			await restarted.findOne<{ id: string }>({
				model: "user",
				where: [{ field: "email", value: member.email }],
			})
		)?.id,
		member.id,
	)
	assert.equal(
		(
			await restarted.findMany<{ accessToken: string }>({
				model: "account",
				where: [{ field: "id", value: account.id }],
			})
		)[0].accessToken,
		"credential that must survive rotation",
	)
	await assert.rejects(
		old.findMany({
			model: "account",
			where: [{ field: "id", value: account.id }],
		}),
		/decrypt/,
	)
})

test("the rotation CLI continues past an unreadable row and reports an incomplete rotation", async () => {
	const legacy = crateAuthAdapter({ sql })(authTestOptions)
	const key = await legacy.create({
		model: "jwks",
		data: {
			publicKey: "public fixture",
			privateKey: "private fixture",
			createdAt: new Date(),
		},
	})
	const id = randomUUID()
	await sql(
		"INSERT INTO doc.auth_verification (id,payload,receipts) VALUES (?,?,?)",
		[id, "v3.retired.bad.bad.bad", "bad"],
	)
	const rotated = spawnSync(
		process.execPath,
		["scripts/auth-maintenance/cli.ts", "rotate"],
		{
			encoding: "utf8",
			timeout: 60000,
			env: {
				PATH: process.env.PATH,
				NODE_ENV: "test",
				AUTH_CRATEDB_ORIGINS: authTestCrateOrigins.join(","),
				AUTH_CRATEDB_USERNAME: "crate",
				AUTH_CRATEDB_PASSWORD: "local-test-only",
				AUTH_CRATEDB_ENCRYPTION_SECRET: encryptionSecret,
				AUTH_CRATEDB_ENCRYPTION_KEYS: JSON.stringify(second),
			},
		},
	)
	assert.equal(rotated.status, 2, rotated.stderr)
	assert.ok(
		rotated.stderr.includes("doc.auth_verification") &&
			rotated.stderr.includes(id),
	)
	const reports = rotated.stdout
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line))
	assert.equal(reports.find((row) => row.model === "verification")?.skipped, 1)
	const current = crateAuthAdapter({
		sql,
		encryptionSecret,
		encryptionKeys: { ...second, allowLegacy: false },
	})(authTestOptions)
	assert.equal(
		(
			await current.findOne<{ id: string }>({
				model: "jwks",
				where: [{ field: "id", value: key.id }],
			})
		)?.id,
		key.id,
	)
})
