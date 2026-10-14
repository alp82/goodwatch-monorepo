import assert from "node:assert/strict"
import { after, test } from "node:test"
import Redis from "ioredis"
import { localCrateTransport, migrateAuthTables } from "./crate-adapter.server.ts"
import { createGoodwatchAuth } from "./auth.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { AuthMailQueue } from "./mail.server.ts"

const origin = "http://127.0.0.1:3356"
const resource = `${origin}/mcp`
const sql = localCrateTransport(["http://127.0.0.1:15548"])
const redis = new Redis.Cluster([{host: "127.0.0.1", port: 15601}], {
 natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
 redisOptions: {maxRetriesPerRequest: 0, commandTimeout: 3000},
})
const mail = new AuthMailQueue({sendMail: async () => {} })
const auth = createGoodwatchAuth({sql, storage: new ValkeyAuthStorage(() => redis), mail,
 baseURL: origin, secret: "local-mcp-secret-at-least-32-characters",
 google: {clientId: "local", clientSecret: "local"},
 mcp: {resource, accessTokenExpiresIn: 60},
})
after(() => redis.disconnect())

test("MCP clients discover the canonical resource and issuer with CIMD, DCR and RFC 9207", async () => {
 await migrateAuthTables(sql)
 const response = await auth.handler(new Request(`${origin}/.well-known/oauth-protected-resource/mcp`))
 assert.equal(response.status, 200)
 const metadata = await response.json()
 assert.equal(metadata.resource, resource)
 assert.deepEqual(metadata.authorization_servers, [`${origin}/api/auth`])
 assert.deepEqual(metadata.scopes_supported, ["mcp:read", "mcp:write"])
 const issuer = await auth.handler(new Request(`${origin}/.well-known/oauth-authorization-server/api/auth`))
 assert.equal(issuer.status, 200)
 const body = await issuer.json()
 assert.equal(body.issuer, `${origin}/api/auth`)
 assert.equal(body.client_id_metadata_document_supported, true)
 assert.equal(body.authorization_response_iss_parameter_supported, true)
 assert.equal(body.registration_endpoint, `${origin}/api/auth/oauth2/register`)
 assert.ok(body.scopes_supported.includes("offline_access"))
})

const deliveries: string[] = []
const capturedMail = new AuthMailQueue({sendMail: async (message) => { deliveries.push(String(message.text)); }})
const memberAuth = createGoodwatchAuth({sql, storage: new ValkeyAuthStorage(() => redis), mail: capturedMail,
 baseURL: origin, secret: "local-mcp-secret-at-least-32-characters",
 google: {clientId: "local", clientSecret: "local"}, mcp: {resource, accessTokenExpiresIn: 60},
})
const cookies = (response: Response) => response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ")
async function post(path: string, body: unknown, cookie = "") {
 return memberAuth.handler(new Request(`${origin}/api/auth${path}`, {method: "POST",
 headers: {origin, cookie, "content-type": "application/json", "x-forwarded-for": "127.0.0.1"}, body: JSON.stringify(body)}))
}
async function grant(scope = "mcp:read mcp:write offline_access") {
 const email = `mcp-${crypto.randomUUID()}@example.test`
 assert.equal((await post("/sign-up/email", {email, password: "temporary local password", name: "Local member"})).status, 200)
 await capturedMail.drain()
 const confirmation = deliveries.at(-1)!.match(/http:\/\/\S+/)![0]
 const verified = await memberAuth.handler(new Request(confirmation))
 assert.ok([200, 302].includes(verified.status))
 const cookie = cookies(verified)
 const registration = await post("/oauth2/register", {client_name: "Local test app", application_type: "native",
 redirect_uris: ["http://127.0.0.1:6280/callback"], token_endpoint_auth_method: "none",
 grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: "mcp:read mcp:write offline_access"})
 assert.equal(registration.status, 201)
 const client = await registration.json()
 const verifier = "a".repeat(64)
 const {createHash} = await import("node:crypto")
 const query = new URLSearchParams({client_id: client.client_id, redirect_uri: client.redirect_uris[0],
 response_type: "code", scope, resource, state: "local-state", code_challenge_method: "S256",
 code_challenge: createHash("sha256").update(verifier).digest("base64url")})
 const authorization = await memberAuth.handler(new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {headers: {cookie, accept: "application/json"}}))
 assert.equal(authorization.status, 200)
 const consentUrl = new URL((await authorization.json()).url, origin)
 const allowed = await post("/oauth2/consent", {accept: true, oauth_query: consentUrl.search.slice(1)}, cookie)
 assert.equal(allowed.status, 200)
 const callback = new URL((await allowed.json()).url)
 assert.equal(callback.searchParams.get("iss"), `${origin}/api/auth`)
 const token = await memberAuth.handler(new Request(`${origin}/api/auth/oauth2/token`, {method: "POST",
 headers: {"content-type": "application/x-www-form-urlencoded"}, body: new URLSearchParams({
 grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0],
 code: callback.searchParams.get("code")!, code_verifier: verifier, resource})}))
 assert.equal(token.status, 200)
 return {client, token: await token.json(), cookie}
}

test("a resource-bound Better Auth JWKS token reaches the MCP verifier with its member and client", async () => {
 const issued = await grant()
 const {setAuthForTest} = await import("./runtime.server.ts")
 const {mcpAuthorization} = await import("../mcp/authorization.server.ts")
 process.env.BETTER_AUTH_ENABLED = "true"
 process.env.MCP_RESOURCE_URL = resource
 setAuthForTest(memberAuth)
 try {
 const info = await mcpAuthorization.verifyAccessToken(issued.token.access_token)
 assert.equal(info.clientId, issued.client.client_id)
 assert.equal(info.resource?.href, resource)
 assert.ok(info.scopes.includes("mcp:read"))
 const session = await memberAuth.api.getSession({headers: new Headers({cookie: issued.cookie})})
 assert.equal(info.extra?.userId, session!.user.id)
 } finally {setAuthForTest(null); delete process.env.BETTER_AUTH_ENABLED; delete process.env.MCP_RESOURCE_URL}
})

test("using a valid MCP grant records Last used in the connected apps API", async () => {
 const issued = await grant()
 const {setAuthForTest} = await import("./runtime.server.ts")
 const {mcpAuthorization} = await import("../mcp/authorization.server.ts")
 process.env.BETTER_AUTH_ENABLED = "true"; process.env.MCP_RESOURCE_URL = resource; setAuthForTest(memberAuth)
 try {
  const usedAt = Date.now()
  await mcpAuthorization.verifyAccessToken(issued.token.access_token)
  const response = await memberAuth.handler(new Request(`${origin}/api/auth/oauth2/get-consents`, {headers: {cookie: issued.cookie}}))
  assert.equal(response.status, 200)
  const connected = (await response.json()).find((c: {clientId: string}) => c.clientId === issued.client.client_id)
  assert.ok(connected.lastUsedAt, "Connected apps must show Last used after a valid request")
  assert.ok(new Date(connected.lastUsedAt).getTime() >= usedAt)
 } finally {setAuthForTest(null); delete process.env.BETTER_AUTH_ENABLED; delete process.env.MCP_RESOURCE_URL}
})

test("a signed-in member cannot administer OAuth resources or disable another app", async () => {
 const issued = await grant()
 const response = await memberAuth.handler(new Request(`${origin}/api/auth/oauth2/create-client`, {method: "POST",
 headers: {origin, cookie: issued.cookie, "content-type": "application/json"}, body: JSON.stringify({client_name: "Privileged app", redirect_uris: ["https://other.example/callback"], skip_consent: true})}))
 assert.equal(response.status, 401)
})
