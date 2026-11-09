import assert from "node:assert/strict"
import { test } from "node:test"
import { ensureYepWatchClient } from "./yepwatch-client.server.ts"

const config = {
	clientId: "yepwatch-public",
	resource: "https://yepwatch.example/api/yepwatch",
	redirectUris: ["https://yepwatch.example/api/yepwatch/v1/proposal/member/callback"],
}
type Row = Record<string, unknown>
type Where = { field: string; value: unknown }[]

/** The first live registration: read scope only, before renewable sign-in. */
function issuer(client: Row = {}) {
	const rows: Record<string, Row[]> = {
		oauthClient: [{
			clientId: config.clientId,
			tokenEndpointAuthMethod: "none",
			redirectUris: config.redirectUris,
			scopes: ["yepwatch:read"],
			grantTypes: ["authorization_code"],
			responseTypes: ["code"],
			requirePKCE: true,
			skipConsent: false,
			disabled: false,
			...client,
		}],
		oauthResource: [{ id: config.resource, identifier: config.resource, allowedScopes: ["yepwatch:read"], disabled: false }],
		oauthClientResource: [{ clientId: config.clientId, resourceId: config.resource }],
	}
	const writes: string[] = []
	const match = (where: Where) => (row: Row) => where.every((w) => row[w.field] === w.value)
	const adapter = {
		async findOne({ model, where }: { model: string; where: Where }) {
			return rows[model]?.find(match(where)) ?? null
		},
		async update({ model, where, update }: { model: string; where: Where; update: Row }) {
			const row = rows[model]?.find(match(where))
			if (!row) return null
			writes.push(`${model}:${Object.keys(update).sort().join(",")}`)
			return Object.assign(row, update)
		},
		async create({ model, data }: { model: string; data: Row }) {
			writes.push(`${model}:create`)
			;(rows[model] ??= []).push(data)
			return data
		},
	}
	// biome-ignore lint/suspicious/noExplicitAny: a minimal stand-in for the auth context.
	return { auth: { $context: Promise.resolve({ adapter }) } as any, rows, writes }
}

test("check reports the read-only registration as not ready for renewal and writes nothing", async () => {
	const { auth, writes } = issuer()
	const report = await ensureYepWatchClient(auth, config)
	assert.equal(report.ready, false)
	assert.equal(report.offlineAccess, false)
	assert.deepEqual(writes, [])
})

test("apply adds offline_access to the client and the resource, and nothing else", async () => {
	const { auth, rows, writes } = issuer()
	const report = await ensureYepWatchClient(auth, config, true)
	assert.equal(report.ready, true)
	assert.equal(report.offlineAccess, true)
	assert.deepEqual(rows.oauthClient[0].scopes, ["yepwatch:read", "offline_access"])
	assert.deepEqual(rows.oauthResource[0].allowedScopes, ["yepwatch:read", "offline_access"])
	assert.deepEqual(writes, ["oauthClient:scopes,updatedAt", "oauthResource:allowedScopes,updatedAt"])
	// A second run finds nothing left to change.
	assert.equal((await ensureYepWatchClient(auth, config, true)).ready, true)
	assert.equal(writes.length, 2)
})

test("a registration that differs in anything else is still refused", async () => {
	const { auth, writes } = issuer({ skipConsent: true })
	await assert.rejects(ensureYepWatchClient(auth, config, true), /refusing to change live registration/)
	assert.deepEqual(writes, [])
})
