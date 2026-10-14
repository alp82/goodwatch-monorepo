import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test, before, after } from "node:test"
import { crateAuthAdapter, localCrateTransport, migrateAuthTables } from "./crate-adapter.server.ts"

const sql = localCrateTransport(["http://127.0.0.1:15548"])

async function clean() {
 await sql("REFRESH TABLE doc.auth_capacity, doc.auth_session, doc.auth_oauth_consent, doc.auth_jwks")
 await sql("DELETE FROM doc.auth_capacity")
 await sql("DELETE FROM doc.auth_session")
 await sql("DELETE FROM doc.auth_oauth_consent")
 await sql("DELETE FROM doc.auth_jwks")
}
before(async () => { await migrateAuthTables(sql); await clean() })
after(clean)

test("concurrent session creation cannot exceed the configured population admission limit", async () => {
	const userId = randomUUID()
	const adapter = crateAuthAdapter({ sql, populationBounds: { buckets: 1, limitPerBucket: 2 } })({})
	const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => adapter.create({ model: "session", data: { userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86400000) } })))
	assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 2)
	for (const outcome of outcomes) if (outcome.status === "rejected") assert.match(String(outcome.reason), /population capacity/)
	assert.equal((await adapter.findMany({ model: "session", where: [{ field: "userId", value: userId }] })).length, 2)
})

test("reconciliation reclaims deleted session capacity without admitting a paused insert", async () => {
	await clean()
	const { reconcileAuthCapacity } = await import("./maintenance.server.ts")
	const bounds = { buckets: 1, limitPerBucket: 1 }
	const healthy = crateAuthAdapter({ sql, populationBounds: bounds })({})
	const token = randomUUID()
	let reconciled = false
	const paused = crateAuthAdapter({
		populationBounds: bounds,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		sql: async (statement, args) => {
			if (!reconciled && statement.startsWith("INSERT INTO doc.auth_session (")) {
				reconciled = true
				const report = await reconcileAuthCapacity({ sql, encryptionSecret: "disposable-local-auth-integration-key-548", now: new Date(Date.now() + 3600000) })
				assert.equal(report.released, 1)
				await healthy.create({ model: "session", data: { token: randomUUID(), userId: "admitted", expiresAt: new Date(Date.now() + 86400000) } })
			}
			return sql(statement, args)
		},
	})({})
	await assert.rejects(paused.create({ model: "session", data: { token, userId: "late", expiresAt: new Date(Date.now() + 86400000) } }), /fenced/)
	assert.equal(await healthy.findOne({ model: "session", where: [{ field: "token", value: token }] }), null)
	const sessions = await healthy.findMany<{ token: string }>({ model: "session", where: [{ field: "userId", value: "admitted" }] })
	assert.equal(sessions.length, 1)
	await healthy.delete({ model: "session", where: [{ field: "token", value: sessions[0].token }] })
	assert.equal((await reconcileAuthCapacity({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })).released, 1)
	await healthy.create({ model: "session", data: { token: randomUUID(), userId: "admitted", expiresAt: new Date(Date.now() + 86400000) } })
})

test("an old consent insertion stays fenced across a later reconnect and capacity collection", async () => {
	await clean()
	const { authTestOptions } = await import("./fixtures.integration.ts")
	const { reconcileAuthCapacity } = await import("./maintenance.server.ts")
	const bounds = { buckets: 1, limitPerBucket: 1 }
	const healthy = crateAuthAdapter({ sql, populationBounds: bounds })(authTestOptions)
	const data = { userId: randomUUID(), clientId: randomUUID(), scopes: ["mcp:read"] }
	let delayed = true
	const paused = crateAuthAdapter({
		populationBounds: bounds,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		sql: async (statement, args) => {
			if (delayed && statement.startsWith("INSERT INTO doc.auth_oauth_consent (")) {
				delayed = false
				assert.equal((await reconcileAuthCapacity({ sql, encryptionSecret: "disposable-local-auth-integration-key-548", now: new Date(Date.now() + 3600000) })).released, 1)
				const reconnected = await healthy.create({ model: "oauthConsent", data })
				await healthy.delete({ model: "oauthConsent", where: [{ field: "id", value: reconnected.id }] })
				assert.equal((await reconcileAuthCapacity({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })).released, 1)
				await healthy.create({ model: "oauthConsent", data: { ...data, clientId: randomUUID() } })
			}
			return sql(statement, args)
		},
	})(authTestOptions)
	await assert.rejects(paused.create({ model: "oauthConsent", data }), /fenced/)
	assert.equal(await healthy.findOne({ model: "oauthConsent", where: [{ field: "clientId", value: data.clientId }, { field: "userId", value: data.userId }] }), null)
})

test("the launch audit reports rows imported without capacity admission", async () => {
	const { authTestOptions } = await import("./fixtures.integration.ts")
	const { auditAuthPopulation } = await import("./maintenance.server.ts")
	const legacy = crateAuthAdapter({ sql })(authTestOptions)
	await legacy.create({ model: "jwks", data: { publicKey: "public fixture", privateKey: "private fixture", createdAt: new Date() } })
	const report = await auditAuthPopulation({ sql, encryptionSecret: "disposable-local-auth-integration-key-548", model: "jwks" })
	assert.ok(report.unadmitted >= 1)
	assert.equal(report.safe, false)
})
