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
