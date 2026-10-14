import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { authTestOptions } from "./fixtures.integration.ts"
import { crateAuthAdapter, localCrateTransport, migrateAuthTables } from "./crate-adapter.server.ts"

const endpoints = ["http://127.0.0.1:15548", "http://127.0.0.1:15549", "http://127.0.0.1:15550"]

test("a new member is immediately readable by id and normalized email without refresh", async () => {
	const { crateAuthAdapter, migrateAuthTables, localCrateTransport } = await import("./crate-adapter.server.ts")
	const sql = localCrateTransport(["http://127.0.0.1:15548"])
	assert.equal((await sql("SELECT count(*) FROM sys.nodes")).rows[0][0], 3)
	await migrateAuthTables(sql)
	const adapter = crateAuthAdapter({ sql })({})
	const member = await adapter.create({ model: "user", data: {
		id: randomUUID(), name: "Member", email: `${randomUUID()}@Example.test`, emailVerified: false,
	}, forceAllowId: true })
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "id", value: member.id }] }))?.name, "Member")
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "email", value: member.email.toLowerCase() }] }))?.id, member.id)
})

test("email changes reserve the new address before mutation and preserve uniqueness", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })({})
	const a = await adapter.create({ model: "user", data: { name: "A", email: `${randomUUID()}@example.test`, emailVerified: false } })
	const b = await adapter.create({ model: "user", data: { name: "B", email: `${randomUUID()}@example.test`, emailVerified: false } })
	await assert.rejects(adapter.update<Record<string, any>>({ model: "user", where: [{ field: "id", value: a.id }], update: { email: b.email } }), /duplicate key/)
	const newEmail = `${randomUUID()}@example.test`
	assert.equal((await adapter.update<Record<string, any>>({ model: "user", where: [{ field: "id", value: a.id }], update: { email: newEmail } }))?.email, newEmail)
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "email", value: newEmail }] }))?.id, a.id)
	assert.equal(await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "email", value: a.email }] }), null)
})

test("consent upsert keeps its deterministic id and absent referenceId is not an implicit null filter", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })(authTestOptions)
	const data = { clientId: randomUUID(), userId: randomUUID(), referenceId: "workspace", scopes: ["read"] }
	const consent = await adapter.create({ model: "oauthConsent", data })
	const updated = await adapter.create({ model: "oauthConsent", data: { ...data, scopes: ["read", "write"] } })
	assert.equal(updated.id, consent.id)
	assert.deepEqual((await adapter.findOne<Record<string, any>>({ model: "oauthConsent", where: [{ field: "clientId", value: data.clientId }, { field: "userId", value: data.userId }] }))?.scopes, ["read", "write"])
})

test("case-folded signup, Google linking and client registration each have one insert winner", async () => {
	const sql = localCrateTransport(endpoints)
	await migrateAuthTables(sql)
	const adapter = crateAuthAdapter({ sql })(authTestOptions)
	const email = `${randomUUID()}@example.test`
	for (const [model, data] of [
		["user", { name: "Member", email, emailVerified: false }],
		["account", { providerId: "google", accountId: randomUUID(), userId: "member" }],
		["oauthClient", { clientId: randomUUID(), name: "Connector" }],
	] as const) {
		const outcomes = await Promise.allSettled(Array.from({ length: 24 }, (_, i) => adapter.create({
			model, data: model === "user" ? { ...data, email: i % 2 ? email.toUpperCase() : email } : data,
		})))
		assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1, model)
		assert.equal(outcomes.filter(o => o.status === "rejected" && o.reason.code === "23505").length, 23, model)
	}
})

test("sessions remain readable by token and id when the secondary key is absent", async () => {
	const sql = localCrateTransport(endpoints)
	const options = { ...authTestOptions, session: { storeSessionInDatabase: true }, secondaryStorage: {
		get: async () => null, set: async () => {}, delete: async () => {}, getAndDelete: async () => null, increment: async () => 1,
	} }
	const adapter = crateAuthAdapter({ sql })(options)
	const member = await adapter.create({ model: "user", data: { name: "Member", email: `${randomUUID()}@example.test`, emailVerified: true } })
	const session = await adapter.create({ model: "session", data: { userId: member.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "session", where: [{ field: "token", value: session.token }], join: { user: true } }))?.user.id, member.id)
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "session", where: [{ field: "id", value: session.id }] }))?.token, session.token)
})

