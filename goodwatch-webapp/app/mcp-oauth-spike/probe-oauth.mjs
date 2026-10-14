// Reproducible local OAuth protocol probe, not a production test suite.
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { randomBytes, createHash } from "node:crypto"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { verifyToolSet, readRpcResponse } from "./probe-tool-set.mjs"

const origin = "http://127.0.0.1:3335"
const resource = `${origin}/mcp`
const metadata = await (
	await fetch(`${origin}/.well-known/oauth-authorization-server/api/auth`)
).json()
assert.equal(metadata.authorization_response_iss_parameter_supported, true)
assert.equal(metadata.issuer, `${origin}/api/auth`)
let resolveCallback
const server = createServer((req, res) => {
	resolveCallback(new URL(req.url, "http://127.0.0.1:6280"))
	res.end("Local spike protocol probe complete")
})
server.listen(6280, "127.0.0.1")
await once(server, "listening")
const callbackUrl = "http://127.0.0.1:6280/callback"
async function post(endpoint, body) {
	return fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(body),
	})
}
const registration = await fetch(metadata.registration_endpoint, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		client_name: "GoodWatch protocol probe",
		application_type: "native",
		redirect_uris: [callbackUrl],
		token_endpoint_auth_method: "none",
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
	}),
})
assert.equal(registration.status, 201)
const client = await registration.json()
async function grant(scope, decision = "allow") {
	const verifier = randomBytes(32).toString("base64url")
	const state = randomBytes(16).toString("hex")
	const url = new URL(metadata.authorization_endpoint)
	url.search = new URLSearchParams({
		response_type: "code",
		client_id: client.client_id,
		redirect_uri: callbackUrl,
		scope,
		state,
		resource,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		prompt: "consent",
	}).toString()
	const callbackPromise = new Promise((resolve) => {
		resolveCallback = resolve
	})
	const child = spawn(
		process.execPath,
		[new URL("./authorize-local.mjs", import.meta.url).pathname, url.href],
		{ env: { ...process.env, MCP_SPIKE_DECISION: decision }, stdio: "inherit" },
	)
	const exitPromise = once(child, "exit")
	const [exitCode] = await exitPromise
	assert.equal(exitCode, 0)
	const callback = await callbackPromise
	assert.equal(callback.searchParams.get("iss"), metadata.issuer)
	assert.equal(callback.searchParams.get("state"), state)
	if (decision === "deny") {
		assert.equal(callback.searchParams.get("error"), "access_denied")
		return
	}
	const fields = {
		grant_type: "authorization_code",
		client_id: client.client_id,
		redirect_uri: callbackUrl,
		code: callback.searchParams.get("code"),
		code_verifier: verifier,
		resource,
	}
	const response = await post(metadata.token_endpoint, fields)
	assert.equal(response.status, 200)
	const tokens = await response.json()
	return { ...tokens, replayFields: fields }
}
try {
	const tokens = await grant("mcp:read offline_access")
	const claims = JSON.parse(
		Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
	)
	assert.equal(claims.iss, metadata.issuer)
	assert.ok(claims.aud === resource || claims.aud.includes(resource))
	const response = await post(metadata.token_endpoint, {
		grant_type: "refresh_token",
		client_id: client.client_id,
		refresh_token: tokens.refresh_token,
		resource,
	})
	assert.equal(response.status, 200)
	const rotated = await response.json()
	assert.notEqual(rotated.refresh_token, tokens.refresh_token)
	const retry = await post(metadata.token_endpoint, {
		grant_type: "refresh_token",
		client_id: client.client_id,
		refresh_token: tokens.refresh_token,
		resource,
	})
	assert.equal(retry.status, 200)
	assert.equal((await retry.json()).refresh_token, rotated.refresh_token)
	const rpc = { jsonrpc: "2.0", id: 1, method: "tools/list" }
	async function mcp(token, message = rpc) {
		return fetch(resource, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(message),
		})
	}
	assert.equal((await mcp(rotated.access_token)).status, 200)
	const parts = rotated.access_token.split(".")
	parts[1] = Buffer.from(
		JSON.stringify({ ...claims, aud: "https://wrong.example/mcp" }),
	).toString("base64url")
	assert.equal((await mcp(parts.join("."))).status, 401)
	const scopeLimited = await grant("offline_access")
	const forbidden = await mcp(scopeLimited.access_token)
	assert.equal(forbidden.status, 403)
	assert.match(forbidden.headers.get("WWW-Authenticate"), /insufficient_scope/)
	const readOnlyWrite = await mcp(rotated.access_token, {
		jsonrpc: "2.0",
		id: 2,
		method: "tools/call",
		params: {
			name: "rate_title",
			arguments: { title_id: "movie:603", score: 1 },
		},
	})
	assert.equal(readOnlyWrite.status, 403)
	assert.match(readOnlyWrite.headers.get("WWW-Authenticate"), /mcp:write/)
	if (process.argv.includes("--tools")) {
		const full = await grant("mcp:read mcp:write offline_access")
		let rpcId = 10
		await verifyToolSet(async (method, params) => {
			const response = await mcp(full.access_token, {
				jsonrpc: "2.0",
				id: ++rpcId,
				method,
				params,
			})
			assert.equal(response.status, 200)
			const data = await readRpcResponse(response)
			if (data.error) return { error: data.error }
			return data.result
		}, process.env.MCP_SPIKE_REC_TASTE === "1")
	}
	// Replay revokes the grant, so check this after the refresh/tool assertions.
	assert.equal(
		(await post(metadata.token_endpoint, tokens.replayFields)).status,
		400,
	)
	await grant("mcp:read offline_access", "deny")
	console.log(
		JSON.stringify({
			protocolProbe: "PASS",
			issSuccessAndDenial: true,
			jwtAudience: resource,
			authorizationCodeReplay: "400",
			rotatedRefreshToken: true,
			refreshRetrySameToken: true,
			tamperedJwt: "401",
			missingScope: "403",
			readOnlyWrite: "403",
		}),
	)
} finally {
	server.close()
}
