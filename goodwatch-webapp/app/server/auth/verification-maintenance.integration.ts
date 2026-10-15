import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import { after, test } from "node:test"
import Redis from "ioredis"
import { SignJWT, exportJWK, generateKeyPair } from "jose"
import { createGoodwatchAuth } from "./auth.server.ts"
import { AuthMailQueue } from "./mail.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { collectAuthGarbage } from "./maintenance.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { authTestValkeyPort } from "./store-fixtures.integration.ts"

const sql = maintenanceDatabase()
const redis = new Redis.Cluster(
	[{ host: "127.0.0.1", port: authTestValkeyPort }],
	{
		natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	},
)
after(() => redis.disconnect())
const baseURL = "http://127.0.0.1:3361"
const storage = new ValkeyAuthStorage(() => redis)
const auth = createGoodwatchAuth({
	sql,
	storage,
	mail: new AuthMailQueue({ sendMail: async () => {} }),
	baseURL,
	secret: "local-verification-maintenance-secret-32",
	google: { clientId: "local", clientSecret: "local" },
	rateLimit: { enabled: false },
})
const post = (path: string, body: unknown) =>
	auth.handler(
		new Request(`${baseURL}/api/auth${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: baseURL },
			body: JSON.stringify(body),
		}),
	)

test("10,050 expired verification rows preserve password-reset errors and Google sign-in with database state", async () => {
	const body = {
		token: "invalid-token",
		newPassword: "a replacement secure password",
	}
	const baseline = await post("/reset-password", body)
	assert.equal(baseline.status, 400, await baseline.clone().text())
	assert.equal((await baseline.json()).code, "INVALID_TOKEN")
	const context = await auth.$context
	// Real production writes, including one admission ledger per random state actor.
	// The old request-time cleanup must enumerate all 10,050 before it can delete any.
	const expiresAt = new Date(Date.now() - 60000)
	for (let offset = 0; offset < 10050; offset += 50) {
		await Promise.all(
			Array.from({ length: Math.min(50, 10050 - offset) }, () =>
				context.internalAdapter.createVerificationValue({
					identifier: `state-${randomUUID()}`,
					value: "disposable-local-oauth-state",
					expiresAt,
				}),
			),
		)
	}
	await sql("REFRESH TABLE doc.auth_verification")
	assert.deepEqual(
		(
			await sql(
				"SELECT count(*) FROM doc.auth_verification WHERE deleted=false AND expires_at < CURRENT_TIMESTAMP",
			)
		).rows,
		[[10050]],
	)
	const result = await post("/reset-password", body)
	assert.equal(result.status, 400, await result.clone().text())
	assert.equal((await result.json()).code, "INVALID_TOKEN")
	await googleSignInWithoutCachedState()
	// Cleanup belongs to bounded maintenance, not an unrelated auth request.
	await sql("REFRESH TABLE doc.auth_verification")
	assert.deepEqual(
		(
			await sql(
				"SELECT count(*) FROM doc.auth_verification WHERE deleted=false",
			)
		).rows,
		[[10050]],
	)
	const collected = await collectAuthGarbage({
		sql,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		model: "verification",
		batchSize: 10,
	})
	assert.ok(collected.expired >= 1 && collected.expired <= 10)
	assert.equal(collected.complete, false)
})

async function googleSignInWithoutCachedState() {
	const { privateKey, publicKey } = await generateKeyPair("RS256")
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: "local-expiry-google-key",
		alg: "RS256",
		use: "sig",
	}
	const email = `${randomUUID()}@example.test`
	const token = await new SignJWT({
		sub: `google-${randomUUID()}`,
		email,
		email_verified: true,
		name: "Google member",
	})
		.setProtectedHeader({ alg: "RS256", kid: jwk.kid })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("https://accounts.google.com")
		.setAudience("local")
		.sign(privateKey)
	let challenge = ""
	const fixture = createServer(async (req, res) => {
		res.setHeader("content-type", "application/json")
		if (req.url === "/certs") {
			res.end(JSON.stringify({ keys: [jwk] }))
			return
		}
		let body = ""
		for await (const chunk of req) body += chunk
		const params = new URLSearchParams(body)
		if (
			params.get("code") !== "local-code" ||
			createHash("sha256")
				.update(params.get("code_verifier") ?? "")
				.digest("base64url") !== challenge
		) {
			res.statusCode = 400
			res.end(JSON.stringify({ error: "invalid_grant" }))
			return
		}
		res.end(
			JSON.stringify({
				access_token: "local-access",
				refresh_token: "local-refresh",
				id_token: token,
				token_type: "Bearer",
				expires_in: 3600,
			}),
		)
	})
	await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve))
	const address = fixture.address()
	assert.ok(address && typeof address !== "string")
	const originalFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input))
		if (url.href === "https://oauth2.googleapis.com/token")
			return originalFetch(`http://127.0.0.1:${address.port}/token`, init)
		if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
			return originalFetch(`http://127.0.0.1:${address.port}/certs`, init)
		if (!["127.0.0.1", "localhost"].includes(url.hostname))
			throw new Error("External auth network blocked in test")
		return originalFetch(input, init)
	}
	try {
		const start = await post("/sign-in/social", {
			provider: "google",
			callbackURL: `${baseURL}/account`,
		})
		assert.equal(start.status, 200, await start.clone().text())
		const authorization = new URL((await start.json()).url)
		const state = authorization.searchParams.get("state")
		challenge = authorization.searchParams.get("code_challenge") ?? ""
		assert.ok(state && challenge)
		// Exercise database fallback, as after cache expiry or a cold cache.
		await storage.delete(
			`verification:${createHash("sha256").update(`auth-state:${state}`).digest("base64url")}`,
		)
		const cookies = (response: Response) =>
			response.headers
				.getSetCookie()
				.map((c) => c.split(";")[0])
				.join("; ")
		const callback = await auth.handler(
			new Request(
				`${baseURL}/api/auth/callback/google?code=local-code&state=${state}`,
				{ headers: { cookie: cookies(start) } },
			),
		)
		assert.match(
			cookies(callback),
			/gw.session_token=/,
			callback.headers.get("location") ?? (await callback.clone().text()),
		)
		const session = await auth.handler(
			new Request(`${baseURL}/api/auth/get-session`, {
				headers: { cookie: cookies(callback) },
			}),
		)
		assert.equal((await session.json()).user.email, email)
	} finally {
		globalThis.fetch = originalFetch
		await new Promise<void>((resolve) => fixture.close(() => resolve()))
	}
}
