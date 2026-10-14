import { authTestCrateOrigins, authTestValkeyPort } from "./store-fixtures.integration.ts"
import assert from "node:assert/strict"
import { after, test } from "node:test"
import Redis from "ioredis"
import { createGoodwatchAuth } from "./auth.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import { AuthMailQueue } from "./mail.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"

const origin = "http://127.0.0.1:3356"
const resource = `${origin}/mcp`
const sql = localCrateTransport(authTestCrateOrigins)
const redis = new Redis.Cluster([{ host: "127.0.0.1", port: authTestValkeyPort }], {
	natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
	redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
})
const mail = new AuthMailQueue({ sendMail: async () => {} })
const auth = createGoodwatchAuth({
	sql,
	storage: new ValkeyAuthStorage(() => redis),
	mail,
	baseURL: origin,
	secret: "local-mcp-secret-at-least-32-characters",
	google: { clientId: "local", clientSecret: "local" },
	mcp: { resource, accessTokenExpiresIn: 60 },
})
after(() => redis.disconnect())

test("MCP clients discover the canonical resource and issuer with CIMD, DCR and RFC 9207", async () => {
	await migrateAuthTables(sql)
	const response = await auth.handler(
		new Request(`${origin}/.well-known/oauth-protected-resource/mcp`),
	)
	assert.equal(response.status, 200)
	const metadata = await response.json()
	assert.equal(metadata.resource, resource)
	assert.deepEqual(metadata.authorization_servers, [`${origin}/api/auth`])
	assert.deepEqual(metadata.scopes_supported, ["mcp:read", "mcp:write"])
	const issuer = await auth.handler(
		new Request(`${origin}/.well-known/oauth-authorization-server/api/auth`),
	)
	assert.equal(issuer.status, 200)
	const body = await issuer.json()
	assert.equal(body.issuer, `${origin}/api/auth`)
	assert.equal(body.client_id_metadata_document_supported, true)
	assert.equal(body.authorization_response_iss_parameter_supported, true)
	assert.equal(body.registration_endpoint, `${origin}/api/auth/oauth2/register`)
	assert.ok(body.scopes_supported.includes("offline_access"))
})

const deliveries: string[] = []
const capturedMail = new AuthMailQueue({
	sendMail: async (message) => {
		deliveries.push(String(message.text))
	},
})
const memberAuth = createGoodwatchAuth({
	sql,
	storage: new ValkeyAuthStorage(() => redis),
	mail: capturedMail,
	baseURL: origin,
	secret: "local-mcp-secret-at-least-32-characters",
	google: { clientId: "local", clientSecret: "local" },
	mcp: { resource, accessTokenExpiresIn: 60 },
})
const cookies = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ")
async function post(path: string, body: unknown, cookie = "") {
	return memberAuth.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: "POST",
			headers: {
				origin,
				cookie,
				"content-type": "application/json",
				"x-forwarded-for": "127.0.0.1",
			},
			body: JSON.stringify(body),
		}),
	)
}
async function grant(scope = "mcp:read mcp:write offline_access") {
	const email = `mcp-${crypto.randomUUID()}@example.test`
	assert.equal(
		(
			await post("/sign-up/email", {
				email,
				password: "temporary local password",
				name: "Local member",
			})
		).status,
		200,
	)
	await capturedMail.drain()
	const confirmation = deliveries.at(-1)?.match(/http:\/\/\S+/)?.[0]
	assert.ok(confirmation)
	const verified = await memberAuth.handler(new Request(confirmation))
	assert.ok([200, 302].includes(verified.status))
	const cookie = cookies(verified)
	const registration = await post("/oauth2/register", {
		client_name: "Local test app",
		application_type: "native",
		redirect_uris: ["http://127.0.0.1:6280/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "mcp:read mcp:write offline_access",
	})
	assert.equal(registration.status, 201)
	const client = await registration.json()
	const verifier = "a".repeat(64)
	const { createHash } = await import("node:crypto")
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		response_type: "code",
		scope,
		resource,
		state: "local-state",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
	})
	const authorization = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie, accept: "application/json" },
		}),
	)
	assert.equal(authorization.status, 200)
	const consentUrl = new URL((await authorization.json()).url, origin)
	const allowed = await post(
		"/oauth2/consent",
		{ accept: true, oauth_query: consentUrl.search.slice(1) },
		cookie,
	)
	assert.equal(allowed.status, 200)
	const callback = new URL((await allowed.json()).url)
	assert.equal(callback.searchParams.get("iss"), `${origin}/api/auth`)
	const code = callback.searchParams.get("code")
	assert.ok(code)
	const token = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: client.client_id,
				redirect_uri: client.redirect_uris[0],
				code,
				code_verifier: verifier,
				resource,
			}),
		}),
	)
	assert.equal(token.status, 200)
	return {
		email,
		client,
		token: await token.json(),
		cookie,
		consentQuery: consentUrl.search.slice(1),
	}
}

