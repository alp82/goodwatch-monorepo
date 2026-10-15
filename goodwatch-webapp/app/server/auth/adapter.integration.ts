import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { authTestOptions } from "./fixtures.integration.ts"
import { crateAuthAdapter, crateAuthTransport, localCrateTransport, migrateAuthTables, IndeterminateAuthWriteError } from "./crate-adapter.server.ts"

const endpoints = ["http://127.0.0.1:15748", "http://127.0.0.1:15749", "http://127.0.0.1:15750"]

test("a new member is immediately readable by id and normalized email without refresh", async () => {
	const { crateAuthAdapter, migrateAuthTables, localCrateTransport } = await import("./crate-adapter.server.ts")
	const sql = localCrateTransport(["http://127.0.0.1:15748"])
	assert.equal((await sql("SELECT count(*) FROM sys.nodes")).rows[0][0], 3)
	await migrateAuthTables(sql)
	const adapter = crateAuthAdapter({ sql })({})
	const member = await adapter.create({ model: "user", data: {
		id: randomUUID(), name: "Member", email: `${randomUUID()}@Example.test`, emailVerified: false,
	}, forceAllowId: true })
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "id", value: member.id }] }))?.name, "Member")
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "user", where: [{ field: "email", value: member.email.toLowerCase() }] }))?.id, member.id)
})

test("every allowlisted model can be created and read through its prescribed lookup key", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })({ ...authTestOptions, rateLimit: { storage: "database" } })
	const id = randomUUID(), now = new Date(), expiresAt = new Date(Date.now() + 60_000)
	const fixtures: Array<{ model: string; data: Record<string, any>; where: Array<{ field: string; value: any }>; many?: boolean }> = [
		{ model: "user", data: { id, name: "Member", email: `${id}@example.test`, emailVerified: true }, where: [{ field: "id", value: id }] },
		{ model: "account", data: { providerId: "credential", accountId: id, userId: id }, where: [{ field: "providerId", value: "credential" }, { field: "accountId", value: id }], many: true },
		{ model: "session", data: { userId: id, token: id, expiresAt }, where: [{ field: "token", value: id }] },
		{ model: "verification", data: { id, identifier: id, value: "verification", expiresAt }, where: [{ field: "id", value: id }] },
		{ model: "jwks", data: { id, publicKey: "public", privateKey: "encrypted-private", createdAt: now }, where: [{ field: "id", value: id }] },
		{ model: "oauthClient", data: { clientId: id, name: "Connector" }, where: [{ field: "clientId", value: id }] },
		{ model: "oauthResource", data: { identifier: id, name: "MCP" }, where: [{ field: "identifier", value: id }] },
		{ model: "oauthClientResource", data: { clientId: id, resourceId: id, createdAt: now }, where: [{ field: "clientId", value: id }, { field: "resourceId", value: id }] },
		{ model: "oauthConsent", data: { clientId: id, userId: id, scopes: ["read"] }, where: [{ field: "clientId", value: id }, { field: "userId", value: id }] },
		{ model: "oauthAccessToken", data: { token: id, clientId: id, userId: id, expiresAt }, where: [{ field: "token", value: id }] },
		{ model: "oauthRefreshToken", data: { token: id, clientId: id, userId: id, expiresAt }, where: [{ field: "token", value: id }] },
		{ model: "oauthClientAssertion", data: { id, expiresAt }, where: [{ field: "id", value: id }] },
		{ model: "rateLimit", data: { key: id, count: 1, lastRequest: Date.now() }, where: [{ field: "key", value: id }], many: true },
	]
	for (const { model, data, where, many } of fixtures) {
		const created = await adapter.create({ model, data, forceAllowId: true })
		const found = many ? (await adapter.findMany<Record<string, any>>({ model, where, limit: 2 }))[0] : await adapter.findOne<Record<string, any>>({ model, where })
		assert.equal(found?.id, created.id, model)
	}
})

test("a zero-row insert acknowledgement cannot claim an identity owned by a different caller", async () => {
	const transport = localCrateTransport(endpoints)
	const healthy = crateAuthAdapter({ sql: transport })({})
	const data = { providerId: "google", accountId: randomUUID(), userId: "original-owner" }
	const account = await healthy.create({ model: "account", data })
	const sql = (statement: string, args?: unknown[]) => transport(
		statement.startsWith("INSERT INTO doc.auth_account ") ? `${statement} ON CONFLICT DO NOTHING` : statement, args,
	)
	const contender = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })({})
	await assert.rejects(contender.create({ model: "account", data: { ...data, userId: "another-owner" } }), /indeterminate|duplicate key/)
	assert.equal((await healthy.findMany<Record<string, any>>({ model: "account", where: [{ field: "providerId", value: "google" }, { field: "accountId", value: account.accountId }], limit: 2 }))[0].userId, "original-owner")
})

