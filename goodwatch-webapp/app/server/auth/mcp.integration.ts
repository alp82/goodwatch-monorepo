import assert from "node:assert/strict"
import { after, test } from "node:test"
import Redis from "ioredis"
import { createGoodwatchAuth } from "./auth.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import { AuthMailQueue } from "./mail.server.ts"
import { decideMcpConsent, loadMcpConsent } from "./mcp-flow.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import {
	authTestCrateOrigins,
	authTestValkeyPort,
} from "./store-fixtures.integration.ts"

const origin = "http://127.0.0.1:3356"
const resource = `${origin}/mcp`
const sql = localCrateTransport(authTestCrateOrigins)
const redis = new Redis.Cluster(
	[{ host: "127.0.0.1", port: authTestValkeyPort }],
	{
		natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	},
)
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
	for (const path of [
		"/.well-known/oauth-authorization-server/api/auth",
		"/api/auth/.well-known/oauth-authorization-server",
		"/.well-known/openid-configuration/api/auth",
		"/api/auth/.well-known/openid-configuration",
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
	]) {
		const response = await auth.handler(new Request(`${origin}${path}`))
		assert.equal(response.status, 200, path)
		const metadata = await response.json()
		assert.equal(metadata.dpop_signing_alg_values_supported, undefined, path)
		assert.equal(metadata.dpop_bound_access_tokens_required, undefined, path)
		if (metadata.resource) {
			assert.equal(metadata.resource_name, "GoodWatch")
			assert.equal(
				metadata.logo_uri,
				"https://goodwatch.app/mcp-icons/goodwatch-512.png",
			)
		} else {
			assert.equal(metadata.client_id_metadata_document_supported, true, path)
			assert.equal(
				metadata.registration_endpoint,
				`${origin}/api/auth/oauth2/register`,
				path,
			)
		}
	}
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
async function grant(
	scope = "mcp:read mcp:write offline_access",
	existing?: { email: string; cookie: string },
	access?: "read" | "write" | "default",
	tokenHeaders: Record<string, string> = {},
	tokenStatus = 200,
) {
	let cookie = existing?.cookie ?? ""
	const email = existing?.email ?? `mcp-${crypto.randomUUID()}@example.test`
	if (!existing) {
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
		cookie = cookies(verified)
	}
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
	let callback: URL
	if (access) {
		const view = await loadMcpConsent(
			new Request(consentUrl, { headers: { cookie } }),
			memberAuth,
		)
		assert.ok(!(view instanceof Response))
		assert.equal(view.canChange, scope.split(" ").includes("mcp:write"))
		const consent = (choice: string) =>
			decideMcpConsent(
				new Request(consentUrl, {
					method: "POST",
					headers: { cookie, origin },
					body: new URLSearchParams({
						decision: "allow",
						...(choice === "default" ? {} : { access: choice }),
					}),
				}),
				memberAuth,
			)
		assert.equal((await consent("invalid")).status, 400)
		if (!view.canChange) assert.equal((await consent("write")).status, 400)
		const allowed = await consent(access)
		assert.equal(allowed.status, 302, await allowed.clone().text())
		const location = allowed.headers.get("Location")
		assert.ok(location)
		callback = new URL(location)
	} else {
		const allowed = await post(
			"/oauth2/consent",
			{ accept: true, oauth_query: consentUrl.search.slice(1) },
			cookie,
		)
		assert.equal(allowed.status, 200)
		callback = new URL((await allowed.json()).url)
	}
	assert.equal(callback.searchParams.get("iss"), `${origin}/api/auth`)
	const code = callback.searchParams.get("code")
	assert.ok(code)
	const token = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				...tokenHeaders,
			},
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
	assert.equal(token.status, tokenStatus, await token.clone().text())
	return {
		email,
		client,
		token: await token.json(),
		cookie,
		consentQuery: consentUrl.search.slice(1),
	}
}

