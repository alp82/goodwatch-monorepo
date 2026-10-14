import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import { randomUUID } from "node:crypto"
import Redis from "ioredis"
import {
	localCrateTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import { createGoodwatchAuth } from "./auth.server.ts"
import { AuthMailQueue, smtpTransport } from "./mail.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"

const baseURL = "http://localhost:3000"
const sql = localCrateTransport(["http://127.0.0.1:15548"])
const redis = new Redis.Cluster([{ host: "127.0.0.1", port: 15601 }], {
	natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
	redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
})
const storage = new ValkeyAuthStorage(() => redis)
const mail = new AuthMailQueue(
	smtpTransport({ host: "127.0.0.1", port: 15525, localCatcher: true }),
	{ retryDelayMs: 10 },
)
const auth = createGoodwatchAuth({
	sql,
	storage,
	mail,
	baseURL,
	secret: "disposable-local-wiring-secret-at-least-32",
	google: {
		clientId: "local-google-client",
		clientSecret: "local-google-secret",
	},
})
const email = () => `member-${randomUUID()}@example.test`
const password = "a secure password for tests"
const cookie = (response: Response) =>
	response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ")
async function call(
	path: string,
	body?: unknown,
	cookies = "",
	ip = "127.0.0.1",
) {
	return auth.handler(
		new Request(`${baseURL}/api/auth${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				"content-type": "application/json",
				origin: baseURL,
				cookie: cookies,
				"x-forwarded-for": ip,
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		}),
	)
}
async function messages(address: string) {
	await mail.drain()
	const data = await (
		await fetch("http://127.0.0.1:15580/api/v1/messages")
	).json()
	const found = data.messages.filter((m: any) =>
		m.To.some((t: any) => t.Address === address),
	)
	return Promise.all(
		found
			.reverse()
			.map(async (m: any) =>
				(await fetch(`http://127.0.0.1:15580/api/v1/message/${m.ID}`)).json(),
			),
	)
}
const link = (message: any) =>
	message.Text.match(/http:\/\/localhost:3000\/api\/auth\/\S+/)[0]
async function confirmed(address = email()) {
	assert.equal(
		(await call("/sign-up/email", { email: address, name: "Member", password }))
			.status,
		200,
	)
	const response = await auth.handler(
		new Request(link((await messages(address))[0])),
	)
	assert.ok([200, 302].includes(response.status), await response.clone().text())
	return { address, cookies: cookie(response) }
}
before(async () => {
	await migrateAuthTables(sql)
	await redis.ping()
})
after(async () => {
	await mail.drain()
	redis.disconnect()
})

test("a member confirms their email before signing in and receives a 90-day gw session", async () => {
	const address = email()
	const signup = await call("/sign-up/email", {
		email: address,
		name: "Member",
		password,
	})
	assert.equal(signup.status, 200, await signup.clone().text())
	assert.equal(cookie(signup), "")
	assert.equal(
		(await call("/sign-in/email", { email: address, password })).status,
		401,
	)
	const message = (await messages(address))[0]
	assert.equal(message.From.Address, "hello@goodwatch.app")
	const verify = await auth.handler(new Request(link(message)))
	assert.match(cookie(verify), /gw.session_token=/)
	const session = await (
		await call("/get-session", undefined, cookie(verify))
	).json()
	assert.equal(session.user.email, address)
	assert.ok(
		Math.abs(
			new Date(session.session.expiresAt).getTime() -
				Date.now() -
				90 * 86400000,
		) < 10000,
	)
})

test("only the newest confirmation works, it expires after 24 hours, and it is single use", async () => {
	const address = email()
	await call("/sign-up/email", { email: address, name: "Member", password })
	const first = link((await messages(address))[0])
	await call("/send-verification-email", { email: address })
	const second = link((await messages(address)).at(-1))
	assert.notEqual(first, second)
	assert.equal((await auth.handler(new Request(first))).status, 401)
	const confirmed = await auth.handler(new Request(second))
	assert.match(cookie(confirmed), /gw.session_token=/)
	assert.equal((await auth.handler(new Request(second))).status, 401)
	const payload = JSON.parse(
		Buffer.from(
			new URL(second).searchParams.get("token")!.split(".")[1],
			"base64url",
		).toString(),
	)
	assert.equal(payload.exp - payload.iat, 86400)
})

test("an imported bcrypt password is upgraded to scrypt after successful sign-in", async () => {
	const { hash } = await import("bcryptjs")
	const { verifyPassword } = await import("better-auth/crypto")
	const context = await auth.$context
	const address = email()
	const user = await context.internalAdapter.createUser(
		{ email: address, name: "Imported member", emailVerified: true },
		{ method: "email-password" },
	)
	await context.internalAdapter.createAccount({
		userId: user.id,
		providerId: "credential",
		accountId: user.id,
		password: await hash(password, 10),
	})
	assert.equal(
		(
			await call("/sign-in/email", {
				email: address,
				password: "wrong password",
			})
		).status,
		401,
	)
	assert.match(
		(await context.internalAdapter.findCredentialAccount(user.id))!.password!,
		/^\$2/,
	)
	const response = await call("/sign-in/email", { email: address, password })
	assert.equal(response.status, 200, await response.clone().text())
	const upgraded = (await context.internalAdapter.findCredentialAccount(
		user.id,
	))!.password!
	assert.doesNotMatch(upgraded, /^\$2/)
	assert.equal(await verifyPassword({ hash: upgraded, password }), true)
	assert.equal(
		(await call("/sign-in/email", { email: address, password })).status,
		200,
	)
})

test("a password reset signs the member in, rejects replay, sends a notice and revokes other devices even without a cache index", async () => {
	const member = await confirmed()
	const other = await call("/sign-in/email", {
		email: member.address,
		password,
	})
	const context = await auth.$context
	const oldSession = await (
		await call("/get-session", undefined, member.cookies)
	).json()
	await storage.delete(`active-sessions-${oldSession.user.id}`)
	const resetRequest = await call("/request-password-reset", {
		email: member.address,
		redirectTo: `${baseURL}/account/reset`,
	})
	assert.equal(resetRequest.status, 200, await resetRequest.clone().text())
	const resetMail = (await messages(member.address)).at(-1)
	const token = new URL(link(resetMail)).pathname.split("/").at(-1)
	assert.equal(
		(await call("/reset-password", { token, newPassword: "123456789" })).status,
		400,
	)
	const changed = await call("/reset-password", {
		token,
		newPassword: "a replacement secure password",
	})
	assert.equal(changed.status, 200, await changed.clone().text())
	assert.match(cookie(changed), /gw.session_token=/)
	assert.equal(
		(await (await call("/get-session", undefined, cookie(changed))).json()).user
			.email,
		member.address,
	)
	assert.equal(
		await (await call("/get-session", undefined, member.cookies)).json(),
		null,
	)
	assert.equal(
		await (await call("/get-session", undefined, cookie(other))).json(),
		null,
	)
	assert.equal(
		(
			await call("/reset-password", {
				token,
				newPassword: "another secure replacement",
			})
		).status,
		400,
	)
	assert.match(
		(await messages(member.address)).at(-1).Subject,
		/password changed/i,
	)
	assert.equal(
		(await call("/sign-in/email", { email: member.address, password })).status,
		401,
	)
})

test("sign-up and reset responses conceal membership, duplicate signup emails the owner, and passwords require ten characters", async () => {
	const member = await confirmed()
	const newAddress = email()
	const duplicate = await call("/sign-up/email", {
		email: member.address,
		name: "Member",
		password,
	})
	const fresh = await call("/sign-up/email", {
		email: newAddress,
		name: "Member",
		password,
	})
	assert.deepEqual(await duplicate.json(), await fresh.json())
	assert.match(
		(await messages(member.address)).at(-1).Subject,
		/already.*account/i,
	)
	const known = await call("/request-password-reset", { email: member.address })
	const unknown = await call("/request-password-reset", { email: email() })
	assert.deepEqual(await known.json(), await unknown.json())
	const wrong = await call("/sign-in/email", {
		email: member.address,
		password: "wrong password",
	})
	const absent = await call("/sign-in/email", {
		email: email(),
		password: "wrong password",
	})
	assert.deepEqual(await wrong.json(), await absent.json())
	assert.equal(
		(
			await call("/sign-up/email", {
				email: email(),
				name: "Member",
				password: "123456789",
			})
		).status,
		400,
	)
})

test("changing a password keeps the current device signed in and signs other devices out even when opting out", async () => {
	const member = await confirmed()
	const other = await call("/sign-in/email", {
		email: member.address,
		password,
	})
	const changed = await call(
		"/change-password",
		{
			currentPassword: password,
			newPassword: "a new password on this device",
			revokeOtherSessions: false,
		},
		member.cookies,
	)
	assert.equal(changed.status, 200, await changed.clone().text())
	assert.equal(
		await (await call("/get-session", undefined, cookie(other))).json(),
		null,
	)
	assert.equal(
		(await (await call("/get-session", undefined, cookie(changed))).json()).user
			.email,
		member.address,
	)
	assert.match(
		(await messages(member.address)).at(-1).Subject,
		/password changed/i,
	)
})

test("Google OAuth validates state and PKCE, signs in a verified member, and sends Google-only reset guidance", async () => {
	const { createServer } = await import("node:http")
	const { generateKeyPair, exportJWK, SignJWT } = await import("jose")
	const { createHash } = await import("node:crypto")
	const { privateKey, publicKey } = await generateKeyPair("RS256")
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: "local-google-key",
		alg: "RS256",
		use: "sig",
	}
	const address = email()
	let challenge = ""
	const token = await new SignJWT({
		sub: `google-${randomUUID()}`,
		email: address,
		email_verified: true,
		name: "Google member",
	})
		.setProtectedHeader({ alg: "RS256", kid: jwk.kid })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("https://accounts.google.com")
		.setAudience("local-google-client")
		.sign(privateKey)
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
			params.get("code") !== "local-authorization-code" ||
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
				access_token: "local-google-access",
				refresh_token: "local-google-refresh",
				id_token: token,
				token_type: "Bearer",
				expires_in: 3600,
			}),
		)
	})
	await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve))
	const port = (fixture.address() as import("node:net").AddressInfo).port
	const originalFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input))
		if (url.href === "https://oauth2.googleapis.com/token")
			return originalFetch(`http://127.0.0.1:${port}/token`, init)
		if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
			return originalFetch(`http://127.0.0.1:${port}/certs`, init)
		if (!["127.0.0.1", "localhost"].includes(url.hostname))
			throw new Error("External auth network blocked in test")
		return originalFetch(input, init)
	}
	try {
		const start = await call("/sign-in/social", {
			provider: "google",
			callbackURL: `${baseURL}/account`,
		})
		assert.equal(start.status, 200, await start.clone().text())
		const authorization = new URL((await start.json()).url)
		assert.equal(authorization.hostname, "accounts.google.com")
		challenge = authorization.searchParams.get("code_challenge")!
		assert.ok(challenge)
		const state = authorization.searchParams.get("state")!
		const invalid = await call(
			`/callback/google?code=local-authorization-code&state=wrong-state`,
			undefined,
			cookie(start),
		)
		assert.equal(cookie(invalid).includes("gw.session_token="), false)
		const result = await call(
			`/callback/google?code=local-authorization-code&state=${state}`,
			undefined,
			cookie(start),
		)
		assert.match(
			cookie(result),
			/gw.session_token=/,
			result.headers.get("location") ?? (await result.clone().text()),
		)
		assert.equal(
			(await (await call("/get-session", undefined, cookie(result))).json())
				.user.email,
			address,
		)
		const again = await call(
			`/callback/google?code=local-authorization-code&state=${state}`,
			undefined,
			cookie(start),
		)
		assert.equal(cookie(again).includes("gw.session_token="), false)
		assert.equal(
			(await call("/request-password-reset", { email: address })).status,
			200,
		)
		assert.match(
			(await messages(address)).at(-1).Subject,
			/sign in with Google/i,
		)
	} finally {
		globalThis.fetch = originalFetch
		await new Promise<void>((resolve) => fixture.close(() => resolve()))
	}
})

