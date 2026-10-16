import { createHash, randomBytes, randomUUID } from "node:crypto"
import { type BetterAuthOptions, betterAuth } from "@goodwatch/auth-stack"
import {
	APIError,
	createAuthMiddleware,
	createEmailVerificationToken,
	getIP,
	getSessionFromCtx,
} from "@goodwatch/auth-stack/api"
import { cimd } from "@goodwatch/auth-stack/cimd"
import { fetchClientMetadataResource } from "@goodwatch/auth-stack/cimd-node"
import {
	deleteSessionCookie,
	setSessionCookie,
} from "@goodwatch/auth-stack/cookies"
import { hashPassword, verifyPassword } from "@goodwatch/auth-stack/crypto"
import { mcp } from "@goodwatch/auth-stack/mcp"
import { jwt } from "@goodwatch/auth-stack/plugins"
import { compare } from "bcryptjs"
import { decodeJwt, jwtVerify } from "jose"
import {
	type AuthSql,
	crateAuthAdapter,
	localAuthEncryptionSecret,
} from "./crate-adapter.server.ts"
import type { AuthMailQueue } from "./mail.server.ts"
import {
	type AuthEmail,
	accountDeletedEmail,
	confirmEmail,
	deleteAccountEmail,
	existingAccountEmail,
	googleOnlyEmail,
	passwordChangedEmail,
	resetPasswordEmail,
} from "./emails.server.ts"
import {
	type AuthEncryptionKeys,
	authCredentialVersion,
} from "./payload-codec.server.ts"
import { maxMemberSessions } from "./population.server.ts"
import type { ValkeyAuthStorage } from "./secondary-storage.server.ts"

// Not Response.json: remix-serve's polyfilled Response (no v3_singleFetch) has no static json().
export function jsonResponse(body: unknown, init: ResponseInit = {}) {
	const headers = new Headers(init.headers)
	headers.set("Content-Type", "application/json")
	return new Response(JSON.stringify(body), { ...init, headers })
}

// remix-serve's polyfilled Headers (no v3_singleFetch) has no getSetCookie(); its raw() keeps the cookies apart.
export function setCookiesOf(headers: Headers): string[] {
	if (typeof headers.getSetCookie === "function") return headers.getSetCookie()
	const raw = (
		headers as Headers & { raw?: () => Record<string, string[]> }
	).raw?.()
	return raw?.["set-cookie"] ?? []
}

