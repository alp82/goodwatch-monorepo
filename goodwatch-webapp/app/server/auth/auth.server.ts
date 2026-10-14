import { createHash, randomUUID } from "node:crypto"
import { type BetterAuthOptions, betterAuth } from "@goodwatch/auth-stack"
import {
	APIError,
	createAuthMiddleware,
	createEmailVerificationToken,
	getIP,
} from "@goodwatch/auth-stack/api"
import { cimd } from "@goodwatch/auth-stack/cimd"
import { fetchClientMetadataResource } from "@goodwatch/auth-stack/cimd-node"
import { setSessionCookie } from "@goodwatch/auth-stack/cookies"
import { hashPassword, verifyPassword } from "@goodwatch/auth-stack/crypto"
import { mcp } from "@goodwatch/auth-stack/mcp"
import { jwt } from "@goodwatch/auth-stack/plugins"
import { compare } from "bcryptjs"
import { decodeJwt, jwtVerify } from "jose"
import { type AuthSql, crateAuthAdapter } from "./crate-adapter.server.ts"
import type { AuthMailQueue } from "./mail.server.ts"
import type { ValkeyAuthStorage } from "./secondary-storage.server.ts"

export function createGoodwatchAuth(options: {
	sql: AuthSql
	storage: ValkeyAuthStorage
	mail: AuthMailQueue
	baseURL: string
	secret: string
	encryptionSecret?: string
	trustedIpHeader?: string
	rateLimit?: BetterAuthOptions["rateLimit"]
	mcp?: { resource: string; accessTokenExpiresIn?: number }
	google: { clientId: string; clientSecret: string }
}) {
	const { mail } = options
	const tokenHash = (token: string) =>
		createHash("sha256").update(token).digest("base64url")
	const core = betterAuth({
		baseURL: options.baseURL,
		secret: options.secret,
		basePath: "/api/auth",
		database: crateAuthAdapter({
			sql: options.sql,
			encryptionSecret: options.encryptionSecret,
			populationBounds: true,
		}),
		plugins: options.mcp
			? [
					jwt(),
					mcp({
						loginPage: "/auth/mcp/login",
						consentPage: "/auth/mcp/consent",
						resource: options.mcp.resource,
						scopes: [
							"openid",
							"profile",
							"email",
							"mcp:read",
							"mcp:write",
							"offline_access",
						],
						postLogin: {
							page: "/auth/mcp/consent",
							shouldRedirect: async () => false,
							consentReferenceId: async ({ session }) => session?.id,
						},
						extensions: [
							{
								claims: {
									accessToken: async ({ ctx, user, client, referenceId }) => {
										if (!user)
											throw new APIError("BAD_REQUEST", {
												error: "invalid_grant",
											})
										const consent = await ctx.context.adapter.findOne<{
											id: string
											grantVersion: string
										}>({
											model: "oauthConsent",
											where: [
												{ field: "clientId", value: client.clientId },
												{ field: "userId", value: user.id },
												...(referenceId
													? [{ field: "referenceId", value: referenceId }]
													: []),
											],
										})
										if (!consent?.grantVersion)
											throw new APIError("BAD_REQUEST", {
												error: "invalid_grant",
											})
										return {
											gw_grant_id: consent.id,
											gw_grant_version: consent.grantVersion,
										}
									},
								},
							},
						],
						storeTokens: { hash: async (token) => tokenHash(token) },
						grantTypes: ["authorization_code", "refresh_token"],
						clientPrivileges: async () => false,
						resourcePrivileges: async () => false,
						allowDynamicClientRegistration: true,
						allowUnauthenticatedClientRegistration: true,
						accessTokenExpiresIn: options.mcp.accessTokenExpiresIn ?? 300,
						refreshTokenExpiresIn: 90 * 86400,
					}),
					cimd({
						metadataProfile: "mcp-2026-07-28",
						fetchClientMetadataResource,
					}),
					{
						id: "goodwatch-mcp-grants",
						schema: {
							oauthRefreshToken: {
								fields: {
									grantVersion: {
										type: "string",
										required: false,
										input: false,
									},
								},
							},
							oauthConsent: {
								fields: {
									grantVersion: {
										type: "string",
										required: true,
										input: false,
										defaultValue: () => randomUUID(),
									},
									lastUsedAt: { type: "date", required: false, input: false },
								},
							},
						},
					},
				]
			: [],
		secondaryStorage: {
			get: async (key): Promise<string | null> => {
				const cached = await options.storage.get(key)
				if (!cached) return null
				const parsed = JSON.parse(cached)
				if (parsed?.session?.token !== key) return cached
				// Valkey's session index can be evicted. Every session read checks the DB
				// mirror, including API session middleware; a missing index cannot undo revocation.
				const context = await core.$context
				const session = await context.adapter.findOne<{
					token: string
					userId: string
					expiresAt: Date
				}>({ model: "session", where: [{ field: "token", value: key }] })
				if (!session || new Date(session.expiresAt).getTime() <= Date.now())
					return null
				const user = await context.adapter.findOne({
					model: "user",
					where: [{ field: "id", value: session.userId }],
				})
				return user ? JSON.stringify({ session, user }) : null
			},
			set: (key, value, ttl) => options.storage.set(key, value, ttl),
			delete: (key) => options.storage.delete(key),
			getAndDelete: (key) => options.storage.getAndDelete(key),
			increment: (key, ttl) => options.storage.increment(key, ttl),
		},
		verification: { storeInDatabase: true, storeIdentifier: "hashed" },
		user: {
			additionalFields: {
				confirmationDigest: {
					type: "string",
					required: false,
					input: false,
					returned: false,
				},
			},
		},
		advanced: {
			cookiePrefix: "gw",
			ipAddress: {
				ipAddressHeaders: [options.trustedIpHeader ?? "x-forwarded-for"],
			},
			database: { generateId: "uuid", defaultFindManyLimit: 10000 },
			cookies: { session_token: { name: "gw.session_token" } },
		},
		session: {
			expiresIn: 90 * 86400,
			updateAge: 86400,
			storeSessionInDatabase: true,
			preserveSessionInDatabase: false,
			cookieCache: { enabled: false },
		},
		rateLimit: options.rateLimit,
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 10,
			requireEmailVerification: true,
			password: {
				hash: hashPassword,
				verify: async (data) => {
					try {
						return data.hash.startsWith("$2")
							? await compare(
									data.password,
									data.hash.replace(/^\$2y\$/, "$2b$"),
								)
							: await verifyPassword(data)
					} catch {
						return false
					}
				},
			},
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: async ({ user, url }) => {
				mail.enqueue(
					user.email,
					"Reset your GoodWatch password",
					`Choose a new password for GoodWatch.\n\n${url}\n`,
				)
			},
			onPasswordReset: async ({ user }) => {
				mail.enqueue(
					user.email,
					"Your GoodWatch password changed",
					"Your GoodWatch password changed. Other devices have been signed out. If you did not make this change, reset your password immediately.",
				)
			},
			onExistingUserSignUp: async ({ user }) => {
				mail.enqueue(
					user.email,
					"You already have a GoodWatch account",
					"Someone tried to create a GoodWatch account with this email. You can sign in to your existing account or request a password reset. If this was not you, you can ignore this email.",
				)
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendOnSignIn: false,
			expiresIn: 86400,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }): Promise<void> => {
				const token = await createEmailVerificationToken(
					options.secret,
					user.email,
					undefined,
					86400,
					{ jti: randomUUID() },
				)
				const context = await core.$context
				const digest = createHash("sha256").update(token).digest("hex")
				const updated = await context.adapter.update({
					model: "user",
					where: [{ field: "id", value: user.id }],
					update: { confirmationDigest: digest },
				})
				if (!updated) throw new Error("Confirmation issuance conflicted")
				const confirmation = new URL(url)
				confirmation.searchParams.set("token", token)
				mail.enqueue(
					user.email,
					"Confirm your GoodWatch email",
					`Confirm your email to start using GoodWatch. This link lasts 24 hours. Only the newest link works.\n\n${confirmation}\n`,
				)
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (
					options.mcp &&
					ctx.path === "/oauth2/token" &&
					ctx.body?.grant_type === "refresh_token"
				) {
					const invalid = () =>
						new APIError("BAD_REQUEST", {
							error: "invalid_grant",
							error_description: "App permission is no longer active",
						})
					if (typeof ctx.body.refresh_token !== "string") throw invalid()
					const token = await ctx.context.adapter.findOne<{
						clientId: string
						userId: string
						scopes: string[]
						resources?: string[]
						referenceId?: string
						grantVersion?: string
					}>({
						model: "oauthRefreshToken",
						where: [
							{ field: "token", value: tokenHash(ctx.body.refresh_token) },
						],
					})
					if (!token) throw invalid()
					const [consent, user] = await Promise.all([
						ctx.context.adapter.findOne<{
							scopes: string[]
							resources?: string[]
							grantVersion: string
						}>({
							model: "oauthConsent",
							where: [
								{ field: "clientId", value: token.clientId },
								{ field: "userId", value: token.userId },
								...(token.referenceId
									? [{ field: "referenceId", value: token.referenceId }]
									: []),
							],
						}),
						ctx.context.adapter.findOne<{ emailVerified: boolean }>({
							model: "user",
							where: [{ field: "id", value: token.userId }],
						}),
					])
					if (
						!user?.emailVerified ||
						!consent ||
						!token.grantVersion ||
						token.grantVersion !== consent.grantVersion ||
						!token.scopes.every((scope) => consent.scopes.includes(scope)) ||
						!token.resources?.every((resource) =>
							consent.resources?.includes(resource),
						)
					)
						throw invalid()
				}

				if (
					["/request-password-reset", "/send-verification-email"].includes(
						ctx.path,
					) &&
					typeof ctx.body?.email === "string"
				) {
					const address = createHash("sha256")
						.update(ctx.body.email.trim().toLowerCase())
						.digest("hex")
					const ip = createHash("sha256")
						.update(
							getIP(
								ctx.request ?? ctx.headers ?? new Headers(),
								ctx.context.options,
							) ?? "unknown",
						)
						.digest("hex")
					const [perAddress, perIp] = await Promise.all([
						options.storage.increment(`mail-address:${address}`, 3600),
						options.storage.increment(`mail-ip:${ip}`, 3600),
					])
					if (perAddress > 5 || perIp > 30)
						throw new APIError("TOO_MANY_REQUESTS", {
							message: "Please wait before requesting another email.",
						})
				}
				if (
					ctx.path === "/request-password-reset" &&
					typeof ctx.body?.email === "string"
				) {
					const found = await ctx.context.internalAdapter.findUserByEmail(
						ctx.body.email,
					)
					if (
						found &&
						!(await ctx.context.internalAdapter.findCredentialAccount(
							found.user.id,
						))
					) {
						mail.enqueue(
							found.user.email,
							"You sign in with Google",
							"You use Google to sign in to GoodWatch. Choose Continue with Google on the sign-in page. You do not need to reset a password.",
						)
						return ctx.json({
							status: true,
							message:
								"If this email exists in our system, check your email for the reset link",
						})
					}
				}
				if (ctx.path === "/change-password") ctx.body.revokeOtherSessions = true
				if (ctx.path === "/reset-password") {
					const token = ctx.body?.token ?? ctx.query?.token
					if (typeof token === "string") {
						const verification =
							await ctx.context.internalAdapter.findVerificationValue(
								`reset-password:${token}`,
							)
						if (verification)
							Object.assign(ctx.context, { resetUserId: verification.value })
					}
				}
				if (ctx.path !== "/verify-email") return
				const token = ctx.query?.token
				const invalid = () =>
					new APIError("UNAUTHORIZED", {
						message: "Confirmation link is invalid or expired.",
					})
				if (typeof token !== "string") throw invalid()
				if (
					ctx.query?.callbackURL &&
					new URL(ctx.query.callbackURL, options.baseURL).origin !==
						new URL(options.baseURL).origin
				)
					throw invalid()
				let email: unknown
				try {
					email = (
						await jwtVerify(token, new TextEncoder().encode(options.secret), {
							algorithms: ["HS256"],
						})
					).payload.email
				} catch {
					throw invalid()
				}
				if (typeof email !== "string") throw invalid()
				const user = await ctx.context.adapter.findOne<{ id: string }>({
					model: "user",
					where: [{ field: "email", value: email }],
				})
				if (!user) throw invalid()
				const consumed = await ctx.context.adapter.incrementOne({
					model: "user",
					where: [
						{ field: "id", value: user.id },
						{
							field: "confirmationDigest",
							value: createHash("sha256").update(token).digest("hex"),
						},
					],
					increment: {},
					set: { confirmationDigest: null },
				})
				if (!consumed) throw invalid()
			}),
			after: createAuthMiddleware(async (ctx) => {
				if (
					ctx.path === "/change-password" &&
					(ctx.context.returned as { token?: string })?.token &&
					ctx.context.session
				) {
					mail.enqueue(
						ctx.context.session.user.email,
						"Your GoodWatch password changed",
						"Your GoodWatch password changed. Other devices have been signed out. If you did not make this change, reset your password immediately.",
					)
				}
				if (
					ctx.path === "/reset-password" &&
					(ctx.context.returned as { status?: boolean })?.status === true
				) {
					const userId = (
						ctx.context as typeof ctx.context & { resetUserId?: string }
					).resetUserId
					if (!userId) throw new Error("Reset identity missing")
					const user = await ctx.context.internalAdapter.findUserById(userId)
					const session =
						await ctx.context.internalAdapter.createSession(userId)
					if (!user || !session)
						throw new Error("Reset session issuance failed")
					await setSessionCookie(ctx, { user, session })
				}
				if (ctx.path !== "/sign-in/email" || !ctx.context.newSession) return
				const userId = ctx.context.newSession.user.id
				const account =
					await ctx.context.internalAdapter.findCredentialAccount(userId)
				if (account?.password?.startsWith("$2")) {
					const upgraded = await ctx.context.adapter.incrementOne({
						model: "account",
						where: [
							{ field: "id", value: account.id },
							{ field: "password", value: account.password },
						],
						increment: {},
						set: { password: await hashPassword(ctx.body.password) },
					})
					if (!upgraded) {
						const current =
							await ctx.context.internalAdapter.findCredentialAccount(userId)
						if (
							!current?.password ||
							!(await ctx.context.password.verify({
								hash: current.password,
								password: ctx.body.password,
							}))
						) {
							await ctx.context.internalAdapter.deleteSession(
								ctx.context.newSession.session.token,
							)
							throw new APIError("UNAUTHORIZED", {
								message: "Unable to sign in.",
							})
						}
					}
				}
			}),
		},
		socialProviders: { google: options.google },
		account: {
			encryptOAuthTokens: true,
			accountLinking: {
				enabled: true,
				trustedProviders: [],
				requireLocalEmailVerified: true,
			},
		},
		databaseHooks: {
			session: {
				create: {
					before: async (session, context) => {
						if (!context)
							throw new Error(
								"Auth request context required for session creation",
							)
						const user = await context.context.internalAdapter.findUserById(
							session.userId,
						)
						if (!user?.emailVerified)
							throw new APIError("FORBIDDEN", {
								message: "Confirm your email before signing in.",
							})
						return { data: session }
					},
				},
			},
		},
		logger: { disabled: true },
	})
	return {
		...core,
		handler: async (request: Request) => {
			const response = await core.handler(request)
			const path = new URL(request.url).pathname
			if (options.mcp && path === "/api/auth/oauth2/token" && response.ok) {
				try {
					const pair = await response.clone().json()
					if (pair.refresh_token) {
						const payload = decodeJwt(pair.access_token)
						if (
							typeof payload.gw_grant_id !== "string" ||
							typeof payload.gw_grant_version !== "string"
						)
							throw new Error("Grant binding missing")
						const context = await core.$context
						const consent = await context.adapter.findOne<{
							grantVersion: string
						}>({
							model: "oauthConsent",
							where: [{ field: "id", value: payload.gw_grant_id }],
						})
						if (!consent || consent.grantVersion !== payload.gw_grant_version)
							throw new Error("Grant changed during issuance")
						const token = await context.adapter.findOne<{
							id: string
							grantVersion?: string
						}>({
							model: "oauthRefreshToken",
							where: [{ field: "token", value: tokenHash(pair.refresh_token) }],
						})
						if (!token) throw new Error("Refresh issuance missing")
						if (!token.grantVersion) {
							const bound = await context.adapter.incrementOne({
								model: "oauthRefreshToken",
								where: [
									{ field: "id", value: token.id },
									{ field: "grantVersion", value: null },
								],
								increment: {},
								set: { grantVersion: consent.grantVersion },
							})
							if (!bound) throw new Error("Refresh binding conflicted")
						} else if (token.grantVersion !== consent.grantVersion)
							throw new Error("Refresh binding changed")
					}
				} catch {
					return Response.json(
						{ error: "temporarily_unavailable" },
						{ status: 503 },
					)
				}
			}
			if (response.status >= 500)
				return Response.json(
					{ message: "Sign-in is temporarily unavailable." },
					{ status: 503 },
				)
			if (
				path === "/api/auth/sign-in/email" &&
				[401, 403].includes(response.status)
			)
				return Response.json(
					{
						message:
							"Unable to sign in. Check your details and confirmation email.",
					},
					{ status: 401 },
				)
			if (path === "/api/auth/sign-up/email" && response.ok)
				return Response.json({
					status: true,
					message: "Check your inbox to continue.",
				})
			return response
		},
	}
}
