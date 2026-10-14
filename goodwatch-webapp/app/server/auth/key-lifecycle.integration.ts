import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { authTestOptions } from "./fixtures.integration.ts"
import { rotateAuthEncryption } from "./maintenance.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const first = { active: "first", keys: { first: "first-disposable-payload-encryption-key-565" } }
const second = { active: "second", keys: { ...first.keys, second: "second-disposable-payload-encryption-key-565" } }

test("payload keys rotate durably without changing credentials or the permanent email lookup secret", async () => {
	const old = crateAuthAdapter({ sql, encryptionSecret, encryptionKeys: first })(authTestOptions)
	const member = await old.create({ model: "user", data: { email: `${randomUUID()}@example.test`, name: "Member" } })
	const account = await old.create({ model: "account", data: { userId: member.id, accountId: randomUUID(), providerId: "google", accessToken: "credential that must survive rotation" } })
	for (const model of ["user", "account"]) {
		let cursor: string | undefined
		for (;;) {
			const report = await rotateAuthEncryption({ sql, encryptionSecret, encryptionKeys: second, model, batchSize: 2, cursor })
			if (report.complete) break
			cursor = report.cursor!
		}
	}
	const restarted = crateAuthAdapter({ sql, encryptionSecret, encryptionKeys: { active: "second", keys: { second: second.keys.second }, allowLegacy: false } })(authTestOptions)
	assert.equal((await restarted.findOne<{ id: string }>({ model: "user", where: [{ field: "email", value: member.email }] }))?.id, member.id)
	assert.equal((await restarted.findMany<{ accessToken: string }>({ model: "account", where: [{ field: "id", value: account.id }] }))[0].accessToken, "credential that must survive rotation")
	await assert.rejects(old.findMany({ model: "account", where: [{ field: "id", value: account.id }] }), /decrypt/)
})