test("a resource-bound Better Auth JWKS token reaches the MCP verifier with its member and client", async () => {
	const issued = await grant()
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		const info = await mcpAuthorization.verifyAccessToken(
			issued.token.access_token,
		)
		assert.equal(info.clientId, issued.client.client_id)
		assert.equal(info.resource?.href, resource)
		assert.ok(info.scopes.includes("mcp:read"))
		const session = await memberAuth.api.getSession({
			headers: new Headers({ cookie: issued.cookie }),
		})
		assert.ok(session)
		assert.equal(info.extra?.userId, session.user.id)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("using a valid MCP grant records Last used in the connected apps API", async () => {
	const issued = await grant()
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		const usedAt = Date.now()
		await mcpAuthorization.verifyAccessToken(issued.token.access_token)
		const response = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/get-consents`, {
				headers: { cookie: issued.cookie },
			}),
		)
		assert.equal(response.status, 200)
		const connected = (await response.json()).find(
			(c: { clientId: string }) => c.clientId === issued.client.client_id,
		)
		assert.ok(
			connected.lastUsedAt,
			"Connected apps must show Last used after a valid request",
		)
		assert.ok(new Date(connected.lastUsedAt).getTime() >= usedAt)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("a signed-in member cannot administer OAuth resources or disable another app", async () => {
	const issued = await grant()
	const response = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/create-client`, {
			method: "POST",
			headers: {
				origin,
				cookie: issued.cookie,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				client_name: "Privileged app",
				redirect_uris: ["https://other.example/callback"],
				skip_consent: true,
			}),
		}),
	)
	assert.equal(response.status, 401)
})

async function refresh(
	issued: Awaited<ReturnType<typeof grant>>,
	token = issued.token.refresh_token,
) {
	return memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				client_id: issued.client.client_id,
				refresh_token: token,
				resource,
			}),
		}),
	)
}

