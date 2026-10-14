import { randomUUID } from "node:crypto"
import { beforeAll, expect, test } from "vitest"
import { betterAuth } from "better-auth"
import { crateAuthAdapter, localCrateTransport, migrateAuthTables } from "../../../app/server/auth/crate-adapter.server.ts"

const sql = localCrateTransport(["http://127.0.0.1:15748", "http://127.0.0.1:15749", "http://127.0.0.1:15750"])
const secret = "disposable-local-auth-integration-key-548"
beforeAll(async () => { await migrateAuthTables(sql) })
const makeAuth = (extra = {}) => betterAuth({ database: crateAuthAdapter({ sql, encryptionSecret: secret }), secret,
 baseURL: "http://localhost:3000", emailAndPassword: { enabled: true }, ...extra })

test("Google accounts and sessions survive repeated Better Auth updates with large provider tokens", async () => {
 const auth = makeAuth()
 const { internalAdapter } = await auth.$context
 const user = await internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const account = await internalAdapter.createAccount({ userId: user.id, providerId: "google", accountId: randomUUID(), accessToken: "a".repeat(2000), idToken: "i".repeat(2500), refreshToken: "r".repeat(1000) })
 for (let i = 0; i < 80; i++) {
  const updated = await internalAdapter.updateAccount(account.id, { accessToken: `${i}:${"a".repeat(2000)}`, idToken: `${i}:${"i".repeat(2500)}` })
  expect(updated?.accessToken).toBe(`${i}:${"a".repeat(2000)}`)
 }
 const session = await internalAdapter.createSession(user.id)
 for (let i = 0; i < 200; i++) expect((await internalAdapter.updateSession(session.token, { expiresAt: new Date(Date.now() + 100000 + i) }))?.id).toBe(session.id)
})

import { oauthProvider } from "@better-auth/oauth-provider"
import { createHmac } from "node:crypto"
const cookieHeaders = token => new Headers({ cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`)}`, origin: "http://localhost:3000" })

test("sign out everywhere runs OAuth revocation hooks for all 103 sessions", async () => {
 let hooks = 0
 const auth = makeAuth({ plugins: [oauthProvider({ loginPage: "/login", consentPage: "/consent", disableJwtPlugin: true })],
  databaseHooks: { session: { delete: { before: async () => { hooks++ } } } } })
 const ctx = await auth.$context
 const user = await ctx.internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const clientId = randomUUID()
 await ctx.adapter.create({ model: "oauthClient", data: { clientId, name: "RP", redirectUris: ["http://localhost/callback"], createdAt: new Date() } })
 const sessions = []
 for (let start = 0; start < 103; start += 10) sessions.push(...await Promise.all(Array.from({ length: Math.min(10, 103 - start) }, () => ctx.internalAdapter.createSession(user.id))))
 const tokens = []
 for (const session of sessions) tokens.push(...await Promise.all(["oauthAccessToken", "oauthRefreshToken"].map(async model => {
  const token = randomUUID()
  await ctx.adapter.create({ model, data: { token, clientId, userId: user.id, sessionId: session.id, scopes: ["openid"], createdAt: new Date(), expiresAt: new Date(Date.now() + 600000) } })
  return { model, token }
 })))
 expect(await auth.api.revokeSessions({ headers: cookieHeaders(sessions[0].token) })).toEqual({ status: true })
 expect(hooks).toBe(103)
 for (const { model, token } of tokens) expect((await ctx.adapter.findOne({ model, where: [{ field: "token", value: token }] }))?.revoked).toBeInstanceOf(Date)
 expect(await ctx.internalAdapter.listSessions(user.id)).toEqual([])
}, 300000)

test("four parallel session checks all remain authenticated when refreshes contend", async () => {
 const auth = makeAuth({ session: { updateAge: 0 } })
 const ctx = await auth.$context
 const user = await ctx.internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const session = await ctx.internalAdapter.createSession(user.id, false, { expiresAt: new Date(Date.now() + 100000) }, true)
 const results = await Promise.allSettled(Array.from({ length: 4 }, () => auth.api.getSession({ headers: cookieHeaders(session.token) })))
 expect(results.map(r => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled", "fulfilled"])
 for (const result of results) if (result.status === "fulfilled") expect(result.value?.session.id).toBe(session.id)
})

import { handleOAuthUserInfo } from "better-auth/oauth2"
test("concurrent Google sign-ins update the linked account and each create a session", async () => {
 const auth = makeAuth({ socialProviders: { google: { clientId: "disposable-client", clientSecret: "disposable-secret" } } })
 const context = await auth.$context
 const user = await context.internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const accountId = randomUUID()
 await context.internalAdapter.createAccount({ userId: user.id, providerId: "google", accountId })
 const results = await Promise.all(Array.from({ length: 4 }, (_, i) => handleOAuthUserInfo({ context }, {
  userInfo: { id: accountId, email: user.email, name: "Member", emailVerified: true },
  account: { providerId: "google", accountId, accessToken: `fresh-google-${i}` }, callbackURL: "/" })))
 for (const result of results) { expect(result.error).toBeNull(); expect(result.data?.session.userId).toBe(user.id) }
})

test("sign-out wins a race with session refresh and does not resurrect the session", async () => {
 let refresh
 const raceSql = async (stmt, args) => {
  if (refresh && stmt.startsWith("UPDATE doc.auth_session ")) { const action = refresh; refresh = undefined; await action() }
  return sql(stmt, args)
 }
 const auth = makeAuth({ database: crateAuthAdapter({ sql: raceSql, encryptionSecret: secret }), session: { updateAge: 0 } })
 const ctx = await auth.$context
 const user = await ctx.internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const session = await ctx.internalAdapter.createSession(user.id)
 const other = await makeAuth().$context
 refresh = () => other.internalAdapter.updateSession(session.token, { expiresAt: new Date(Date.now() + 600000) })
 expect(await auth.api.signOut({ headers: cookieHeaders(session.token) })).toEqual({ success: true })
 expect(await auth.api.getSession({ headers: cookieHeaders(session.token) })).toBeNull()
 expect(await other.internalAdapter.updateSession(session.token, { expiresAt: new Date(Date.now() + 600000) })).toBeNull()
})

test("Better Auth receives a deterministic CrateDB refusal rather than an indeterminate outcome", async () => {
 let refuse = false
 const rejectingSql = async (stmt, args) => refuse && stmt.startsWith("UPDATE doc.auth_account ")
  ? sql("UPDATE doc.auth_account SET lookup['clientId'] = ? WHERE id = ?", ["x".repeat(40000), args[6]]) : sql(stmt, args)
 const ctx = await makeAuth({ database: crateAuthAdapter({ sql: rejectingSql, encryptionSecret: secret }) }).$context
 const user = await ctx.internalAdapter.createUser({ email: `${randomUUID()}@test.invalid`, name: "Member", emailVerified: true })
 const account = await ctx.internalAdapter.createAccount({ userId: user.id, providerId: "google", accountId: randomUUID() })
 refuse = true
 await expect(ctx.internalAdapter.updateAccount(account.id, { accessToken: "fresh" })).rejects.toMatchObject({ code: 4000 })
})
