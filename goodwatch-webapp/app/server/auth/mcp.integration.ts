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