test("consumption recovery survives identifier cleanup and invalidates older verification rows", async () => {
	const transport = localCrateTransport(endpoints)
	const healthy = crateAuthAdapter({ sql: transport })({})
	const identifier = randomUUID()
	for (const [value, createdAt] of [["obsolete", new Date(Date.now() - 10000)], ["redeem", new Date()]] as const) await healthy.create({
		model: "verification", data: { identifier, value, createdAt, expiresAt: new Date(Date.now() + 60_000) },
	})
	const latest = (await healthy.findMany<Record<string, any>>({ model: "verification", where: [{ field: "identifier", value: identifier }], sortBy: { field: "createdAt", direction: "desc" }, limit: 1 }))[0]
	const sql = async (statement: string, args?: unknown[]) => {
		const result = await transport(statement, args)
		if (statement.startsWith("UPDATE doc.auth_verification ")) {
			await healthy.deleteMany({ model: "verification", where: [{ field: "identifier", value: identifier }] })
			return { ...result, rowcount: 0 }
		}
		return result
	}
	const consumer = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })({})
	assert.equal((await consumer.consumeOne<Record<string, any>>({ model: "verification", where: [{ field: "id", value: latest.id }] }))?.value, "redeem")
	assert.deepEqual(await healthy.findMany({ model: "verification", where: [{ field: "identifier", value: identifier }] }), [])
})

test("increment recovery returns its own outcome even after a later writer changes the row", async () => {
	const transport = localCrateTransport(endpoints)
	const options = { ...authTestOptions, rateLimit: { storage: "database" as const } }
	const healthy = crateAuthAdapter({ sql: transport })(options)
	const row = await healthy.create({ model: "rateLimit", data: { key: randomUUID(), count: 0, lastRequest: Date.now() } })
	const where = [{ field: "key", value: row.key }, { field: "lastRequest", operator: "gt" as const, value: 0 }, { field: "count", operator: "lt" as const, value: 100 }]
	const sql = async (statement: string, args?: unknown[]) => {
		const result = await transport(statement, args)
		if (statement.startsWith("UPDATE doc.auth_rate_limit ")) {
			assert.equal((await healthy.incrementOne<Record<string, any>>({ model: "rateLimit", where, increment: { count: 1 }, set: { lastRequest: Date.now() } }))?.count, 2)
			return { ...result, rowcount: 0 }
		}
		return result
	}
	const original = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })(options)
	assert.equal((await original.incrementOne<Record<string, any>>({ model: "rateLimit", where, increment: { count: 1 }, set: { lastRequest: Date.now() } }))?.count, 1)
	assert.equal((await healthy.findMany<Record<string, any>>({ model: "rateLimit", where: [{ field: "key", value: row.key }] }))[0].count, 2)
})

test("a create without its natural lookup key is refused instead of claiming an undefined key", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })(authTestOptions)
	await assert.rejects(adapter.create({ model: "session", data: { userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } }), /Unsupported auth shape/)
	await assert.rejects(adapter.create({ model: "oauthClient", data: { name: "Missing client id" } }), /Unsupported auth shape/)
})

test("a consent lookup without referenceId refuses ambiguous reference scopes", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })(authTestOptions)
	const base = { clientId: randomUUID(), userId: randomUUID(), scopes: ["read"] }
	await adapter.create({ model: "oauthConsent", data: { ...base, referenceId: "one" } })
	await adapter.create({ model: "oauthConsent", data: { ...base, referenceId: "two" } })
	const where = [{ field: "clientId", value: base.clientId }, { field: "userId", value: base.userId }]
	await assert.rejects(adapter.findOne({ model: "oauthConsent", where }), /Ambiguous auth lookup/)
	assert.equal((await adapter.findOne<Record<string, any>>({ model: "oauthConsent", where: [...where, { field: "referenceId", value: "two" }] }))?.referenceId, "two")
})