test("consent choices bind issued and refreshed scopes, and cannot elevate a read-only request", async () => {
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	const { setAuthForTest } = await import("./runtime.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		for (const [requested, access, writes] of [
			["mcp:read mcp:write offline_access", "read", false],
			["mcp:read mcp:write offline_access", "default", false],
			["mcp:read mcp:write offline_access", "write", true],
			["mcp:read offline_access", "read", false],
		] as const) {
			const issued = await grant(requested, undefined, access)
			const verify = (token: string) =>
				mcpAuthorization.verifyAccessToken(token)
			const info = await verify(issued.token.access_token)
			assert.equal(info.scopes.includes("mcp:write"), writes)
			assert.ok(info.scopes.includes("mcp:read"))
			const rotated = await memberAuth.handler(
				new Request(`${origin}/api/auth/oauth2/token`, {
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						grant_type: "refresh_token",
						client_id: issued.client.client_id,
						refresh_token: issued.token.refresh_token,
						resource,
					}),
				}),
			)
			assert.equal(rotated.status, 200, await rotated.clone().text())
			assert.equal(
				(await verify((await rotated.json()).access_token)).scopes.includes(
					"mcp:write",
				),
				writes,
			)
		}
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("signed OAuth email sign-in keeps its tokenless consent redirect and a valid session", async () => {
	const issued = await grant()
	const registration = await post("/oauth2/register", {
		client_name: "Signed login regression",
		application_type: "native",
		redirect_uris: ["http://127.0.0.1:6280/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "mcp:read mcp:write offline_access",
	})
	assert.equal(registration.status, 201)
	const client = await registration.json()
	const { createHash } = await import("node:crypto")
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		response_type: "code",
		scope: "mcp:read mcp:write offline_access",
		resource,
		state: "signed-login-regression",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256")
			.update("a".repeat(64))
			.digest("base64url"),
	})
	const authorization = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { accept: "application/json" },
		}),
	)
	assert.equal(authorization.status, 200)
	const login = new URL((await authorization.json()).url, origin)
	const response = await post("/sign-in/email", {
		email: issued.email,
		password: "temporary local password",
		oauth_query: login.search.slice(1),
	})
	assert.equal(response.status, 200, await response.clone().text())
	const continuation = await response.json()
	assert.equal(continuation.redirect, true)
	assert.equal(continuation.token, undefined)
	assert.equal(new URL(continuation.url, origin).pathname, "/auth/mcp/consent")
	const session = await memberAuth.api.getSession({
		headers: new Headers({ cookie: cookies(response) }),
	})
	assert.equal(session?.user.email, issued.email)
})

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

