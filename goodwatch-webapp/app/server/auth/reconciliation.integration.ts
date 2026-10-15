import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import Redis from "ioredis"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { reconcileAuthRows } from "./maintenance.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { authTestValkeyPort } from "./store-fixtures.integration.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const adapter = crateAuthAdapter({ sql })({})
const redis = new Redis.Cluster(
	[{ host: "127.0.0.1", port: authTestValkeyPort }],
	{
		natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	},
)
const storage = new ValkeyAuthStorage(() => redis)
after(() => redis.disconnect())

test("reconciliation removes a deleted member's orphan session and its Valkey cache", async () => {
	const member = await adapter.create({
		model: "user",
		data: {
			name: "Member",
			email: `${randomUUID()}@example.test`,
			emailVerified: true,
		},
	})
	const session = await adapter.create({
		model: "session",
		data: {
			userId: member.id,
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 86400000),
		},
	})
	await storage.set(session.token, JSON.stringify({ session, user: member }))
	await adapter.delete({
		model: "user",
		where: [{ field: "id", value: member.id }],
	})
	assert.ok(await storage.get(session.token))
	const report = await reconcileAuthRows({
		sql,
		encryptionSecret,
		storage,
		model: "session",
	})
	assert.equal(report.removed, 1)
	assert.equal(
		await adapter.findOne({
			model: "session",
			where: [{ field: "token", value: session.token }],
		}),
		null,
	)
	assert.equal(await storage.get(session.token), null)
})

test("refresh reconciliation preserves offline grants and only collects failed minting after its grace period", async () => {
	const { authTestOptions } = await import("./fixtures.integration.ts")
	const schema = {
		...authTestOptions,
		plugins: [
			...(authTestOptions.plugins ?? []),
			{
				id: "grant-fixture",
				schema: {
					oauthConsent: {
						fields: {
							grantVersion: { type: "string" as const, required: false },
						},
					},
					oauthRefreshToken: {
						fields: {
							grantVersion: { type: "string" as const, required: false },
						},
					},
				},
			},
		],
	}
	const database = crateAuthAdapter({ sql })(schema)
	const user = await database.create({
		model: "user",
		data: {
			email: `${randomUUID()}@example.test`,
			name: "Member",
			emailVerified: true,
		},
	})
	const clientId = randomUUID()
	const referenceId = randomUUID()
	const grantVersion = randomUUID()
	await database.create({
		model: "oauthClient",
		data: { clientId, name: "App" },
	})
	const consent = await database.create({
		model: "oauthConsent",
		data: {
			clientId,
			userId: user.id,
			referenceId,
			grantVersion,
			scopes: ["mcp:read", "offline_access"],
			resources: ["https://example.test/mcp"],
		},
	})
	const data = {
		clientId,
		userId: user.id,
		sessionId: "browser-already-signed-out",
		referenceId,
		scopes: ["mcp:read", "offline_access"],
		resources: ["https://example.test/mcp"],
		expiresAt: new Date(Date.now() + 86400000),
	}
	const bound = await database.create({
		model: "oauthRefreshToken",
		data: { ...data, grantVersion, token: randomUUID(), createdAt: new Date() },
	})
	const fresh = await database.create({
		model: "oauthRefreshToken",
		data: { ...data, token: randomUUID(), createdAt: new Date() },
	})
	const abandoned = await database.create({
		model: "oauthRefreshToken",
		data: {
			...data,
			token: randomUUID(),
			createdAt: new Date(Date.now() - 3600000),
		},
	})
	assert.equal(
		(
			await reconcileAuthRows({
				sql,
				encryptionSecret,
				model: "oauthRefreshToken",
			})
		).removed,
		1,
	)
	assert.ok(
		await database.findOne({
			model: "oauthRefreshToken",
			where: [{ field: "token", value: bound.token }],
		}),
	)
	assert.ok(
		await database.findOne({
			model: "oauthRefreshToken",
			where: [{ field: "token", value: fresh.token }],
		}),
	)
	assert.equal(
		await database.findOne({
			model: "oauthRefreshToken",
			where: [{ field: "token", value: abandoned.token }],
		}),
		null,
	)
	await database.delete({
		model: "oauthConsent",
		where: [{ field: "id", value: consent.id }],
	})
	assert.equal(
		(
			await reconcileAuthRows({
				sql,
				encryptionSecret,
				model: "oauthRefreshToken",
			})
		).removed,
		2,
	)
})

test("reconciliation collects a late session bound to an obsolete password credential", async () => {
	const { authCredentialVersion } = await import("./payload-codec.server.ts")
	const database = crateAuthAdapter({ sql })({
		session: {
			additionalFields: {
				credentialVersion: { type: "string", required: false },
			},
		},
	})
	const user = await database.create({
		model: "user",
		data: {
			email: `${randomUUID()}@example.test`,
			name: "Member",
			emailVerified: true,
		},
	})
	const account = await database.create({
		model: "account",
		data: {
			providerId: "credential",
			accountId: user.id,
			userId: user.id,
			password: "old password hash",
		},
	})
	const session = await database.create({
		model: "session",
		data: {
			userId: user.id,
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 86400000),
			credentialVersion: authCredentialVersion(
				encryptionSecret,
				"old password hash",
			),
		},
	})
	await storage.set(session.token, JSON.stringify({ session, user }))
	await database.update({
		model: "account",
		where: [{ field: "id", value: account.id }],
		update: { password: "new password hash" },
	})
	assert.equal(
		(
			await reconcileAuthRows({
				sql,
				encryptionSecret,
				storage,
				model: "session",
			})
		).removed,
		1,
	)
	assert.equal(await storage.get(session.token), null)
	assert.equal(
		await database.findOne({
			model: "session",
			where: [{ field: "token", value: session.token }],
		}),
		null,
	)
})

test("unmarked old unconfirmed members retain their address and account", async () => {
	const user = await adapter.create({
		model: "user",
		data: {
			email: `${randomUUID()}@example.test`,
			name: "Unconfirmed",
			emailVerified: false,
			createdAt: new Date(Date.now() - 49 * 3600000),
		},
	})
	await adapter.create({
		model: "account",
		data: {
			userId: user.id,
			providerId: "credential",
			accountId: user.id,
			password: "synthetic",
		},
	})
	await reconcileAuthRows({ sql, encryptionSecret, model: "user" })
	await reconcileAuthRows({ sql, encryptionSecret, model: "account" })
	assert.ok(
		await adapter.findOne({
			model: "user",
			where: [{ field: "id", value: user.id }],
		}),
	)
	assert.equal(
		(
			await adapter.findMany({
				model: "account",
				where: [{ field: "userId", value: user.id }],
			})
		).length,
		1,
	)
	await assert.rejects(
		adapter.create({
			model: "user",
			data: { email: user.email, name: "Retry", emailVerified: false },
		}),
	)
})