test("an unlinked Google account and withdrawn consent can be created again without retaining the old owner's fields", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })(authTestOptions)
	const account = await adapter.create({ model: "account", data: { providerId: "google", accountId: randomUUID(), userId: "previous-owner", accessToken: "old-google-token" } })
	await adapter.delete({ model: "account", where: [{ field: "id", value: account.id }] })
	const linked = await adapter.create({ model: "account", data: { providerId: "google", accountId: account.accountId, userId: "current-owner" } })
	assert.equal(linked.id, account.id)
	assert.equal(linked.userId, "current-owner")
	assert.equal((linked as Record<string, any>).accessToken, undefined)
	const data = { clientId: randomUUID(), userId: randomUUID(), scopes: ["read"] }
	const consent = await adapter.create({ model: "oauthConsent", data })
	await adapter.delete({ model: "oauthConsent", where: [{ field: "id", value: consent.id }] })
	assert.equal((await adapter.create({ model: "oauthConsent", data })).id, consent.id)
})

test("a concurrent session refresh is retried until bulk revocation completes", async () => {
	const transport = localCrateTransport(endpoints)
	const healthy = crateAuthAdapter({ sql: transport })({})
	const session = await healthy.create({ model: "session", data: { token: randomUUID(), userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	let racing = true
	const sql = async (statement: string, args?: unknown[]) => {
		if (racing && statement.startsWith("UPDATE doc.auth_session ")) {
			racing = false
			await healthy.update({ model: "session", where: [{ field: "token", value: session.token }], update: { expiresAt: new Date(Date.now() + 120_000) } })
		}
		return transport(statement, args)
	}
	const revoker = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })({})
	assert.equal(await revoker.deleteMany({ model: "session", where: [{ field: "userId", value: session.userId }] }), 1)
	assert.equal(await healthy.findOne({ model: "session", where: [{ field: "token", value: session.token }] }), null)
})

test("a failed coordinator can be skipped for reads, and a pre-connection write failure can try another node", async () => {
	const secret = "disposable-local-auth-integration-key-548"
	const healthy = crateAuthAdapter({ sql: localCrateTransport(endpoints) })({})
	const session = await healthy.create({ model: "session", data: { token: randomUUID(), userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	const reader = crateAuthAdapter({ sql: crateAuthTransport(["http://127.0.0.1:49999", endpoints[0]]), encryptionSecret: secret })({})
	assert.equal((await reader.findOne<Record<string, any>>({ model: "session", where: [{ field: "token", value: session.token }] }))?.id, session.id)
	const writer = crateAuthAdapter({ sql: crateAuthTransport(["http://127.0.0.1:49999", endpoints[0]]), encryptionSecret: secret })({})
	const token = randomUUID()
	await writer.create({ model: "session", data: { token, userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	assert.ok(await healthy.findOne({ model: "session", where: [{ field: "token", value: token }] }))
})

test("auth rows can be recovered with their payload secret and cannot be read with another secret", async () => {
	const sql = localCrateTransport(endpoints)
	const correct = crateAuthAdapter({ sql, encryptionSecret: "correct-payload-secret-for-integration-548" })({})
	const wrong = crateAuthAdapter({ sql, encryptionSecret: "different-payload-secret-for-integration-548" })({})
	const session = await correct.create({ model: "session", data: { token: randomUUID(), userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	const where = [{ field: "token", value: session.token }]
	assert.equal((await correct.findOne<Record<string, any>>({ model: "session", where }))?.token, session.token)
	await assert.rejects(wrong.findOne({ model: "session", where }), /decrypt|authenticate/i)
	await correct.delete({ model: "session", where })
})

test("the default 100-row limit cannot silently truncate a session sweep, and explicit pagination is preserved", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })({})
	const userId = randomUUID()
	await Promise.all(Array.from({ length: 101 }, () => adapter.create({ model: "session", data: {
		userId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000),
	} })))
	const where = [{ field: "userId", value: userId }]
	assert.equal((await adapter.findMany({ model: "session", where })).length, 101)
	const first = await adapter.findMany<Record<string, any>>({ model: "session", where, limit: 50 })
	const second = await adapter.findMany<Record<string, any>>({ model: "session", where, limit: 51, offset: 50 })
	assert.equal(new Set([...first, ...second].map(row => row.id)).size, 101)
	assert.equal(await adapter.deleteMany({ model: "session", where }), 101)
	assert.deepEqual(await adapter.findMany({ model: "session", where }), [])
})

test("unlisted ownership changes, rotation values and sort options are refused", async () => {
	const adapter = crateAuthAdapter({ sql: localCrateTransport(endpoints) })(authTestOptions)
	const session = await adapter.create({ model: "session", data: { userId: randomUUID(), token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	await assert.rejects(adapter.update({ model: "session", where: [{ field: "token", value: session.token }], update: { userId: "another-member" } }), /Unsupported auth shape/)
	const refresh = await adapter.create({ model: "oauthRefreshToken", data: { token: randomUUID(), clientId: "client", userId: "member", revoked: null } })
	await assert.rejects(adapter.incrementOne({ model: "oauthRefreshToken", where: [{ field: "id", value: refresh.id }, { field: "revoked", value: null }], increment: {}, set: { revoked: null } }), /Unsupported auth shape/)
	await assert.rejects(adapter.findMany({ model: "oauthRefreshToken", where: [{ field: "clientId", value: "client" }, { field: "userId", value: "member" }], sortBy: { field: "revoked", direction: "asc" } }), /Unsupported auth shape/)
})

test("enumeration bounds apply to the member's records and fail closed when that member exceeds them", async () => {
	const sql = localCrateTransport(endpoints)
	const member = randomUUID()
	const adapter = crateAuthAdapter({ sql })({})
	for (const userId of [member, member, member, randomUUID(), randomUUID()]) await adapter.create({
		model: "session", data: { token: randomUUID(), userId, expiresAt: new Date(Date.now() + 60_000) },
	})
	const bounded = crateAuthAdapter({ sql, maxEnumeration: 2 })({})
	await assert.rejects(bounded.findMany({ model: "session", where: [{ field: "userId", value: member }] }), /enumeration exceeds safe bound/)
	const one = await adapter.create({ model: "session", data: { token: randomUUID(), userId: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
	assert.equal((await bounded.findMany({ model: "session", where: [{ field: "userId", value: one.userId }] })).length, 1)
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
		session: { findOne: ["token", "id"], update: ["token"], findMany: ["userId", "userId+expiresAt:gt", "token+expiresAt:gt", "token:in+expiresAt:gt"], delete: ["token"], deleteMany: ["userId", "token:in"], updateMany: ["token+expiresAt:gt", "userId+expiresAt:gt", "token:in+expiresAt:gt"] },
		verification: { findOne: ["id"], findMany: ["identifier"], update: ["identifier"], consumeOne: ["id"], deleteMany: ["identifier"] },
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
		const update = model === "oauthRefreshToken" ? action === "update" ? { rotationReplayResponse: "encrypted-response" } : { revoked: new Date() }
			: model === "oauthAccessToken" ? { revoked: new Date() } : model === "account" ? { password: "password-hash" }
			: model === "session" ? { expiresAt: new Date() } : model === "verification" ? { value: "updated" }
			: model === "oauthConsent" ? { scopes: ["read"] } : { name: "updated" }
		const rateIncrement = model === "rateLimit" && shape.includes("count:lt")
		const params = { model, where, update, increment: rateIncrement ? { count: 1 } : {}, set: model === "rateLimit" ? rateIncrement ? { lastRequest: 1 } : { count: 1, lastRequest: 1 } : { revoked: new Date() } }
		await (adapter as any)[action](params)
		if (action === "delete" || action === "deleteMany") await adapter.findMany<Record<string, any>>({ model, where: where as any, limit: action === "delete" ? 1 : 100 })
	}
	for (const model of Object.keys(inventory)) {
		await assert.rejects(adapter.findMany<Record<string, any>>({ model, where: [{ field: "id", value: "x", operator: "contains" }] }), /Unsupported auth shape/)
	}
	for (const action of ["findMany", "deleteMany"] as const)
		await assert.rejects(adapter[action]({ model: "verification", where: [{ field: "expiresAt", operator: "lt", value: new Date() }] }), /Unsupported auth shape/)

	await assert.rejects(adapter.findMany<Record<string, any>>({ model: "user", where: [] }), /Unsupported auth shape/)
	await assert.rejects(adapter.count({ model: "user" }), /Unsupported auth shape/)
})

test("an unlisted OR query throws before reading any auth record", async () => {
	const { crateAuthAdapter, localCrateTransport } = await import("./crate-adapter.server.ts")
	const adapter = crateAuthAdapter({ sql: localCrateTransport(["http://127.0.0.1:15748"]) })({})
	await assert.rejects(adapter.findOne<Record<string, any>>({ model: "user", where: [
		{ field: "id", value: "missing", connector: "OR" },
	] }), /Unsupported auth shape/)
})

test("refresh rotation including empty increments races revocation with exactly one winner", async () => {
	const { crateAuthAdapter, migrateAuthTables, localCrateTransport } = await import("./crate-adapter.server.ts")
	const sql = localCrateTransport(["http://127.0.0.1:15748", "http://127.0.0.1:15749", "http://127.0.0.1:15750"])
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
	const sql = localCrateTransport(["http://127.0.0.1:15748", "http://127.0.0.1:15749", "http://127.0.0.1:15750"])
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