test("a different OAuth client cannot revoke a member's grant through a rotated token", async () => {
	const issued = await grant()
	const other = await grant(undefined, issued)
	const rotated = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: issued.token.refresh_token,
				client_id: issued.client.client_id,
				resource,
			}),
		}),
	)
	assert.equal(rotated.status, 200)
	await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/revoke`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				token: issued.token.refresh_token,
				token_type_hint: "refresh_token",
				client_id: other.client.client_id,
			}),
		}),
	)
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await mcpAuthorization.verifyAccessToken(other.token.access_token)
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("collected refresh rotation parents release live capacity while preserving replay revocation", async (t) => {
	const { createHash } = await import("node:crypto")
	const { collectAuthGarbage } = await import("./maintenance.server.ts")
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	const issued = await grant()
	const refresh = (token: string) =>
		memberAuth.handler(
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
	const rotation = await refresh(issued.token.refresh_token)
	assert.equal(rotation.status, 200)
	const child = await rotation.json()
	t.mock.timers.tick(31000)
	await collectAuthGarbage({
		sql,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		model: "oauthRefreshToken",
	})
	const context = await memberAuth.$context
	const parentHash = createHash("sha256")
		.update(issued.token.refresh_token)
		.digest("base64url")
	const parent = await context.adapter.findOne<{
		rotatedAt: Date
		rotationReplayExpiresAt: Date
	}>({
		model: "oauthRefreshToken",
		where: [{ field: "token", value: parentHash }],
	})
	assert.ok(parent)
	assert.equal(
		new Date(parent.rotationReplayExpiresAt).getTime() -
			new Date(parent.rotatedAt).getTime(),
		30000,
	)
	const currentMember = await memberAuth.api.getSession({
		headers: new Headers({ cookie: issued.cookie }),
	})
	assert.ok(currentMember)
	const active = await context.adapter.findMany<{ token: string }>({
		model: "oauthRefreshToken",
		where: [
			{ field: "clientId", value: issued.client.client_id },
			{
				field: "userId",
				value: currentMember.user.id,
			},
		],
	})
	assert.equal(
		active.some((row) => row.token === parentHash),
		false,
	)
	const { reconcileAuthCapacity } = await import("./maintenance.server.ts")
	assert.equal(
		(
			await reconcileAuthCapacity({
				sql,
				encryptionSecret: "disposable-local-auth-integration-key-548",
			})
		).released,
		0,
	)
	const { setAuthForTest } = await import("./runtime.server.ts")
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		await mcpAuthorization.verifyAccessToken(child.access_token)
		assert.equal((await refresh(issued.token.refresh_token)).status, 400)
		await assert.rejects(mcpAuthorization.verifyAccessToken(child.access_token))
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("a refresh paused before signing cannot adopt a reconnected grant version", async () => {
	const issued = await grant()
	const { decodeJwt } = await import("jose")
	const payload = decodeJwt(issued.token.access_token)
	const context = await memberAuth.$context
	const original = await context.adapter.findOne<Record<string, unknown>>({
		model: "oauthConsent",
		where: [{ field: "id", value: String(payload.gw_grant_id) }],
	})
	assert.ok(original)
	let reads = 0
	let reconnected = false
	const delayed = createGoodwatchAuth({
		sql: async (statement, args) => {
			if (
				statement.startsWith(
					"SELECT payload,_seq_no,_primary_term,deleted,receipts FROM doc.auth_oauth_consent WHERE id = ?",
				) &&
				args?.[0] === original.id &&
				++reads === 2
			) {
				reconnected = true
				await context.adapter.update({
					model: "oauthConsent",
					where: [{ field: "id", value: String(original.id) }],
					update: { grantVersion: crypto.randomUUID() },
				})
			}
			return sql(statement, args)
		},
		encryptionSecret: "disposable-local-auth-integration-key-548",
		storage: new ValkeyAuthStorage(() => redis),
		mail: capturedMail,
		baseURL: origin,
		secret: "local-mcp-secret-at-least-32-characters",
		google: { clientId: "local", clientSecret: "local" },
		mcp: { resource, accessTokenExpiresIn: 60 },
	})
	const response = await delayed.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: issued.token.refresh_token,
				client_id: issued.client.client_id,
				resource,
			}),
		}),
	)
	assert.ok(reconnected)
	assert.ok(
		[400, 503].includes(response.status),
		`Old refresh must not become a new grant (status ${response.status})`,
	)
})

async function authorizeAgain(
	issued: Awaited<ReturnType<typeof grant>>,
	scope: string,
	extra: Record<string, string> = {},
) {
	const { createHash } = await import("node:crypto")
	const query = new URLSearchParams({
		client_id: issued.client.client_id,
		redirect_uri: issued.client.redirect_uris[0],
		response_type: "code",
		scope,
		resource,
		state: "local-state",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256")
			.update("b".repeat(64))
			.digest("base64url"),
		...extra,
	})
	const response = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie: issued.cookie, accept: "application/json" },
		}),
	)
	return new URL((await response.json()).url, origin)
}

test("a read-only consent is not upgraded to write by re-authorization, prompt=none or refresh", async () => {
	const issued = await grant(
		"mcp:read mcp:write offline_access",
		undefined,
		"read",
	)
	// Same client, same session, asks for write again: must show the consent page.
	const again = await authorizeAgain(
		issued,
		"mcp:read mcp:write offline_access",
	)
	assert.equal(again.pathname, "/auth/mcp/consent", again.href)
	assert.equal(again.searchParams.get("code"), null)
	// prompt=none must not mint a code either.
	const silent = await authorizeAgain(
		issued,
		"mcp:read mcp:write offline_access",
		{ prompt: "none" },
	)
	assert.equal(silent.searchParams.get("code"), null, silent.href)
	assert.equal(
		silent.searchParams.get("error"),
		"consent_required",
		silent.href,
	)
	// Same read scope is silent (consent covers it).
	const read = await authorizeAgain(issued, "mcp:read offline_access")
	assert.ok(read.searchParams.get("code"), read.href)
	// Refresh cannot widen.
	const widened = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				client_id: issued.client.client_id,
				refresh_token: issued.token.refresh_token,
				scope: "mcp:read mcp:write offline_access",
				resource,
			}),
		}),
	)
	assert.equal(widened.status, 400, await widened.clone().text())
})

test("consent refuses scopes the app did not request and a tampered signed query", async () => {
	const issued = await grant("mcp:read offline_access", undefined, "read")
	const consentUrl = await authorizeAgain(issued, "mcp:read offline_access", {
		prompt: "consent",
	})
	assert.equal(consentUrl.pathname, "/auth/mcp/consent", consentUrl.href)
	const widened = await post(
		"/oauth2/consent",
		{
			accept: true,
			oauth_query: consentUrl.search.slice(1),
			scope: "mcp:read mcp:write offline_access",
		},
		issued.cookie,
	)
	assert.equal(widened.status, 400, await widened.clone().text())
	// A tampered signed query (scope edited to add write) fails the signature.
	const tampered = new URL(consentUrl)
	tampered.searchParams.set("scope", "mcp:read mcp:write offline_access")
	const view = await loadMcpConsent(
		new Request(tampered, { headers: { cookie: issued.cookie } }),
		memberAuth,
	)
	assert.ok(view instanceof Response && view.status === 400)
})

test("both consent endpoints refuse a missing, null or foreign Origin", async () => {
	const issued = await grant(
		"mcp:read mcp:write offline_access",
		undefined,
		"read",
	)
	const consentUrl = await authorizeAgain(
		issued,
		"mcp:read mcp:write offline_access",
	)
	for (const headers of [
		{ cookie: issued.cookie } as Record<string, string>,
		{ cookie: issued.cookie, origin: "https://evil.example" },
		{ cookie: issued.cookie, origin: "null" },
	]) {
		const answer = await decideMcpConsent(
			new Request(consentUrl, {
				method: "POST",
				headers,
				body: new URLSearchParams({ decision: "allow", access: "write" }),
			}),
			memberAuth,
		)
		assert.equal(answer.status, 403, JSON.stringify(headers))
	}
	// Direct provider endpoint, cross-site Origin. Better Auth skips its origin check under NODE_ENV=test; restore
	// production behavior for this check.
	const context = (await memberAuth.$context) as { skipOriginCheck: unknown }
	const skipped = context.skipOriginCheck
	context.skipOriginCheck = false
	try {
		const direct = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/consent`, {
				method: "POST",
				headers: {
					origin: "https://evil.example",
					cookie: issued.cookie,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					accept: true,
					oauth_query: consentUrl.search.slice(1),
				}),
			}),
		)
		assert.equal(direct.status, 403, await direct.clone().text())
		const directForm = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/consent`, {
				method: "POST",
				headers: {
					origin: "https://evil.example",
					cookie: issued.cookie,
					"content-type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					accept: "true",
					oauth_query: consentUrl.search.slice(1),
				}),
			}),
		)
		assert.notEqual(directForm.status, 200, await directForm.clone().text())
		const directNoOrigin = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/consent`, {
				method: "POST",
				headers: { cookie: issued.cookie, "content-type": "application/json" },
				body: JSON.stringify({
					accept: true,
					oauth_query: consentUrl.search.slice(1),
				}),
			}),
		)
		assert.equal(
			directNoOrigin.status,
			403,
			await directNoOrigin.clone().text(),
		)
	} finally {
		context.skipOriginCheck = skipped
	}
})