test("resends and resets are rate-limited per address, including unknown addresses", async () => {
	const address = email()
	for (let i = 0; i < 5; i++)
		assert.equal(
			(await call("/request-password-reset", { email: address })).status,
			200,
		)
	assert.equal(
		(await call("/request-password-reset", { email: address })).status,
		429,
	)
	assert.equal(
		(await call("/send-verification-email", { email: address })).status,
		429,
	)
})

test("the auth flag gates HTTP endpoints and session resolution, and sign-out applies without memoization", async () => {
	const { handleAuthRequest, setAuthForTest } = await import(
		"./runtime.server.ts"
	)
	const { resolveSession } = await import("../../utils/auth-session.ts")
	const { hasAuthCookie } = await import("../../utils/auth-cookie.ts")
	const member = await confirmed()
	const previous = process.env.BETTER_AUTH_ENABLED
	setAuthForTest(auth)
	try {
		process.env.BETTER_AUTH_ENABLED = "false"
		assert.equal(
			(await handleAuthRequest(new Request(`${baseURL}/api/auth/get-session`)))
				.status,
			404,
		)
		process.env.BETTER_AUTH_ENABLED = "true"
		assert.equal(hasAuthCookie(member.cookies), true)
		assert.equal(
			(await resolveSession(member.cookies)).user?.email,
			member.address,
		)
		assert.equal(
			(await resolveSession(member.cookies)).user?.email,
			member.address,
		)
		const signedOut = await handleAuthRequest(
			new Request(`${baseURL}/api/auth/sign-out`, {
				method: "POST",
				headers: { origin: baseURL, cookie: member.cookies },
			}),
		)
		assert.equal(signedOut.status, 200)
		assert.equal((await resolveSession(member.cookies)).user, null)
	} finally {
		if (previous === undefined) delete process.env.BETTER_AUTH_ENABLED
		else process.env.BETTER_AUTH_ENABLED = previous
		setAuthForTest(null)
	}
})