test("disconnecting an app stops its existing JWT and refresh token", async () => {
	const issued = await grant()
	const listed = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/get-consents`, {
			headers: { cookie: issued.cookie },
		}),
	)
	const consent = (await listed.json()).find(
		(c: { clientId: string }) => c.clientId === issued.client.client_id,
	)
	assert.equal(
		(await post("/oauth2/delete-consent", { id: consent.id }, issued.cookie))
			.status,
		200,
	)
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
	const renewed = await refresh(issued)
	assert.equal(renewed.status, 400)
	assert.equal((await renewed.json()).error, "invalid_grant")
})

test("durable signing keys and grants survive a new auth instance and refresh rotates with retry recovery", async () => {
	const issued = await grant()
	const fresh = createGoodwatchAuth({
		sql,
		storage: new ValkeyAuthStorage(() => redis),
		mail: capturedMail,
		baseURL: origin,
		secret: "local-mcp-secret-at-least-32-characters",
		google: { clientId: "local", clientSecret: "local" },
		mcp: { resource, accessTokenExpiresIn: 60 },
	})
	assert.deepEqual(await fresh.api.getJwks(), await memberAuth.api.getJwks())
	const body = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: issued.client.client_id,
		refresh_token: issued.token.refresh_token,
		resource,
	})
	const renew = () =>
		fresh.handler(
			new Request(`${origin}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body,
			}),
		)
	const first = await renew()
	assert.equal(first.status, 200)
	const rotated = await first.json()
	assert.notEqual(rotated.refresh_token, issued.token.refresh_token)
	const retried = await renew()
	assert.equal(retried.status, 200)
	const recovered = await retried.json()
	assert.equal(recovered.refresh_token, rotated.refresh_token)
	assert.equal(recovered.access_token, rotated.access_token)
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(fresh)
	try {
		assert.equal(
			(await mcpAuthorization.verifyAccessToken(rotated.access_token)).clientId,
			issued.client.client_id,
		)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("MCP rejects altered signatures, expired JWTs, wrong resources and the disabled auth flag", async (t) => {
	const issued = await grant()
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		const parts = issued.token.access_token.split(".")
		const signature = Buffer.from(parts[2], "base64url")
		signature[0] ^= 1
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(
				`${parts[0]}.${parts[1]}.${signature.toString("base64url")}`,
			),
		)
		process.env.MCP_RESOURCE_URL = "http://127.0.0.1:3356/other"
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
		process.env.MCP_RESOURCE_URL = resource
		process.env.BETTER_AUTH_ENABLED = "false"
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
		process.env.BETTER_AUTH_ENABLED = "true"
		t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 120000 })
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
	} finally {
		t.mock.timers.reset()
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("reconnecting an app never revives its disconnected tokens", async () => {
	const issued = await grant()
	const listed = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/get-consents`, {
			headers: { cookie: issued.cookie },
		}),
	)
	const consent = (await listed.json()).find(
		(c: { clientId: string }) => c.clientId === issued.client.client_id,
	)
	assert.equal(
		(await post("/oauth2/delete-consent", { id: consent.id }, issued.cookie))
			.status,
		200,
	)
	assert.equal(
		(
			await post(
				"/oauth2/consent",
				{ accept: true, oauth_query: issued.consentQuery },
				issued.cookie,
			)
		).status,
		200,
	)
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
	assert.equal((await refresh(issued)).status, 400)
})

test("the same OAuth client has independent grants and Last used for two computers", async () => {
	const first = await grant()
	const login = await post("/sign-in/email", {
		email: first.email,
		password: "temporary local password",
	})
	assert.equal(login.status, 200)
	const otherCookie = cookies(login)
	const original = new URLSearchParams(first.consentQuery)
	const query = new URLSearchParams()
	for (const field of [
		"client_id",
		"redirect_uri",
		"response_type",
		"scope",
		"resource",
		"state",
		"code_challenge_method",
		"code_challenge",
	]) {
		const value = original.get(field)
		assert.ok(value)
		query.set(field, value)
	}
	const authorization = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie: otherCookie, accept: "application/json" },
		}),
	)
	assert.equal(authorization.status, 200)
	const consentUrl = new URL((await authorization.json()).url, origin)
	const accepted = await post(
		"/oauth2/consent",
		{ accept: true, oauth_query: consentUrl.search.slice(1) },
		otherCookie,
	)
	assert.equal(accepted.status, 200)
	const callback = new URL((await accepted.json()).url)
	const code = callback.searchParams.get("code")
	assert.ok(code)
	const exchanged = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: first.client.client_id,
				redirect_uri: first.client.redirect_uris[0],
				code,
				code_verifier: "a".repeat(64),
				resource,
			}),
		}),
	)
	assert.equal(exchanged.status, 200)
	const second = await exchanged.json()
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await mcpAuthorization.verifyAccessToken(first.token.access_token)
		await mcpAuthorization.verifyAccessToken(second.access_token)
		const response = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/get-consents`, {
				headers: { cookie: otherCookie },
			}),
		)
		const consents = (await response.json()).filter(
			(c: { clientId: string }) => c.clientId === first.client.client_id,
		)
		assert.equal(consents.length, 2)
		assert.ok(consents.every((c: { lastUsedAt?: string }) => c.lastUsedAt))
		assert.notEqual(consents[0].referenceId, consents[1].referenceId)
		const { decodeJwt } = await import("jose")
		const firstId = decodeJwt(first.token.access_token).gw_grant_id
		assert.equal(
			(await post("/oauth2/delete-consent", { id: firstId }, otherCookie))
				.status,
			200,
		)
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(first.token.access_token),
		)
		await mcpAuthorization.verifyAccessToken(second.access_token)
		assert.equal((await refresh(first, second.refresh_token)).status, 200)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("revoking a refresh token disconnects that grant immediately for MCP JWTs as well", async () => {
	const issued = await grant()
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await mcpAuthorization.verifyAccessToken(issued.token.access_token)
		const revoked = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/revoke`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: issued.client.client_id,
					token: issued.token.refresh_token,
					token_type_hint: "refresh_token",
				}),
			}),
		)
		assert.equal(revoked.status, 200)
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("durable signing keys rotate after thirty days and retire only after their verification grace", async (t) => {
	const { decodeProtectedHeader } = await import("jose")
	const { collectAuthGarbage } = await import("./maintenance.server.ts")
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	const issued = await grant()
	const oldKid = decodeProtectedHeader(issued.token.access_token).kid
	t.mock.timers.tick(30 * 86400000 + 1000)
	const refresh = async (token: string) => {
		const response = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: token,
					client_id: issued.client.client_id,
					resource,
				}),
			}),
		)
		assert.equal(response.status, 200)
		return response.json()
	}
	const rotated = await refresh(issued.token.refresh_token)
	const newKid = decodeProtectedHeader(rotated.access_token).kid
	assert.notEqual(newKid, oldKid)
	assert.ok(
		(await memberAuth.api.getJwks()).keys.some((key) => key.kid === oldKid),
	)
	t.mock.timers.tick(86400000 + 1000)
	const collected = await collectAuthGarbage({
		sql,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		model: "jwks",
	})
	assert.ok(collected.expired >= 1)
	const keys = (await memberAuth.api.getJwks()).keys
	assert.equal(
		keys.some((key) => key.kid === oldKid),
		false,
	)
	assert.ok(keys.some((key) => key.kid === newKid))
	await refresh(rotated.refresh_token)
})