test("narrowing a write grant to read-only stops its earlier write tokens", async () => {
	const { mcpAuthorization } = await import("../mcp/authorization.server.ts")
	const { setAuthForTest } = await import("./runtime.server.ts")
	process.env.BETTER_AUTH_ENABLED = "true"
	process.env.MCP_RESOURCE_URL = resource
	setAuthForTest(memberAuth)
	try {
		const issued = await grant(
			"mcp:read mcp:write offline_access",
			undefined,
			"write",
		)
		assert.ok(
			(
				await mcpAuthorization.verifyAccessToken(issued.token.access_token)
			).scopes.includes("mcp:write"),
		)
		const consentUrl = await authorizeAgain(
			issued,
			"mcp:read mcp:write offline_access",
			{ prompt: "consent" },
		)
		const answer = await decideMcpConsent(
			new Request(consentUrl, {
				method: "POST",
				headers: { cookie: issued.cookie, origin },
				body: new URLSearchParams({ decision: "allow", access: "read" }),
			}),
			memberAuth,
		)
		assert.equal(answer.status, 302, await answer.clone().text())
		await assert.rejects(
			mcpAuthorization.verifyAccessToken(issued.token.access_token),
		)
		const rotated = await memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: issued.client.client_id,
					refresh_token: issued.token.refresh_token,
					resource,
				}),
			}),
		)
		if (rotated.status === 200) {
			const token = (await rotated.json()).access_token
			let scopes: string[] = []
			try {
				scopes = (await mcpAuthorization.verifyAccessToken(token)).scopes
			} catch {}
			assert.ok(
				!scopes.includes("mcp:write"),
				`old refresh token still yields ${scopes}`,
			)
		}
	} finally {
		setAuthForTest(null)
		Reflect.deleteProperty(process.env, "BETTER_AUTH_ENABLED")
		Reflect.deleteProperty(process.env, "MCP_RESOURCE_URL")
	}
})