test("every inventoried call shape and hook pre-read is accepted; other shapes are rejected", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })({ ...authTestOptions, rateLimit: { storage: "database" }, session: { preserveSessionInDatabase: true } })
	// Independent transcription of #531, including optional DB modes and hooks.
	const inventory: Record<string, Record<string, string[]>> = {
		user: { findOne: ["id", "email"], update: ["id", "email"], delete: ["id"] },
		account: { findMany: ["providerId+accountId", "userId", "id"], findOne: ["userId+providerId+accountId"], updateMany: ["userId+providerId+accountId"], update: ["id"], delete: ["id"], deleteMany: ["userId"] },
		session: { findOne: ["token", "id"], update: ["token"], findMany: ["userId", "userId+expiresAt:gt", "token:in+expiresAt:gt"], delete: ["token"], deleteMany: ["userId", "token:in"], updateMany: ["token+expiresAt:gt", "userId+expiresAt:gt", "token:in+expiresAt:gt"] },
		verification: { findOne: ["id"], findMany: ["identifier"], update: ["identifier"], consumeOne: ["id"], deleteMany: ["identifier", "expiresAt:lt"] },
		jwks: { findMany: [""], findOne: ["id"] },
		oauthClient: { findOne: ["clientId"], findMany: ["referenceId", "userId", "clientId:in"], update: ["clientId", "clientId+clientDiscoveryId"], delete: ["clientId"] },
		oauthResource: { findOne: ["identifier"], findMany: ["", "identifier:in"], update: ["identifier"], delete: ["identifier"] },
		oauthClientResource: { findOne: ["clientId+resourceId"], findMany: ["clientId", "clientId+resourceId:in"], deleteMany: ["clientId+resourceId"] },
		oauthConsent: { findOne: ["clientId+userId", "clientId+userId+referenceId", "id"], findMany: ["userId"], update: ["id"], delete: ["id"] },
		oauthAccessToken: { findOne: ["token"], findMany: ["sessionId"], delete: ["id", "token"], deleteMany: ["refreshId", "refreshId:in", "authorizationCodeId"], updateMany: ["id:in"] },
		oauthRefreshToken: { findOne: ["token"], findMany: ["sessionId", "clientId+userId"], deleteMany: ["authorizationCodeId", "clientId+userId"], updateMany: ["id:in"], incrementOne: ["id+revoked"], update: ["id"] },
		oauthClientAssertion: { findOne: ["id"] },
		rateLimit: { findMany: ["key"], incrementOne: ["key+lastRequest:lte", "key+lastRequest:gt+count:lt"], deleteMany: ["lastRequest:lt"] },
	}
	for (const [model, operations] of Object.entries(inventory)) for (const [action, shapes] of Object.entries(operations)) for (const shape of shapes) {
		const where = shape ? shape.split("+").map(part => {
			const [field, operator = "eq"] = part.split(":")
			const value = operator === "in" ? [] : field === "providerId" ? "credential" : field === "revoked" ? null : field === "expiresAt" ? new Date(0) : ["count", "lastRequest"].includes(field) ? -1 : "absent-shape-fixture"
			return { field, operator, value }
		}) : []
		const params = { model, where, update: { updatedAt: new Date() }, increment: {}, set: { revoked: new Date(), count: 1, lastRequest: 1 } }
		await (adapter as any)[action](params)
		if (action === "delete" || action === "deleteMany") await adapter.findMany<Record<string, any>>({ model, where: where as any, limit: action === "delete" ? 1 : 100 })
	}
	for (const model of Object.keys(inventory)) {
		await assert.rejects(adapter.findMany<Record<string, any>>({ model, where: [{ field: "id", value: "x", operator: "contains" }] }), /Unsupported auth shape/)
	}
	await assert.rejects(adapter.findMany<Record<string, any>>({ model: "user", where: [] }), /Unsupported auth shape/)
	await assert.rejects(adapter.count({ model: "user" }), /Unsupported auth shape/)
})

test("an unlisted OR query throws before reading any auth record", async () => {
	const { crateAuthAdapter, localCrateTransport } = await import("./crate-adapter.server.ts")
	const adapter = crateAuthAdapter({ sql: localCrateTransport(["http://127.0.0.1:15548"]) })({})
	await assert.rejects(adapter.findOne<Record<string, any>>({ model: "user", where: [
		{ field: "id", value: "missing", connector: "OR" },
	] }), /Unsupported auth shape/)
})

test("refresh rotation including empty increments races revocation with exactly one winner", async () => {
	const { crateAuthAdapter, migrateAuthTables, localCrateTransport } = await import("./crate-adapter.server.ts")
	const sql = localCrateTransport(["http://127.0.0.1:15548", "http://127.0.0.1:15549", "http://127.0.0.1:15550"])
	await migrateAuthTables(sql)
	const adapter = crateAuthAdapter({ sql })(authTestOptions)
	const token = await adapter.create({ model: "oauthRefreshToken", data: {
		token: randomUUID(), clientId: "client", userId: "member", revoked: null,
	} })
	const where = [{ field: "id", value: token.id }, { field: "revoked", value: null }]
	const results = await Promise.all(Array.from({ length: 24 }, (_, i) => adapter.incrementOne<Record<string, any>>({
		model: "oauthRefreshToken", where, increment: {},
		set: i % 2 ? { revoked: new Date(), rotatedAt: new Date() } : { revoked: new Date() },
	})))
	assert.equal(results.filter(Boolean).length, 1)
	assert.ok((await adapter.findOne<Record<string, any>>({ model: "oauthRefreshToken", where: [{ field: "token", value: token.token }] }))?.revoked)
})

test("24 code redemptions across three coordinators have one winner and the token stays invisible", async () => {
	const { crateAuthAdapter, migrateAuthTables, localCrateTransport } = await import("./crate-adapter.server.ts")
	const sql = localCrateTransport(["http://127.0.0.1:15548", "http://127.0.0.1:15549", "http://127.0.0.1:15550"])
	await migrateAuthTables(sql)
	const adapter = crateAuthAdapter({ sql })({})
	const token = await adapter.create({ model: "verification", data: {
		identifier: randomUUID(), value: "authorization-code", expiresAt: new Date(Date.now() + 60_000),
	} })
	const where = [{ field: "id", value: token.id }]
	const results = await Promise.all(Array.from({ length: 24 }, () => adapter.consumeOne<Record<string, any>>({ model: "verification", where })))
	assert.equal(results.filter(Boolean).length, 1)
	assert.equal(results.find(Boolean)?.value, "authorization-code")
	assert.equal(await adapter.findOne<Record<string, any>>({ model: "verification", where }), null)
	assert.equal(await adapter.update<Record<string, any>>({ model: "verification", where: [{ field: "identifier", value: token.identifier }], update: { value: "resurrected" } }), null)
	await adapter.deleteMany({ model: "verification", where: [{ field: "identifier", value: token.identifier }] })
	assert.equal(await adapter.consumeOne<Record<string, any>>({ model: "verification", where }), null)
})