test("SMTP work runs in the background, retries temporary failures, and alerts without addresses after exhaustion", async () => {
	const { renderMetrics } = await import("../metrics/registry.server.ts")
	const transport = smtpTransport({
		host: "127.0.0.1",
		port: 15525,
		localCatcher: true,
	})
	let attempts = 0
	let alerts = 0
	const retrying = new AuthMailQueue(
		{
			sendMail: async (message) => {
				attempts++
				if (attempts < 3) throw new Error("Temporary SMTP outage")
				return transport.sendMail(message)
			},
		},
		{
			retryDelayMs: 10,
			reportFailure: () => {
				alerts++
			},
		},
	)
	const address = email()
	retrying.enqueue(
		address,
		"Retry delivery",
		"A message sent through the local SMTP catcher after retries.",
	)
	assert.equal(attempts, 0)
	await retrying.drain()
	assert.equal(attempts, 3)
	assert.equal(alerts, 0)
	assert.match((await messages(address)).at(-1).Subject, /Retry delivery/)
	const failing = new AuthMailQueue(
		{
			sendMail: async () => {
				throw new Error("Permanent SMTP outage")
			},
		},
		{
			retryDelayMs: 10,
			reportFailure: () => {
				alerts++
			},
		},
	)
	failing.enqueue(
		email(),
		"Undelivered notice",
		"Must exhaust retries and alert.",
	)
	await failing.drain()
	assert.equal(alerts, 1)
	assert.match(
		renderMetrics(),
		/goodwatch_auth_mail_total\{outcome="retry"\} [1-9]/,
	)
	assert.match(
		renderMetrics(),
		/goodwatch_auth_mail_total\{outcome="failed"\} [1-9]/,
	)
})

