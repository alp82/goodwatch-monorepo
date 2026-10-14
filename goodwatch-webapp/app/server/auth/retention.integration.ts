import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { collectAuthGarbage } from "./maintenance.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const adapter = crateAuthAdapter({ sql })({})

test("garbage collection expires old sessions while preserving a live session and replay barriers", async () => {
	const userId = randomUUID()
	const token = randomUUID()
	await adapter.create({ model: "session", data: { userId, token, expiresAt: new Date(Date.now() - 1000) } })
	const live = await adapter.create({ model: "session", data: { userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86400000) } })
	const report = await collectAuthGarbage({ sql, encryptionSecret, model: "session" })
	assert.equal(report.expired, 1)
	assert.equal(await adapter.findOne({ model: "session", where: [{ field: "token", value: token }] }), null)
	assert.equal((await adapter.findOne<{ id: string }>({ model: "session", where: [{ field: "token", value: live.token }] }))?.id, live.id)
	await collectAuthGarbage({ sql, encryptionSecret, model: "session", now: new Date(Date.now() + 3 * 86400000) })
	await assert.rejects(adapter.create({ model: "session", data: { userId, token, expiresAt: new Date(Date.now() + 86400000) } }), /duplicate key/)
})

test("a lost consumption acknowledgement whose receipt was collected remains indeterminate", async () => {
	const verification = await adapter.create({ model: "verification", data: { identifier: randomUUID(), value: "one-use", expiresAt: new Date(Date.now() + 86400000) } })
	const consumer = crateAuthAdapter({
		encryptionSecret,
		sql: async (statement, args) => {
			const result = await sql(statement, args)
			if (statement.startsWith("UPDATE doc.auth_verification SET payload=")) {
				const collected = await collectAuthGarbage({ sql, encryptionSecret, model: "verification", now: new Date(Date.now() + 2 * 86400000) })
				assert.ok(collected.compacted >= 1)
				return { ...result, rowcount: 0 }
			}
			return result
		},
	})({})
	await assert.rejects(consumer.consumeOne({ model: "verification", where: [{ field: "id", value: verification.id }] }), /indeterminate/)
	assert.equal(await adapter.consumeOne({ model: "verification", where: [{ field: "id", value: verification.id }] }), null)
})

test("garbage collection paginates a population that exceeds the adapter's enumeration bound", async () => {
	const restricted = crateAuthAdapter({ sql, maxEnumeration: 2 })({})
	const userId = randomUUID()
	for (let i = 0; i < 7; i++) await restricted.create({ model: "session", data: { userId, token: randomUUID(), expiresAt: new Date(Date.now() - 1000) } })
	await assert.rejects(restricted.findMany({ model: "session", where: [{ field: "userId", value: userId }] }), /safe bound/)
	let cursor: string | undefined
	let expired = 0
	for (;;) {
		const report = await collectAuthGarbage({ sql, encryptionSecret, model: "session", batchSize: 2, cursor })
		assert.ok(report.scanned <= 2)
		expired += report.expired
		if (report.complete) break
		cursor = report.cursor!
	}
	assert.equal(expired, 7)
	assert.deepEqual(await restricted.findMany({ model: "session", where: [{ field: "userId", value: userId }] }), [])
})
