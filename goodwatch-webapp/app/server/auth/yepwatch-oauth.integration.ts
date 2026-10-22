/** Explicit disposable actual issuer test; no production account/config operations. */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import Redis from "ioredis"
import type { Cluster } from "ioredis"
import { createGoodwatchAuth, setCookiesOf } from "./auth.server.ts"
import { AuthMailQueue } from "./mail.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { decideMcpConsent } from "./mcp-flow.server.ts"
import { pkce } from "../yepwatch/continuous-members.server.ts"
import { centralMemberIssuer } from "../yepwatch/continuous-member-issuer.server.ts"
import { verifyOAuthResourceToken } from "./oauth-access.server.ts"
const crateOrigin = process.env.YEPWATCH_TEST_AUTH_CRATE_ORIGIN
if (
	process.env.YEPWATCH_TEST_AUTH_DISPOSABLE !== "1" ||
	!crateOrigin ||
	new URL(crateOrigin).protocol !== "http:" ||
	new URL(crateOrigin).hostname !== "127.0.0.1" ||
	!process.env.YEPWATCH_TEST_AUTH_REDIS_URL ||
	new URL(process.env.YEPWATCH_TEST_AUTH_REDIS_URL).protocol !== "redis:" ||
	new URL(process.env.YEPWATCH_TEST_AUTH_REDIS_URL).hostname !== "127.0.0.1"
)
	throw new Error("Explicit disposable loopback OAuth endpoints required")
const sql = localCrateTransport([crateOrigin])
await migrateAuthTables(sql)
const redis = new Redis(process.env.YEPWATCH_TEST_AUTH_REDIS_URL)
const messages: { text?: unknown }[] = []
const mail = new AuthMailQueue({
	async sendMail(message) {
		messages.push(message)
		return {}
	},
})
const origin = "http://127.0.0.1:15984"
const resource = "http://127.0.0.1:15994/api/yepwatch/v1/continuous"
const callback = `${resource}/member/callback`
const policy = {
	resource,
	clientId: "will-be-provisioned-locally",
	redirectUris: [callback],
}
const auth = createGoodwatchAuth({
	sql,
	storage: new ValkeyAuthStorage(() => redis as unknown as Cluster),
	mail,
	baseURL: origin,
	secret: "disposable-yepwatch-central-issuer-secret-20261022",
	google: { clientId: "local-unused", clientSecret: "local-unused" },
	mcp: { resource: `${origin}/mcp` },
	yepwatch: policy,
	rateLimit: { enabled: false },
})
const post = (path: string, body: unknown, cookie = "") =>
	auth.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: "POST",
			headers: {
				origin,
				"content-type": "application/json",
				"x-forwarded-for": "127.0.0.1",
				...(cookie ? { cookie } : {}),
			},
			body: JSON.stringify(body),
		}),
	)