test("consent refuses a grant without read access instead of issuing an unusable token", async () => {
	const issued = await grant("mcp:read offline_access", undefined, "read")
	for (const access of ["read", "write"]) {
		const consentUrl = await authorizeAgain(issued, "mcp:write", {
			prompt: "consent",
		})
		const answer = await decideMcpConsent(
			new Request(consentUrl, {
				method: "POST",
				headers: { cookie: issued.cookie, origin },
				body: new URLSearchParams({ decision: "allow", access }),
			}),
			memberAuth,
		)
		assert.equal(answer.status, 400, access)
		assert.match(await answer.text(), /see your GoodWatch/)
	}
})

// The consent page promises the app never sees the email address (APP_CAN_NEVER).
test("an app that asks for openid, profile and email learns neither the email nor the name", async () => {
	const member = await grant("mcp:read offline_access", undefined, "read")
	const registration = await post("/oauth2/register", {
		client_name: "Identity scopes app",
		application_type: "native",
		redirect_uris: ["http://127.0.0.1:6281/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "openid profile email mcp:read offline_access",
	})
	assert.equal(registration.status, 201, await registration.clone().text())
	const client = await registration.json()
	const { createHash } = await import("node:crypto")
	const verifier = "c".repeat(64)
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		response_type: "code",
		scope: "openid profile email mcp:read offline_access",
		resource,
		state: "local-state",
		nonce: "local-nonce",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
	})
	const authorization = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie: member.cookie, accept: "application/json" },
		}),
	)
	const consentUrl = new URL((await authorization.json()).url, origin)
	assert.equal(consentUrl.pathname, "/auth/mcp/consent", consentUrl.href)
	const answer = await decideMcpConsent(
		new Request(consentUrl, {
			method: "POST",
			headers: { cookie: member.cookie, origin },
			body: new URLSearchParams({ decision: "allow" }),
		}),
		memberAuth,
	)
	assert.equal(answer.status, 302, await answer.clone().text())
	const callback = new URL(answer.headers.get("Location") ?? "")
	const code = callback.searchParams.get("code")
	assert.ok(code, callback.href)
	const tokenResponse = await memberAuth.handler(
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
	assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text())
	const token = await tokenResponse.json()
	assert.equal(token.scope, "mcp:read offline_access")
	assert.equal(token.id_token, undefined)
	const info = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/userinfo`, {
			headers: { authorization: `Bearer ${token.access_token}` },
		}),
	)
	const infoText = await info.text()
	assert.ok(!infoText.includes(member.email), `userinfo returned ${infoText}`)
	assert.ok(!infoText.includes("Local member"), `userinfo returned ${infoText}`)
})

test("proof-capable clients are refused explicitly before DPoP token issuance", async () => {
	const { generateKeyPair, exportJWK, SignJWT } = await import("jose")
	const { privateKey, publicKey } = await generateKeyPair("ES256")
	const proof = await new SignJWT({
		htm: "POST",
		htu: `${origin}/api/auth/oauth2/token`,
	})
		.setProtectedHeader({
			alg: "ES256",
			typ: "dpop+jwt",
			jwk: await exportJWK(publicKey),
		})
		.setIssuedAt()
		.setJti(crypto.randomUUID())
		.sign(privateKey)
	const issued = await grant(
		"mcp:read offline_access",
		undefined,
		"read",
		{ DPoP: proof },
		400,
	)
	assert.equal(issued.token.error, "invalid_request")
	assert.match(issued.token.error_description, /DPoP is not supported/)
	assert.equal(issued.token.access_token, undefined)
	const registration = await post("/oauth2/register", {
		client_name: "DPoP-only test app",
		redirect_uris: ["http://127.0.0.1:6280/callback"],
		token_endpoint_auth_method: "none",
		dpop_bound_access_tokens: true,
	})
	assert.equal(registration.status, 400)
	const authorize = await memberAuth.handler(
		new Request(
			`${origin}/api/auth/oauth2/authorize?dpop_jkt=${"a".repeat(43)}`,
		),
	)
	assert.equal(authorize.status, 400)
})

test("a read grant upgrades only after explicit write consent and refresh preserves the upgrade", async () => {
	const issued = await grant(
		"mcp:read mcp:write offline_access",
		undefined,
		"read",
	)
	const consentUrl = await authorizeAgain(
		issued,
		"mcp:read mcp:write offline_access",
	)
	assert.equal(consentUrl.pathname, "/auth/mcp/consent")
	const decision = await decideMcpConsent(
		new Request(consentUrl, {
			method: "POST",
			headers: { cookie: issued.cookie, origin },
			body: new URLSearchParams({ decision: "allow", access: "write" }),
		}),
		memberAuth,
	)
	assert.equal(decision.status, 302)
	const location = decision.headers.get("Location")
	assert.ok(location)
	const callback = new URL(location)
	const code = callback.searchParams.get("code")
	assert.ok(code)
	const token = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: issued.client.client_id,
				redirect_uri: issued.client.redirect_uris[0],
				code,
				code_verifier: "b".repeat(64),
				resource,
			}),
		}),
	)
	assert.equal(token.status, 200, await token.clone().text())
	const pair = await token.json()
	assert.equal(pair.token_type, "Bearer")
	assert.ok(pair.scope.split(" ").includes("mcp:write"))
	const refreshed = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				client_id: issued.client.client_id,
				refresh_token: pair.refresh_token,
				resource,
			}),
		}),
	)
	assert.equal(refreshed.status, 200, await refreshed.clone().text())
	assert.ok((await refreshed.json()).scope.split(" ").includes("mcp:write"))
})

test("private_key_jwt clients exchange a consented authorization code", async () => {
	const member = await grant("mcp:read offline_access", undefined, "read")
	const { generateKeyPair, exportJWK, SignJWT } = await import("jose")
	const { createHash } = await import("node:crypto")
	const { publicKey, privateKey } = await generateKeyPair("RS256")
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: "chatgpt-repro",
		alg: "RS256",
		use: "sig",
	}
	const registration = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/register`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin,
				"x-forwarded-for": "127.0.0.91",
			},
			body: JSON.stringify({
				client_name: "Private key assertion regression",
				application_type: "web",
				redirect_uris: ["https://client.example.test/callback"],
				token_endpoint_auth_method: "private_key_jwt",
				jwks: { keys: [jwk] },
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				scope: "openid email offline_access mcp:read mcp:write",
			}),
		}),
	)
	assert.equal(registration.status, 201, await registration.clone().text())
	const client = await registration.json()
	const verifier = "assertion-proof-".repeat(5)
	const query = new URLSearchParams({
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		response_type: "code",
		scope: "openid email offline_access mcp:read mcp:write",
		resource,
		state: "assertion-test",
		code_challenge_method: "S256",
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
	})
	const authorization = await memberAuth.handler(
		new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
			headers: { cookie: member.cookie, accept: "application/json" },
		}),
	)
	assert.equal(authorization.status, 200, await authorization.clone().text())
	const consentUrl = new URL((await authorization.json()).url, origin)
	const approved = await decideMcpConsent(
		new Request(consentUrl, {
			method: "POST",
			headers: { cookie: member.cookie, origin },
			body: new URLSearchParams({ decision: "allow", access: "write" }),
		}),
		memberAuth,
	)
	assert.equal(approved.status, 302)
	const callback = approved.headers.get("Location")
	assert.ok(callback)
	const code = new URL(callback).searchParams.get("code")
	assert.ok(code)
	const assertionId = crypto.randomUUID()
	const signAssertion = (id: string) =>
		new SignJWT({})
			.setProtectedHeader({ alg: "RS256", kid: jwk.kid })
			.setIssuer(client.client_id)
			.setSubject(client.client_id)
			.setAudience(`${origin}/api/auth/oauth2/token`)
			.setIssuedAt()
			.setExpirationTime("5m")
			.setJti(id)
			.sign(privateKey)
	const assertion = await signAssertion(assertionId)
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
				client_assertion_type:
					"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
				client_assertion: assertion,
			}),
		}),
	)
	assert.equal(token.status, 200, await token.clone().text())
	const pair = await token.json()
	assert.ok(pair.access_token)
	assert.ok(pair.refresh_token)
	const markerId = createHash("sha256")
		.update(`private_key_jwt:${client.client_id}:${assertionId}`)
		.digest()
		.subarray(0, 24)
		.toString("base64url")
	assert.equal(
		(
			await sql("SELECT id FROM doc.auth_oauth_client_assertion WHERE id = ?", [
				markerId,
			])
		).rows[0]?.[0],
		markerId,
	)
	const refresh = (clientAssertion: string) =>
		memberAuth.handler(
			new Request(`${origin}/api/auth/oauth2/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					client_id: client.client_id,
					refresh_token: pair.refresh_token,
					resource,
					client_assertion_type:
						"urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
					client_assertion: clientAssertion,
				}),
			}),
		)
	const replay = await refresh(assertion)
	assert.equal(replay.status, 400)
	assert.equal((await replay.json()).error, "invalid_client")
	const refreshed = await refresh(await signAssertion(crypto.randomUUID()))
	assert.equal(refreshed.status, 200, await refreshed.clone().text())
	const next = await refreshed.json()
	assert.ok(next.access_token)
	assert.notEqual(next.refresh_token, pair.refresh_token)
})
