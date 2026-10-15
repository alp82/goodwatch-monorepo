import { isolatedCrateAuthAdapter as crateAuthAdapter } from "./adapter-factory.ts"
import { randomUUID } from "node:crypto"
import { beforeAll, expect, test } from "vitest"
import { createAuthEndpoint } from "better-auth/api"
import { z } from "zod"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import type { AuthSql } from "../../../app/server/auth/crate-adapter.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "../../../app/server/auth/crate-adapter.server.ts"

const sql = localCrateTransport([
	"http://127.0.0.1:15748",
	"http://127.0.0.1:15749",
	"http://127.0.0.1:15750",
])
const secret = "disposable-local-auth-integration-key-548"
beforeAll(async () => {
	await migrateAuthTables(sql)
})
const makeAuth = (extra: BetterAuthOptions = {}) => {
	const options: BetterAuthOptions = {
		database: crateAuthAdapter({ sql, encryptionSecret: secret }),
		secret,
		baseURL: "http://localhost:3000",
		emailAndPassword: { enabled: true },
		verification: { disableCleanup: true },
		...extra,
	}
	return betterAuth(options)
}

test("Google accounts and sessions survive repeated Better Auth updates with large provider tokens", async () => {
	const auth = makeAuth()
	const { internalAdapter } = await auth.$context
	const user = await internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const account = await internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId: randomUUID(),
		accessToken: "a".repeat(2000),
		idToken: "i".repeat(2500),
		refreshToken: "r".repeat(1000),
	})
	for (let i = 0; i < 80; i++) {
		const updated = await internalAdapter.updateAccount(account.id, {
			accessToken: `${i}:${"a".repeat(2000)}`,
			idToken: `${i}:${"i".repeat(2500)}`,
		})
		expect(updated?.accessToken).toBe(`${i}:${"a".repeat(2000)}`)
	}
	const session = await internalAdapter.createSession(user.id)
	for (let i = 0; i < 300; i++)
		expect(
			(
				await internalAdapter.updateSession(session.token, {
					expiresAt: new Date(Date.now() + 100000 + i),
				})
			)?.id,
		).toBe(session.id)
})

import { oauthProvider } from "@better-auth/oauth-provider"
import { createHmac } from "node:crypto"
const cookieHeaders = (token: string) =>
	new Headers({
		cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`)}`,
		origin: "http://localhost:3000",
	})

// Disposable secondary-storage collaborator; the database and Better Auth hooks
// remain real. Live Valkey is covered by the auth-service wiring ticket.
function secondaryStorage(): NonNullable<
	BetterAuthOptions["secondaryStorage"]
> {
	const cache = new Map<string, string>()
	return {
		get: async (key) => cache.get(key) ?? null,
		set: async (key, value) => {
			cache.set(key, value)
		},
		delete: async (key) => {
			cache.delete(key)
		},
		getAndDelete: async (key) => {
			const value = cache.get(key) ?? null
			cache.delete(key)
			return value
		},
		increment: async (key) => {
			const value = Number(cache.get(key) ?? 0) + 1
			cache.set(key, String(value))
			return value
		},
	}
}