test("sessions renew after one day at most, survive a missing Valkey key, and remain revoked after sign-out", async () => {
	const member = await confirmed()
	const first = await (
		await call("/get-session", undefined, member.cookies)
	).json()
	const context = await auth.$context
	await context.adapter.update({
		model: "session",
		where: [{ field: "token", value: first.session.token }],
		update: {
			updatedAt: new Date(Date.now() - 86401000),
			expiresAt: new Date(Date.now() + 89 * 86400000),
		},
	})
	const renewed = await call("/get-session", undefined, member.cookies)
	const data = await renewed.json()
	assert.ok(
		Math.abs(
			new Date(data.session.expiresAt).getTime() - Date.now() - 90 * 86400000,
		) < 10000,
	)
	assert.match(cookie(renewed), /gw.session_token=/)
	const again = await (
		await call("/get-session", undefined, member.cookies)
	).json()
	assert.equal(again.session.expiresAt, data.session.expiresAt)
	await storage.delete(data.session.token)
	assert.equal(
		(await (await call("/get-session", undefined, member.cookies)).json()).user
			.email,
		member.address,
	)
	await call("/sign-out", {}, member.cookies)
	assert.equal(
		await (await call("/get-session", undefined, member.cookies)).json(),
		null,
	)
})

test("secondary storage atomically consumes a key once and uses a fixed-window counter across cluster slots", async () => {
	const key = `test-consume:${randomUUID()}`
	await storage.set(key, "one use", 10)
	const results = await Promise.all(
		Array.from({ length: 24 }, () => storage.getAndDelete(key)),
	)
	assert.equal(results.filter((value) => value === "one use").length, 1)
	assert.equal(await storage.get(key), null)
	const counterKey = `test-counter:${randomUUID()}`
	const counts = await Promise.all(
		Array.from({ length: 24 }, () => storage.increment(counterKey, 30)),
	)
	assert.deepEqual(
		counts.sort((a, b) => a - b),
		Array.from({ length: 24 }, (_, i) => i + 1),
	)
	const ttl = await redis.ttl(`gw:auth:${counterKey}`)
	await storage.increment(counterKey, 600)
	assert.ok((await redis.ttl(`gw:auth:${counterKey}`)) <= ttl)
})

