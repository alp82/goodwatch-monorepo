import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { authTestOptions } from "./fixtures.integration.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
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
const healthy = crateAuthAdapter({ sql })(schema)

test("refresh revocation fences its grant before a child can escape the captured sweep", async () => {
	const clientId = randomUUID()
	const userId = randomUUID()
	const referenceId = randomUUID()
	const grantVersion = randomUUID()
	const consent = await healthy.create({
		model: "oauthConsent",
		data: { clientId, userId, referenceId, grantVersion, scopes: ["mcp:read"] },
	})
	const data = {
		clientId,
		userId,
		referenceId,
		grantVersion,
		authorizationCodeId: randomUUID(),
		expiresAt: new Date(Date.now() + 86400000),
		scopes: ["mcp:read"],
	}
	const parent = await healthy.create({
		model: "oauthRefreshToken",
		data: { ...data, token: randomUUID() },
	})
	let child: { id: string } | undefined
	const revoker = crateAuthAdapter({
		encryptionSecret,
		enforceGrantRevocation: true,
		sql: async (statement, args) => {
			if (
				!child &&
				statement.startsWith("UPDATE doc.auth_oauth_refresh_token SET payload=")
			) {
				child = await healthy.create({
					model: "oauthRefreshToken",
					data: { ...data, token: randomUUID() },
				})
			}
			return sql(statement, args)
		},
	})(schema)
	await revoker.updateMany({
		model: "oauthRefreshToken",
		where: [{ field: "id", operator: "in", value: [parent.id] }],
		update: { revoked: new Date() },
	})
	assert.ok(child, "The child must really be issued after sweep capture")
	assert.equal(
		await healthy.findOne({
			model: "oauthConsent",
			where: [{ field: "id", value: consent.id }],
		}),
		null,
	)
})

test("a refresh-family sweep closes its grant even when no token was present in the captured set", async () => {
	const clientId = randomUUID(),
		userId = randomUUID(),
		referenceId = randomUUID(),
		grantVersion = randomUUID()
	const consent = await healthy.create({
		model: "oauthConsent",
		data: { clientId, userId, referenceId, grantVersion, scopes: ["mcp:read"] },
	})
	const revoker = crateAuthAdapter({ sql, enforceGrantRevocation: true })(
		schema,
	)
	await revoker.deleteMany({
		model: "oauthRefreshToken",
		where: [
			{ field: "clientId", value: clientId },
			{ field: "userId", value: userId },
		],
	})
	assert.equal(
		await healthy.findOne({
			model: "oauthConsent",
			where: [{ field: "id", value: consent.id }],
		}),
		null,
	)
})