test.each(["sign out everywhere", "password reset", "account deletion"])(
	"%s runs OAuth revocation hooks for all 103 sessions",
	async (flow) => {
		let hooks = 0
		let resetToken = ""
		const auth = makeAuth({
			...(flow === "sign out everywhere"
				? {
						secondaryStorage: secondaryStorage(),
						session: { storeSessionInDatabase: true },
					}
				: {}),
			user: { deleteUser: { enabled: true } },
			emailAndPassword: {
				enabled: true,
				revokeSessionsOnPasswordReset: true,
				sendResetPassword: async ({ token }) => {
					resetToken = token
				},
			},
			plugins: [
				oauthProvider({
					loginPage: "/login",
					consentPage: "/consent",
					disableJwtPlugin: true,
				}),
			],
			databaseHooks: {
				session: {
					delete: {
						before: async () => {
							hooks++
						},
					},
				},
			},
		})
		const ctx = await auth.$context
		const user = await ctx.internalAdapter.createUser(
			{
				email: `${randomUUID()}@test.invalid`,
				name: "Member",
				emailVerified: true,
			},
			{ method: "email-password" },
		)
		const clientId = randomUUID()
		await ctx.adapter.create({
			model: "oauthClient",
			data: {
				clientId,
				name: "RP",
				redirectUris: ["http://localhost/callback"],
				createdAt: new Date(),
			},
		})
		const sessions: { id: string; token: string }[] = []
		if (flow === "sign out everywhere") {
			// Sequential creation gives the upstream cache index all session references.
			for (let i = 0; i < 103; i++)
				sessions.push(await ctx.internalAdapter.createSession(user.id))
		} else
			for (let start = 0; start < 103; start += 10)
				sessions.push(
					...(await Promise.all(
						Array.from({ length: Math.min(10, 103 - start) }, () =>
							ctx.internalAdapter.createSession(user.id),
						),
					)),
				)
		const tokens: { model: string; token: string }[] = []
		for (const session of sessions)
			tokens.push(
				...(await Promise.all(
					["oauthAccessToken", "oauthRefreshToken"].map(async (model) => {
						const token = randomUUID()
						await ctx.adapter.create({
							model,
							data: {
								token,
								clientId,
								userId: user.id,
								sessionId: session.id,
								scopes: ["openid"],
								createdAt: new Date(),
								expiresAt: new Date(Date.now() + 600000),
							},
						})
						return { model, token }
					}),
				)),
			)
		if (flow === "sign out everywhere")
			expect(
				await auth.api.revokeSessions({
					headers: cookieHeaders(sessions[0].token),
				}),
			).toEqual({ status: true })
		else if (flow === "password reset") {
			await auth.api.requestPasswordReset({ body: { email: user.email } })
			expect(
				await auth.api.resetPassword({
					body: { token: resetToken, newPassword: "replacement-password-548" },
				}),
			).toEqual({ status: true })
		} else
			expect(
				(
					await auth.api.deleteUser({
						headers: cookieHeaders(sessions[0].token),
						body: {},
					})
				).success,
			).toBe(true)
		expect(hooks).toBe(103)
		for (const { model, token } of tokens)
			expect(
				(
					await ctx.adapter.findOne<{ revoked?: Date }>({
						model,
						where: [{ field: "token", value: token }],
					})
				)?.revoked,
			).toBeInstanceOf(Date)
		expect(await ctx.internalAdapter.listSessions(user.id)).toEqual([])
		if (flow === "sign out everywhere") {
			expect(
				await auth.api.getSession({
					headers: cookieHeaders(sessions[0].token),
				}),
			).toBeNull()
			expect(
				await auth.api.getSession({
					headers: cookieHeaders(sessions[102].token),
				}),
			).toBeNull()
		}
	},
	300000,
)

test("four parallel session checks all remain authenticated when refreshes contend", async () => {
	let arrivals = 0
	let release!: () => void
	const ready = new Promise<void>((resolve) => {
		release = resolve
	})
	const racingSql: AuthSql = async (stmt, args = []) => {
		if (stmt.startsWith("UPDATE doc.auth_session ") && arrivals < 4) {
			if (++arrivals === 4) release()
			await ready
		}
		return sql(stmt, args)
	}
	const auth = makeAuth({
		database: crateAuthAdapter({ sql: racingSql, encryptionSecret: secret }),
		session: { updateAge: 0 },
	})
	const ctx = await auth.$context
	const user = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const session = await ctx.internalAdapter.createSession(
		user.id,
		false,
		{ expiresAt: new Date(Date.now() + 100000) },
		true,
	)
	const results = await Promise.allSettled(
		Array.from({ length: 4 }, () =>
			auth.api.getSession({ headers: cookieHeaders(session.token) }),
		),
	)
	expect(results.map((r) => r.status)).toEqual([
		"fulfilled",
		"fulfilled",
		"fulfilled",
		"fulfilled",
	])
	expect(arrivals).toBe(4)
	for (const result of results)
		if (result.status === "fulfilled")
			expect(result.value?.session.id).toBe(session.id)
})

