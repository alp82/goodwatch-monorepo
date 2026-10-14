import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { recoverEmailClaims } from "./maintenance.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const adapter = crateAuthAdapter({ sql })({})

test("claim recovery lets a member retry signup after a crash between reservation and user insertion", async () => {
	const email = `${randomUUID()}@example.test`
	const crashed = crateAuthAdapter({
		encryptionSecret,
		sql: (statement, args) => {
			if (statement.startsWith("INSERT INTO doc.auth_user (")) throw new Error("Simulated process loss")
			return sql(statement, args)
		},
	})({})
	await assert.rejects(crashed.create({ model: "user", data: { email, name: "Member" } }), /indeterminate/)
	await assert.rejects(adapter.create({ model: "user", data: { email, name: "Retry" } }), /duplicate key/)
	const report = await recoverEmailClaims({ sql, encryptionSecret, now: new Date(Date.now() + 3600000) })
	assert.equal(report.released, 1)
	const member = await adapter.create({ model: "user", data: { email, name: "Retry" } })
	assert.equal((await adapter.findOne<{ id: string }>({ model: "user", where: [{ field: "email", value: email }] }))?.id, member.id)
	assert.equal((await recoverEmailClaims({ sql, encryptionSecret, now: new Date(Date.now() + 3600000) })).released, 0)
})

test("a signup paused after reserving its email cannot appear after recovery releases it", async () => {
	const email = `${randomUUID()}@example.test`
	let recovered = false
	const delayed = crateAuthAdapter({
		encryptionSecret,
		sql: async (statement, args) => {
			if (!recovered && statement.startsWith("INSERT INTO doc.auth_user (")) {
				recovered = true
				assert.equal((await recoverEmailClaims({ sql, encryptionSecret, now: new Date(Date.now() + 3600000) })).released, 1)
				await adapter.create({ model: "user", data: { email, name: "New owner" } })
			}
			return sql(statement, args)
		},
	})({})
	await assert.rejects(delayed.create({ model: "user", data: { email, name: "Delayed owner" } }), /duplicate key/)
	assert.equal((await adapter.findOne<{ name: string }>({ model: "user", where: [{ field: "email", value: email }] }))?.name, "New owner")
})

test("recovery releases an abandoned address change without disturbing the member's current email", async () => {
	const currentEmail = `${randomUUID()}@example.test`
	const abandonedEmail = `${randomUUID()}@example.test`
	const user = await adapter.create({ model: "user", data: { email: currentEmail, name: "Member" } })
	const crashed = crateAuthAdapter({
		encryptionSecret,
		sql: (statement, args) => {
			if (statement.startsWith("UPDATE doc.auth_user SET payload=")) throw new Error("Simulated process loss")
			return sql(statement, args)
		},
	})({})
	await assert.rejects(crashed.update({ model: "user", where: [{ field: "id", value: user.id }], update: { email: abandonedEmail } }), /indeterminate/)
	assert.equal((await recoverEmailClaims({ sql, encryptionSecret, now: new Date(Date.now() + 3600000) })).released, 1)
	assert.equal((await adapter.findOne<{ id: string }>({ model: "user", where: [{ field: "email", value: currentEmail }] }))?.id, user.id)
	await adapter.create({ model: "user", data: { email: abandonedEmail, name: "Available again" } })
})


test("claim recovery gives a new signup reservation fifteen minutes before fencing it", async () => {
 const email = `${randomUUID()}@example.test`
 const crashed = crateAuthAdapter({ encryptionSecret, sql: (statement, args) => {
  if (statement.startsWith("INSERT INTO doc.auth_user (")) throw new Error("Simulated process loss")
  return sql(statement, args)
 } })({})
 await assert.rejects(crashed.create({ model: "user", data: { email, name: "Member" } }), /indeterminate/)
 assert.equal((await recoverEmailClaims({ sql, encryptionSecret })).released, 0)
 assert.equal((await recoverEmailClaims({ sql, encryptionSecret, now: new Date(Date.now() + 3600000) })).released, 1)
})