export function createGoodwatchAuth(options: {
	sql: AuthSql
	storage: ValkeyAuthStorage
	mail: AuthMailQueue
	baseURL: string
	secret: string
	encryptionSecret?: string
	encryptionKeys?: AuthEncryptionKeys
	trustedIpHeader?: string
	rateLimit?: BetterAuthOptions["rateLimit"]
	mcp?: { resource: string; accessTokenExpiresIn?: number }
	google: { clientId: string; clientSecret: string }
	/**
	 * Account deletion (#553), on only with the webapp's member data deletion: deleting the sign-in rows without the
	 * member's data would strand it. `linkSeconds`: how long an emailed confirmation link works (one hour).
	 */
	accountDeletion?: {
		deleteMemberData: (userId: string) => Promise<void>
		linkSeconds?: number
	}
}) {
	const { mail, accountDeletion } = options
	const origin = new URL(options.baseURL).origin
	const send = (to: string, message: AuthEmail) =>
		mail.enqueue(to, message.subject, message.text, message.html)
	const refreshGrants = new WeakMap<Request, { id: string; version: string }>()
	const credentialVersion = (password: string | null) =>
		authCredentialVersion(
			options.encryptionSecret ?? localAuthEncryptionSecret,
			password,
		)
	const verifyCurrentPassword = async (hash: string, password: string) => {
		try {
			return hash.startsWith("$2")
				? await compare(password, hash.replace(/^\$2y\$/, "$2b$"))
				: await verifyPassword({ hash, password })
		} catch {
			return false
		}
	}
	const tokenHash = (token: string) =>
		createHash("sha256").update(token).digest("base64url")
	const memberKey = (userId: string) =>
		createHash("sha256").update(userId).digest("hex")
	// Account deletion (#553), before the member's data goes: every app grant (Connected apps) with its refresh
	// tokens, the apps the member registered, and every session, so no device or app writes while the data is
	// deleted. Deleting refresh tokens by client and member closes the grant's version first (#565), so a token
	// issued meanwhile cannot outlive it; the MCP verifier then refuses the grant's access tokens.
	const revokeMemberAccess = async (userId: string) => {
		const context = await core.$context
		if (options.mcp) {
			const consents = await context.adapter.findMany<{
				id: string
				clientId: string
			}>({ model: "oauthConsent", where: [{ field: "userId", value: userId }] })
			for (const consent of consents) {
				await context.adapter.deleteMany({
					model: "oauthRefreshToken",
					where: [
						{ field: "clientId", value: consent.clientId },
						{ field: "userId", value: userId },
					],
				})
				await context.adapter.delete({
					model: "oauthConsent",
					where: [{ field: "id", value: consent.id }],
				})
			}
			const clients = await context.adapter.findMany<{ clientId: string }>({
				model: "oauthClient",
				where: [{ field: "userId", value: userId }],
			})
			for (const client of clients)
				await context.adapter.delete({
					model: "oauthClient",
					where: [{ field: "clientId", value: client.clientId }],
				})
		}
		await context.internalAdapter.deleteUserSessions(userId)
	}
	const core = betterAuth({
		baseURL: options.baseURL,
		secret: options.secret,
		basePath: "/api/auth",
		database: crateAuthAdapter({
			sql: options.sql,
			encryptionSecret: options.encryptionSecret,
			encryptionKeys: options.encryptionKeys,
			populationBounds: true,
			enforceGrantRevocation: true,
			validateSessionCredentials: true,
			onSessionRevoked: (token) => options.storage.delete(token),
		}),
		plugins: options.mcp
			? [
					jwt({ jwks: { rotationInterval: 30 * 86400, gracePeriod: 86400 } }),
					mcp({
						// The site's sign-in page; it sends the signed query back with the sign-in (#570).
						loginPage: "/sign-in",
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
									accessToken: async ({
										ctx,
										user,
										client,
										referenceId,
										grantType,
									}) => {
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
										const expected = ctx.request
											? refreshGrants.get(ctx.request)
											: undefined
										if (
											grantType === "refresh_token" &&
											(!expected ||
												expected.id !== consent?.id ||
												expected.version !== consent?.grantVersion)
										)
											throw new APIError("BAD_REQUEST", {
												error: "invalid_grant",
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
						refreshTokenReuseInterval: 30,
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
			set: (key, value, ttl) => {
				let storedValue = value
				if (key.startsWith("active-sessions-")) {
					const references = JSON.parse(value)
					if (!Array.isArray(references))
						throw new Error("Invalid auth session index")
					storedValue = JSON.stringify(references.slice(-maxMemberSessions))
				}
				return options.storage.set(key, storedValue, ttl)
			},
			delete: (key) => options.storage.delete(key),
			getAndDelete: (key) => options.storage.getAndDelete(key),
			increment: (key, ttl) => options.storage.increment(key, ttl),
		},
		// Expiry cleanup is paged by maintenance, never by a login/reset request.
		verification: {
			storeInDatabase: true,
			storeIdentifier: "hashed",
			disableCleanup: true,
		},
		user: {
			additionalFields: {
				confirmationDigest: {
					type: "string",
					required: false,
					input: false,
					returned: false,
				},
			},
			// #553: `POST /delete-user` with the password deletes at once (the before hook turns a correct password into a
			// one-minute token); without one it emails a link to /delete-account, whose button posts the token. Google-only
			// members have no password, so they confirm by email. The GET callback is closed: opening a link never deletes.
			deleteUser: accountDeletion
				? {
						enabled: true,
						deleteTokenExpiresIn: accountDeletion.linkSeconds ?? 3600,
						sendDeleteAccountVerification: async ({ user, token }) => {
							send(
								user.email,
								deleteAccountEmail(
									user.email,
									`${origin}/delete-account?token=${encodeURIComponent(token)}`,
								),
							)
						},
						beforeDelete: async (user) => {
							await revokeMemberAccess(user.id)
							await accountDeletion.deleteMemberData(user.id)
						},
						afterDelete: async (user) => {
							// The account is gone either way: a failure here leaves rows that a request already running wrote late.
							try {
								await accountDeletion.deleteMemberData(user.id)
							} catch {
								console.error("Account deletion: the second pass over member data failed")
							}
							send(user.email, accountDeletedEmail(origin))
						},
					}
				: undefined,
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
			additionalFields: {
				credentialVersion: {
					type: "string",
					required: false,
					input: false,
					returned: false,
				},
			},
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
				send(user.email, resetPasswordEmail(user.email, url))
			},
			onPasswordReset: async ({ user }) => {
				send(user.email, passwordChangedEmail(origin))
			},
			onExistingUserSignUp: async ({ user }) => {
				send(user.email, existingAccountEmail(origin))
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
				send(user.email, confirmEmail(user.email, confirmation.toString()))
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path === "/delete-user/callback")
					throw new APIError("NOT_FOUND")
				if (accountDeletion && ctx.path === "/delete-user") {
					const session = await getSessionFromCtx(ctx)
					// Upstream answers 401 for a signed-out request. The body is changed in place: upstream reads this object.
					if (session) {
						const body = (
							ctx.body && typeof ctx.body === "object" ? ctx.body : {}
						) as { password?: unknown; token?: unknown }
						const member = memberKey(session.user.id)
						if (typeof body.password === "string") {
							// A stolen session must not become a way to guess the password: ten tries an hour, right or wrong.
							if (
								(await options.storage.increment(
									`delete-password:${member}`,
									3600,
								)) > 10
							)
								throw new APIError("TOO_MANY_REQUESTS", {
									message: "Please wait before trying again.",
								})
							const account =
								await ctx.context.internalAdapter.findCredentialAccount(
									session.user.id,
								)
							// No password (Google only) answers the same as a wrong one.
							if (
								!account?.password ||
								!(await verifyCurrentPassword(account.password, body.password))
							)
								throw new APIError("BAD_REQUEST", {
									message: "Invalid password",
									code: "INVALID_PASSWORD",
								})
							// The confirmed password becomes a one-minute deletion token, which upstream consumes and checks
							// against this session, as it does an emailed one; with sendDeleteAccountVerification set it would
							// otherwise email a link even after a correct password.
							const token = randomBytes(32).toString("base64url")
							await ctx.context.internalAdapter.createVerificationValue({
								value: session.user.id,
								identifier: `delete-account-${token}`,
								expiresAt: new Date(Date.now() + 60_000),
							})
							body.password = undefined
							body.token = token
						} else if (typeof body.token !== "string") {
							if (
								(await options.storage.increment(
									`delete-mail:${member}`,
									3600,
								)) > 5
							)
								throw new APIError("TOO_MANY_REQUESTS", {
									message: "Please wait before requesting another email.",
								})
						}
					}
				}
				if (options.mcp && ctx.path === "/oauth2/register") {
					const ip = createHash("sha256")
						.update(
							getIP(
								ctx.request ?? ctx.headers ?? new Headers(),
								ctx.context.options,
							) ?? "unknown",
						)
						.digest("hex")
					if ((await options.storage.increment(`dcr-ip:${ip}`, 3600)) > 30)
						throw new APIError("TOO_MANY_REQUESTS", {
							message: "Please wait before registering another client.",
						})
				}
				if (
					options.mcp &&
					ctx.path === "/oauth2/revoke" &&
					typeof ctx.body?.token === "string"
				) {
					const token = await ctx.context.adapter.findOne<{ clientId: string }>(
						{
							model: "oauthRefreshToken",
							where: [{ field: "token", value: tokenHash(ctx.body.token) }],
						},
					)
					if (token) {
						let clientId =
							typeof ctx.body.client_id === "string"
								? ctx.body.client_id
								: undefined
						const authorization = (ctx.request?.headers ?? ctx.headers)?.get(
							"authorization",
						)
						if (authorization?.startsWith("Basic ")) {
							let basicId: string | undefined
							try {
								basicId = decodeURIComponent(
									Buffer.from(authorization.slice(6), "base64")
										.toString("utf8")
										.split(":")[0],
								)
							} catch {}
							if (clientId && basicId !== clientId)
								throw new APIError("BAD_REQUEST", { error: "invalid_request" })
							clientId = basicId
						}
						// Upstream checks this after its revoked-token family branch.
						// Reject mismatches before it can sweep another client's grants.
						if (clientId !== token.clientId)
							throw new APIError("BAD_REQUEST", { error: "invalid_request" })
					}
				}
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
							id: string
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
					if (!ctx.request) throw invalid()
					refreshGrants.set(ctx.request, {
						id: consent.id,
						version: consent.grantVersion,
					})
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
						send(found.user.email, googleOnlyEmail(origin))
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
				// Upstream deletes by token through an inner call whose cookie change never reaches the response.
				if (
					ctx.path === "/delete-user" &&
					(ctx.context.returned as { message?: string } | undefined)
						?.message === "User deleted"
				)
					deleteSessionCookie(ctx)
				if (
					ctx.path === "/change-password" &&
					(ctx.context.returned as { token?: string })?.token &&
					ctx.context.session
				) {
					send(ctx.context.session.user.email, passwordChangedEmail(origin))
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
					const current =
						await ctx.context.internalAdapter.findCredentialAccount(userId)
					if (
						!current?.password ||
						!(await verifyCurrentPassword(current.password, ctx.body.password))
					)
						throw new APIError("UNAUTHORIZED", {
							message: "Sign-in credential changed",
						})
					const stamped = await ctx.context.adapter.update({
						model: "session",
						where: [
							{ field: "token", value: ctx.context.newSession.session.token },
						],
						update: { credentialVersion: credentialVersion(current.password) },
					})
					if (!stamped)
						throw new APIError("UNAUTHORIZED", {
							message: "Sign-in session changed",
						})
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
						const credential =
							await context.context.internalAdapter.findCredentialAccount(
								session.userId,
							)
						const password =
							typeof credential?.password === "string"
								? credential.password
								: null
						// Core verified the password before reaching this hook. Verify the
						// current credential too, then bind the session to that exact version.
						if (
							context.path === "/sign-in/email" &&
							(!password ||
								typeof context.body?.password !== "string" ||
								!(await verifyCurrentPassword(password, context.body.password)))
						)
							throw new APIError("UNAUTHORIZED", {
								message: "Sign-in credential changed",
							})
						return {
							data: {
								...session,
								credentialVersion: credentialVersion(password),
							},
						}
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
			// A confirmation link opened in a browser that no longer works lands on the page that says so and offers a
			// new one. API callers keep the 401.
			if (
				path === "/api/auth/verify-email" &&
				response.status === 401 &&
				request.method === "GET" &&
				request.headers.get("accept")?.includes("text/html")
			)
				return new Response(null, {
					status: 302,
					headers: { Location: `${origin}/verify-email?state=expired` },
				})
			if (path === "/api/auth/sign-in/email" && response.ok) {
				const pair = await response.clone().json()
				const context = await core.$context
				// OAuth's after hook replaces the token JSON with a consent redirect.
				// Validate only the newly issued response cookie when that happens;
				// an existing request session must never stand in for this sign-in.
				const token =
					typeof pair.token === "string"
						? pair.token
						: (
								await core.api.getSession({
									headers: new Headers({
										cookie: setCookiesOf(response.headers)
											.map((cookie) => cookie.split(";")[0])
											.join("; "),
									}),
								})
							)?.session.token
				const current =
					typeof token === "string"
						? await context.adapter.findOne({
								model: "session",
								where: [{ field: "token", value: token }],
							})
						: null
				if (!current) {
					if (typeof token === "string")
						await context.internalAdapter.deleteSession(token)
					return jsonResponse(
						{
							message:
								"Unable to sign in. Check your details and confirmation email.",
						},
						{ status: 401 },
					)
				}
			}
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
					return jsonResponse(
						{ error: "temporarily_unavailable" },
						{ status: 503 },
					)
				}
			}
			if (response.status >= 500)
				return jsonResponse(
					{ message: "Sign-in is temporarily unavailable." },
					{ status: 503 },
				)
			if (
				path === "/api/auth/sign-in/email" &&
				[401, 403].includes(response.status)
			)
				return jsonResponse(
					{
						message:
							"Unable to sign in. Check your details and confirmation email.",
					},
					{ status: 401 },
				)
			if (path === "/api/auth/sign-up/email" && response.ok)
				return jsonResponse({
					status: true,
					message: "Check your inbox to continue.",
				})
			return response
		},
	}
}