import { handleOAuthUserInfo } from "better-auth/oauth2"
test("concurrent Google sign-ins update the linked account and each create a session", async () => {
	let arrivals = 0
	let release!: () => void
	const ready = new Promise<void>((resolve) => {
		release = resolve
	})
	const racingSql: AuthSql = async (stmt, args = []) => {
		if (stmt.startsWith("UPDATE doc.auth_account ") && arrivals < 4) {
			if (++arrivals === 4) release()
			await ready
		}
		return sql(stmt, args)
	}
	let email = ""
	const accountId = randomUUID()
	const auth = makeAuth({
		plugins: [
			{
				id: "disposable-google-callback",
				endpoints: {
					testGoogleCallback: createAuthEndpoint(
						"/test-google-callback",
						{ method: "POST", body: z.object({ accessToken: z.string() }) },
						async (ctx) =>
							ctx.json(
								await handleOAuthUserInfo(ctx, {
									userInfo: {
										id: accountId,
										email,
										name: "Member",
										emailVerified: true,
									},
									account: {
										providerId: "google",
										accountId,
										accessToken: ctx.body.accessToken,
									},
									callbackURL: "/",
								}),
							),
					),
				},
			},
		],
		database: crateAuthAdapter({ sql: racingSql, encryptionSecret: secret }),
		socialProviders: {
			google: {
				clientId: "disposable-client",
				clientSecret: "disposable-secret",
			},
		},
	})
	const context = await auth.$context
	const user = await context.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	email = user.email
	await context.internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId,
	})
	const results = await Promise.all(
		Array.from({ length: 4 }, async (_, i) => {
			const response = await auth.handler(
				new Request("http://localhost:3000/api/auth/test-google-callback", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						origin: "http://localhost:3000",
					},
					body: JSON.stringify({ accessToken: `fresh-google-${i}` }),
				}),
			)
			expect(response.status).toBe(200)
			return response.json()
		}),
	)
	expect(arrivals).toBe(4)
	for (const result of results) {
		expect(result.error).toBeNull()
		expect(result.data?.session.userId).toBe(user.id)
	}
	const account = await context.internalAdapter.findAccountByKey({
		providerId: "google",
		accountId,
	})
	if (!account) throw new Error("Linked account disappeared")
	await expect(
		context.internalAdapter.updateAccount(account.id, { providerId: "github" }),
	).rejects.toThrow("lookup keys are immutable")
})

test("sign-out wins a race with session refresh and does not resurrect the session", async () => {
	let refresh: (() => Promise<unknown>) | undefined
	const raceSql: AuthSql = async (stmt, args = []) => {
		if (refresh && stmt.startsWith("UPDATE doc.auth_session ")) {
			const action = refresh
			refresh = undefined
			await action()
		}
		return sql(stmt, args)
	}
	const auth = makeAuth({
		database: crateAuthAdapter({ sql: raceSql, encryptionSecret: secret }),
		session: { updateAge: 0 },
	})
	const ctx = await auth.$context
	const user = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const session = await ctx.internalAdapter.createSession(user.id)
	const other = await makeAuth().$context
	refresh = () =>
		other.internalAdapter.updateSession(session.token, {
			expiresAt: new Date(Date.now() + 600000),
		})
	expect(
		await auth.api.signOut({ headers: cookieHeaders(session.token) }),
	).toEqual({ success: true })
	expect(
		await auth.api.getSession({ headers: cookieHeaders(session.token) }),
	).toBeNull()
	expect(
		await other.internalAdapter.updateSession(session.token, {
			expiresAt: new Date(Date.now() + 600000),
		}),
	).toBeNull()
})