test("a Google-only member requesting a reset receives guidance without gaining a password account", async () => {
	const context = await auth.$context
	const address = email()
	const user = await context.internalAdapter.createUser(
		{ email: address, name: "Google member", emailVerified: true },
		{ method: "email-password" },
	)
	await context.internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId: `google-${randomUUID()}`,
	})
	const request = await call("/request-password-reset", { email: address })
	assert.equal(request.status, 200)
	const unknown = await call("/request-password-reset", { email: email() })
	assert.deepEqual(await request.json(), await unknown.json())
	assert.match((await messages(address)).at(-1).Subject, /sign in with Google/i)
	assert.equal(
		(await call("/sign-in/email", { email: address, password })).status,
		401,
	)
})

test("request limits also apply per IP across different addresses", async () => {
	for (let i = 0; i < 30; i++)
		assert.equal(
			(
				await call(
					"/request-password-reset",
					{ email: email() },
					"",
					"203.0.113.11",
				)
			).status,
			200,
		)
	assert.equal(
		(
			await call(
				"/request-password-reset",
				{ email: email() },
				"",
				"203.0.113.11",
			)
		).status,
		429,
	)
})

test("a Google identity with an unconfirmed email cannot create a first session", async () => {
	const { generateKeyPair, exportJWK, SignJWT } = await import("jose")
	const { privateKey, publicKey } = await generateKeyPair("RS256")
	const jwk = {
		...(await exportJWK(publicKey)),
		kid: "unconfirmed-google-key",
		alg: "RS256",
	}
	const token = await new SignJWT({
		sub: `google-${randomUUID()}`,
		email: email(),
		email_verified: false,
		name: "Unconfirmed Google member",
	})
		.setProtectedHeader({ alg: "RS256", kid: jwk.kid })
		.setIssuedAt()
		.setExpirationTime("1h")
		.setIssuer("https://accounts.google.com")
		.setAudience("local-google-client")
		.sign(privateKey)
	const originalFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input))
		if (url.href === "https://www.googleapis.com/oauth2/v3/certs")
			return Response.json({ keys: [jwk] })
		if (!["localhost", "127.0.0.1"].includes(url.hostname))
			throw new Error("External auth network blocked in test")
		return originalFetch(input, init)
	}
	try {
		const result = await call("/sign-in/social", {
			provider: "google",
			idToken: { token },
		})
		assert.equal(cookie(result).includes("gw.session_token="), false)
		assert.ok([401, 403].includes(result.status), await result.clone().text())
	} finally {
		globalThis.fetch = originalFetch
	}
})

test("a legacy password upgrade cannot overwrite a password changed concurrently", async () => {
	const { hash } = await import("bcryptjs")
	const { hashPassword, verifyPassword } = await import("better-auth/crypto")
	const context = await auth.$context
	const address = email()
	const user = await context.internalAdapter.createUser(
		{ email: address, name: "Imported member", emailVerified: true },
		{ method: "email-password" },
	)
	const account = await context.internalAdapter.createAccount({
		userId: user.id,
		providerId: "credential",
		accountId: user.id,
		password: await hash(password, 10),
	})
	const replacement = "a concurrently changed password"
	let conflict = true
	const racing = createGoodwatchAuth({
		sql: async (stmt, args) => {
			if (conflict && stmt.startsWith("UPDATE doc.auth_account ")) {
				conflict = false
				await context.internalAdapter.updateAccount(account.id, {
					password: await hashPassword(replacement),
				})
			}
			return sql(stmt, args)
		},
		encryptionSecret: "disposable-local-auth-integration-key-548",
		storage,
		mail,
		baseURL,
		secret: "disposable-local-wiring-secret-at-least-32",
		google: {
			clientId: "local-google-client",
			clientSecret: "local-google-secret",
		},
	})
	const response = await racing.handler(
		new Request(`${baseURL}/api/auth/sign-in/email`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: baseURL },
			body: JSON.stringify({ email: address, password }),
		}),
	)
	assert.equal(response.status, 401, await response.clone().text())
	assert.equal(cookie(response), "")
	const current = await context.internalAdapter.findCredentialAccount(user.id)
	assert.equal(
		await verifyPassword({ hash: current!.password!, password: replacement }),
		true,
	)
	assert.equal(
		(await call("/sign-in/email", { email: address, password: replacement }))
			.status,
		200,
	)
})