try {
	const email = `yepwatch-${randomBytes(8).toString("hex")}@example.invalid`
	const password = "Local-YepWatch-example-only-20261022!"
	const signup = await post("/sign-up/email", {
		email,
		password,
		name: "Disposable member",
	})
	assert.equal(signup.status, 200, await signup.clone().text())
	await mail.drain()
	const text = messages.map((m) => String(m.text)).join("\n")
	const link = text.match(/http:\/\/127\.0\.0\.1:15984\/api\/auth\/\S+/)?.[0]
	assert.ok(link, "Verification mail captured locally")
	const verified = await auth.handler(new Request(link))
	assert.ok([200, 302].includes(verified.status))
	const login = await post("/sign-in/email", { email, password })
	assert.equal(login.status, 200, await login.clone().text())
	const cookie = setCookiesOf(login.headers)
		.map((c) => c.split(";")[0])
		.join("; ")
	assert.ok(cookie)
	console.log(
		"Actual issuer fixture signup/verification/login completed; checking session",
	)
	const session = await auth.api.getSession({
		headers: new Headers({ cookie }),
	})
	assert.ok(session, "Actual login session missing")
	console.log("Actual session verified; creating dedicated local public client")
	const registration = await post("/oauth2/register", {
		client_name: "YepWatch local integration",
		redirect_uris: policy.redirectUris,
		token_endpoint_auth_method: "none",
		application_type: "native",
		scope: "yepwatch:read",
	})
	assert.equal(registration.status, 201, await registration.clone().text())
	const registered = (await registration.json()) as { client_id: string }
	policy.clientId = registered.client_id
	const context = await auth.$context
	const protectedResource = await context.adapter.findOne<{ id: string }>({
		model: "oauthResource",
		where: [{ field: "identifier", value: resource }],
	})
	assert.ok(protectedResource)
	await context.adapter.create({
		model: "oauthClientResource",
		data: {
			clientId: policy.clientId,
			resourceId: protectedResource.id,
			createdAt: new Date(),
		},
	})
	const memberIssuer = centralMemberIssuer(
		{ ...policy, issuerOrigin: origin },
		auth,
		async (input, init) => auth.handler(new Request(input, init)),
	)
	async function codeFor(
		challenge: string,
		requestedResource = resource,
		clientId = policy.clientId,
		scope = "yepwatch:read",
	) {
		const state = randomBytes(32).toString("base64url")
		const authorize = new URL(
			memberIssuer.authorize({ state, challenge, redirectUri: callback }),
		)
		authorize.searchParams.set("resource", requestedResource)
		authorize.searchParams.set("client_id", clientId)
		authorize.searchParams.set("scope", scope)
		const result = await auth.handler(
			new Request(authorize, {
				headers: { cookie, origin, "x-forwarded-for": "127.0.0.1" },
			}),
		)
		assert.equal(result.status, 302, await result.clone().text())
		const location = result.headers.get("location")
		assert.ok(location)
		const consentUrl = new URL(location, origin)
		assert.equal(
			consentUrl.pathname,
			"/auth/mcp/consent",
			JSON.stringify({
				path: consentUrl.pathname,
				error: consentUrl.searchParams.get("error"),
				description: consentUrl.searchParams.get("error_description"),
			}),
		)
		const consent = await decideMcpConsent(
			new Request(consentUrl, {
				method: "POST",
				headers: {
					cookie,
					origin,
					"content-type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ decision: "allow", access: "read" }),
			}),
			auth,
		)
		assert.equal(consent.status, 302, await consent.clone().text())
		const dest = new URL(consent.headers.get("location")!, origin)
		assert.equal(dest.searchParams.get("state"), state)
		const code = dest.searchParams.get("code")
		assert.ok(code, dest.searchParams.get("error") ?? "No authorization code")
		return code
	}
	const verifier = randomBytes(32).toString("base64url")
	const code = await codeFor(pkce(verifier))
	const tokens = await memberIssuer.exchange({
		code,
		verifier,
		redirectUri: callback,
	})
	const identity = await memberIssuer.verify(tokens.accessToken)
	assert.ok(identity.userId)
	await assert.rejects(() =>
		verifyOAuthResourceToken(
			tokens.accessToken,
			{ resource: `${origin}/mcp` },
			auth,
		),
	)
	await assert.rejects(() =>
		verifyOAuthResourceToken(
			tokens.accessToken,
			{ resource, clientId: "wrong-client", requiredScopes: ["yepwatch:read"] },
			auth,
		),
	)
	const badVerifier = randomBytes(32).toString("base64url")
	const badCode = await codeFor(pkce(badVerifier))
	await assert.rejects(() =>
		memberIssuer.exchange({
			code: badCode,
			verifier: randomBytes(32).toString("base64url"),
			redirectUri: callback,
		}),
	)
	const wrongRequest = new URL(
		memberIssuer.authorize({
			state: randomBytes(32).toString("base64url"),
			challenge: pkce(verifier),
			redirectUri: callback,
		}),
	)
	wrongRequest.searchParams.set("resource", `${origin}/mcp`)
	assert.equal(
		(
			await auth.handler(
				new Request(wrongRequest, { headers: { cookie, origin } }),
			)
		).status,
		400,
	)
	wrongRequest.searchParams.set("resource", resource)
	wrongRequest.searchParams.set("redirect_uri", "https://evil.example/")
	assert.equal(
		(
			await auth.handler(
				new Request(wrongRequest, { headers: { cookie, origin } }),
			)
		).status,
		400,
	)
	const mcpRegistration = await post("/oauth2/register", {
		client_name: "MCP regression fixture",
		redirect_uris: [callback],
		token_endpoint_auth_method: "none",
		application_type: "native",
		scope: "mcp:read",
	})
	assert.equal(
		mcpRegistration.status,
		201,
		await mcpRegistration.clone().text(),
	)
	const mcpClient = (await mcpRegistration.json()) as { client_id: string }
	const mcpVerifier = randomBytes(32).toString("base64url")
	const mcpCode = await codeFor(
		pkce(mcpVerifier),
		`${origin}/mcp`,
		mcpClient.client_id,
		"mcp:read",
	)
	const mcpResponse = await auth.handler(
		new Request(`${origin}/api/auth/oauth2/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: mcpClient.client_id,
				resource: `${origin}/mcp`,
				redirect_uri: callback,
				code: mcpCode,
				code_verifier: mcpVerifier,
			}),
		}),
	)
	assert.equal(mcpResponse.status, 200, await mcpResponse.clone().text())
	const mcpTokens = (await mcpResponse.json()) as { access_token: string }
	assert.ok(
		(
			await verifyOAuthResourceToken(
				mcpTokens.access_token,
				{ resource: `${origin}/mcp` },
				auth,
			)
		).scopes.includes("mcp:read"),
	)
	await assert.rejects(() => memberIssuer.verify(mcpTokens.access_token))
	const consent = await context.adapter.findOne<{ id: string }>({
		model: "oauthConsent",
		where: [
			{ field: "clientId", value: policy.clientId },
			{ field: "userId", value: identity.userId },
		],
	})
	assert.ok(consent)
	await context.adapter.delete({
		model: "oauthConsent",
		where: [{ field: "id", value: consent.id }],
	})
	await assert.rejects(() => memberIssuer.verify(tokens.accessToken))
	console.log(
		"PASS actual existing issuer + disposable Crate/Valkey: public PKCE, signed read consent, YepWatch-only audience/client/scope, wrong verifier/redirect/resource, live grant revocation + existing MCP read flow/cross-token denial; no production account operations",
	)
} finally {
	await mail.drain()
	redis.disconnect()
}