test("Better Auth receives a deterministic CrateDB refusal rather than an indeterminate outcome", async () => {
	let refuse = false
	const rejectingSql: AuthSql = async (stmt, args = []) =>
		refuse && stmt.startsWith("UPDATE doc.auth_account ")
			? sql("UPDATE doc.auth_account SET lookup['clientId'] = ? WHERE id = ?", [
					"x".repeat(40000),
					args[6],
				])
			: sql(stmt, args)
	const ctx = await makeAuth({
		database: crateAuthAdapter({ sql: rejectingSql, encryptionSecret: secret }),
	}).$context
	const user = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const account = await ctx.internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId: randomUUID(),
	})
	refuse = true
	await expect(
		ctx.internalAdapter.updateAccount(account.id, { accessToken: "fresh" }),
	).rejects.toMatchObject({ code: 4000 })
})

test("Better Auth deletion and email changes release addresses for a new member", async () => {
	const auth = makeAuth({ user: { deleteUser: { enabled: true } } })
	const ctx = await auth.$context
	const email = `${randomUUID()}@test.invalid`
	const user = await ctx.internalAdapter.createUser(
		{
			email,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const nextEmail = `${randomUUID()}@test.invalid`
	await ctx.internalAdapter.updateUser(user.id, { email: nextEmail })
	expect(
		(
			await ctx.internalAdapter.createUser(
				{
					email: email.toUpperCase(),
					name: "New owner",
					emailVerified: true,
				},
				{ method: "email-password" },
			)
		).id,
	).not.toBe(user.id)
	const session = await ctx.internalAdapter.createSession(user.id)
	expect(
		(
			await auth.api.deleteUser({
				headers: cookieHeaders(session.token),
				body: {},
			})
		).success,
	).toBe(true)
	expect(
		(
			await ctx.internalAdapter.createUser(
				{
					email: nextEmail,
					name: "Returning member",
					emailVerified: true,
				},
				{ method: "email-password" },
			)
		).id,
	).not.toBe(user.id)
})

test("password reset identifiers are hashed at rest while real reset links still work", async () => {
	let resetToken = ""
	const auth = makeAuth({
		emailAndPassword: {
			enabled: true,
			sendResetPassword: async ({ token }) => {
				resetToken = token
			},
		},
	})
	const email = `${randomUUID()}@test.invalid`
	await auth.api.signUpEmail({
		body: { email, name: "Member", password: "initial-password-548" },
	})
	await auth.api.requestPasswordReset({ body: { email } })
	expect(resetToken).toBeTypeOf("string")
	await sql("REFRESH TABLE doc.auth_verification")
	const identifiers = await sql(
		"SELECT lookup['identifier'] FROM doc.auth_verification WHERE deleted=false",
	)
	expect(
		identifiers.rows.flat().some((value) => String(value).includes(resetToken)),
	).toBe(false)
	expect(
		await auth.api.resetPassword({
			body: { token: resetToken, newPassword: "replacement-password-548" },
		}),
	).toEqual({ status: true })
	expect(
		(
			await auth.api.signInEmail({
				body: { email, password: "replacement-password-548" },
			})
		).user.email,
	).toBe(email)
})

test("account deletion erases profile and Google tokens and a flipped tombstone cannot restore a session", async () => {
	const auth = makeAuth({ user: { deleteUser: { enabled: true } } })
	const ctx = await auth.$context
	const user = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member".repeat(1000),
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const account = await ctx.internalAdapter.createAccount({
		userId: user.id,
		providerId: "google",
		accountId: randomUUID(),
		accessToken: "google-access".repeat(1000),
		refreshToken: "google-refresh".repeat(1000),
		idToken: "google-id".repeat(1000),
	})
	const session = await ctx.internalAdapter.createSession(user.id)
	await auth.api.deleteUser({
		headers: cookieHeaders(session.token),
		body: {},
	})
	for (const [table, id] of [
		["user", user.id],
		["account", account.id],
		["session", session.id],
	]) {
		const result = await sql(
			`SELECT payload,lookup,receipts FROM doc.auth_${table} WHERE id=?`,
			[id],
		)
		expect(String(result.rows[0][0]).length).toBeLessThan(400)
		expect(
			Object.values(result.rows[0][1] as Record<string, unknown>).every(
				(value) => value === null,
			),
		).toBe(true)
		expect(String(result.rows[0][2]).length).toBeLessThan(20000)
	}
	await sql("UPDATE doc.auth_session SET deleted=false WHERE id=?", [
		session.id,
	])
	expect(
		await auth.api.getSession({ headers: cookieHeaders(session.token) }),
	).toBeNull()
})

import { crateAuthTransport } from "../../../app/server/auth/crate-adapter.server.ts"
test("Better Auth can use a dedicated CrateDB username and password and skip an unreachable coordinator", async () => {
	const username = `auth_test_${randomUUID().replace(/-/g, "")}`
	const password = randomUUID()
	await sql(`CREATE USER ${username} WITH (password=?)`, [password])
	const tables = (
		await sql(
			"SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name LIKE 'auth_%'",
		)
	).rows
	for (const [name] of tables)
		await sql(`GRANT DQL,DML ON TABLE doc.${name} TO ${username}`)
	try {
		const authenticated = crateAuthTransport(
			["http://127.0.0.1:49999", "http://127.0.0.1:15748"],
			5000,
			{ username, password },
		)
		expect((await authenticated("SELECT CURRENT_USER")).rows[0][0]).toBe(
			username,
		)
		const auth = makeAuth({
			database: crateAuthAdapter({
				sql: authenticated,
				encryptionSecret: secret,
			}),
		})
		const member = await auth.api.signUpEmail({
			body: {
				email: `${randomUUID()}@test.invalid`,
				name: "Member",
				password: "test-password-548",
			},
			returnHeaders: true,
		})
		const cookie = member.headers.get("set-cookie")
		if (!cookie) throw new Error("Sign-up did not set a session cookie")
		const headers = new Headers({ cookie: cookie.split(";")[0] })
		expect((await auth.api.getSession({ headers }))?.user.id).toBe(
			member.response.user.id,
		)
	} finally {
		await sql(`DROP USER ${username}`)
	}
})

test("logout revokes every captured OAuth token when a concurrent rotation revokes the first one", async () => {
	let rotate: ((id: string) => Promise<unknown>) | undefined
	const racingSql: AuthSql = async (stmt, args = []) => {
		if (rotate && stmt.startsWith("UPDATE doc.auth_oauth_refresh_token ")) {
			const action = rotate
			rotate = undefined
			await action(String(args[6]))
		}
		return sql(stmt, args)
	}
	const plugins = () => [
		oauthProvider({
			loginPage: "/login",
			consentPage: "/consent",
			disableJwtPlugin: true,
		}),
	]
	const auth = makeAuth({
		database: crateAuthAdapter({ sql: racingSql, encryptionSecret: secret }),
		plugins: plugins(),
	})
	const ctx = await auth.$context
	const other = await makeAuth({ plugins: plugins() }).$context
	const user = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const session = await ctx.internalAdapter.createSession(user.id)
	const clientId = randomUUID()
	await ctx.adapter.create({
		model: "oauthClient",
		data: {
			clientId,
			name: "RP",
			redirectUris: ["http://localhost/callback"],
			createdAt: new Date(),
		},
	})
	const tokens = await Promise.all(
		Array.from({ length: 10 }, async () => {
			const token = randomUUID()
			await ctx.adapter.create({
				model: "oauthRefreshToken",
				data: {
					token,
					clientId,
					userId: user.id,
					sessionId: session.id,
					scopes: ["openid"],
					createdAt: new Date(),
					expiresAt: new Date(Date.now() + 600000),
				},
			})
			return token
		}),
	)
	rotate = (id) =>
		other.adapter.incrementOne({
			model: "oauthRefreshToken",
			where: [
				{ field: "id", value: id },
				{ field: "revoked", value: null },
			],
			increment: {},
			set: { revoked: new Date(), rotatedAt: new Date() },
		})
	expect(
		await auth.api.signOut({ headers: cookieHeaders(session.token) }),
	).toEqual({ success: true })
	expect(rotate).toBeUndefined()
	for (const token of tokens)
		expect(
			(
				await ctx.adapter.findOne<{ revoked?: Date }>({
					model: "oauthRefreshToken",
					where: [{ field: "token", value: token }],
				})
			)?.revoked,
		).toBeInstanceOf(Date)
})

test("a delayed email release cannot delete a claim adopted again by the same member", async () => {
	let reAdopt: (() => Promise<unknown>) | undefined
	const delayedSql: AuthSql = async (stmt, args = []) => {
		if (reAdopt && stmt.startsWith("DELETE FROM doc.auth_user_email ")) {
			const action = reAdopt
			reAdopt = undefined
			await action()
		}
		return sql(stmt, args)
	}
	const ctx = await makeAuth({
		database: crateAuthAdapter({ sql: delayedSql, encryptionSecret: secret }),
	}).$context
	const other = await makeAuth().$context
	const email = `${randomUUID()}@test.invalid`
	const next = `${randomUUID()}@test.invalid`
	const user = await ctx.internalAdapter.createUser(
		{
			email,
			name: "Member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	reAdopt = () => other.internalAdapter.updateUser(user.id, { email })
	await ctx.internalAdapter.updateUser(user.id, { email: next })
	expect(
		(await ctx.internalAdapter.findUserByEmail(email.toUpperCase()))?.user.id,
	).toBe(user.id)
	await expect(
		ctx.internalAdapter.createUser(
			{
				email,
				name: "Other member",
				emailVerified: true,
			},
			{ method: "email-password" },
		),
	).rejects.toMatchObject({ code: "23505" })
	expect(
		(
			await ctx.internalAdapter.createUser(
				{
					email: next,
					name: "Other member",
					emailVerified: true,
				},
				{ method: "email-password" },
			)
		).email,
	).toBe(next)
})

test("database rate limiting survives 300 requests through the real Better Auth handler", async () => {
	const auth = makeAuth({
		rateLimit: { enabled: true, storage: "database", max: 500, window: 3600 },
	})
	const ip = `2001:db8:${randomUUID().replace(/-/g, "").slice(0, 24).match(/.{4}/g)?.join(":")}`
	for (let i = 0; i < 300; i++) {
		const response = await auth.handler(
			new Request("http://localhost:3000/api/auth/get-session", {
				headers: { "x-forwarded-for": ip },
			}),
		)
		expect(response.status).toBe(200)
	}
})

test("a Better Auth user-id collision releases the rejected new email for signup", async () => {
	const auth = makeAuth()
	const ctx = await auth.$context
	const original = await ctx.internalAdapter.createUser(
		{
			email: `${randomUUID()}@test.invalid`,
			name: "Original member",
			emailVerified: true,
		},
		{ method: "email-password" },
	)
	const email = `${randomUUID()}@test.invalid`
	await expect(
		ctx.internalAdapter.createUser(
			{ id: original.id, email, name: "Rejected import", emailVerified: true },
			{ method: "email-password" },
		),
	).rejects.toMatchObject({ code: "23505" })
	expect(
		(await ctx.internalAdapter.findUserByEmail(original.email))?.user.id,
	).toBe(original.id)
	const signup = await auth.api.signUpEmail({
		body: { email, name: "New member", password: "new-member-password-548" },
	})
	expect(signup.user.email).toBe(email)
	expect(signup.user.id).not.toBe(original.id)
	expect((await ctx.internalAdapter.findUserByEmail(email))?.user.id).toBe(
		signup.user.id,
	)
})
