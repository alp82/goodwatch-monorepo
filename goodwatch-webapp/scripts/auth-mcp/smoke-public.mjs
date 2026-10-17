// Production-safe pre-sign-in smoke. Creates one unused DCR client; no member,
// session, token exchange or tool call. The existing registration collector expires it.
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"

const origin = "https://goodwatch.app"
const resource = `${origin}/mcp`
const challenge = await fetch(resource, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json, text/event-stream",
	},
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {},
	}),
})
assert.equal(challenge.status, 401)
assert.match(
	challenge.headers.get("WWW-Authenticate"),
	/resource_metadata="https:\/\/goodwatch.app\/\.well-known\/oauth-protected-resource\/mcp"/,
)
const resourceResponse = await fetch(
	`${origin}/.well-known/oauth-protected-resource/mcp`,
)
assert.equal(resourceResponse.status, 200)
const metadata = await resourceResponse.json()
assert.equal(metadata.resource, resource)
assert.deepEqual(metadata.scopes_supported, ["mcp:read", "mcp:write"])
const issuerResponse = await fetch(
	`${origin}/.well-known/oauth-authorization-server/api/auth`,
)
assert.equal(issuerResponse.status, 200)
const issuer = await issuerResponse.json()
assert.equal(issuer.dpop_signing_alg_values_supported, undefined)
assert.equal(metadata.dpop_signing_alg_values_supported, undefined)
assert.equal(issuer.client_id_metadata_document_supported, true)
assert.equal(issuer.registration_endpoint, `${origin}/api/auth/oauth2/register`)
const registration = await fetch(issuer.registration_endpoint, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		client_name: `GoodWatch pre-sign-in smoke ${new Date().toISOString()}`,
		application_type: "native",
		redirect_uris: ["http://127.0.0.1:6280/callback"],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: "mcp:read mcp:write offline_access",
	}),
})
assert.equal(registration.status, 201, await registration.clone().text())
const client = await registration.json()
const verifier = randomBytes(48).toString("base64url")
const authorize = new URL(issuer.authorization_endpoint)
authorize.search = new URLSearchParams({
	client_id: client.client_id,
	redirect_uri: client.redirect_uris[0],
	response_type: "code",
	scope: "mcp:read mcp:write offline_access",
	resource,
	state: randomBytes(16).toString("hex"),
	code_challenge_method: "S256",
	code_challenge: createHash("sha256").update(verifier).digest("base64url"),
}).toString()
const authorization = await fetch(authorize, {
	redirect: "manual",
	headers: { Accept: "text/html" },
})
const target =
	authorization.headers.get("Location") ?? (await authorization.json()).url
const login = new URL(target, origin)
assert.equal(login.origin, origin)
assert.equal(login.pathname, "/sign-in")
const page = await fetch(login)
assert.equal(page.status, 200)
assert.match(await page.text(), /Sign in/i)
const preflight = await fetch(resource, {
	method: "OPTIONS",
	headers: {
		Origin: "https://claude.ai",
		"Access-Control-Request-Method": "POST",
		"Access-Control-Request-Headers":
			"authorization,content-type,mcp-protocol-version",
	},
})
assert.equal(preflight.status, 403)
assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), null)
console.log(
	JSON.stringify(
		{
			checkedAt: new Date().toISOString(),
			challenge: challenge.status,
			resourceMetadata: resourceResponse.status,
			issuerMetadata: issuerResponse.status,
			cimd: issuer.client_id_metadata_document_supported,
			dcr: registration.status,
			authorization: authorization.status,
			loginPath: login.pathname,
			login: page.status,
			dpopAdvertised: Boolean(
				issuer.dpop_signing_alg_values_supported ||
					metadata.dpop_signing_alg_values_supported,
			),
			foreignPreflight: preflight.status,
		},
		null,
		2,
	),
)
