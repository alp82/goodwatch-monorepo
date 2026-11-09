import { test } from "node:test"
import assert from "node:assert/strict"
import {
	assertYepWatchOAuthRequest,
	isYepWatchSignInScope,
	validateYepWatchOAuthConfig,
} from "./yepwatch-oauth-policy.ts"
const config = {
	resource: "https://yepwatch.com/api/yepwatch/v1/continuous",
	clientId: "yepwatch-public",
	redirectUris: [
		"https://yepwatch.com/api/yepwatch/v1/continuous/member/callback",
		"yepwatch://member/callback",
	],
}
const input = {
	client_id: config.clientId,
	resource: config.resource,
	scope: "yepwatch:read",
	redirect_uri: config.redirectUris[0],
	code_challenge_method: "S256",
	code_challenge: "a".repeat(43),
	state: "s".repeat(43),
}
test("Dedicated public PKCE policy accepts exact browser/native and leaves existing MCP intent untouched", () => {
	validateYepWatchOAuthConfig(config)
	assert.doesNotThrow(() =>
		assertYepWatchOAuthRequest(config, "/oauth2/authorize", input),
	)
	assert.doesNotThrow(() =>
		assertYepWatchOAuthRequest(config, "/oauth2/authorize", {
			...input,
			redirect_uri: config.redirectUris[1],
		}),
	)
	assert.doesNotThrow(() =>
		assertYepWatchOAuthRequest(config, "/oauth2/authorize", {
			client_id: "mcp",
			resource: "https://goodwatch.app/mcp",
			scope: "mcp:read",
		}),
	)
})
for (const [key, value] of Object.entries({
	client_id: "mcp",
	resource: "https://goodwatch.app/mcp",
	scope: "mcp:read",
	redirect_uri: "https://evil.example/callback",
	code_challenge_method: "plain",
	code_challenge: "bad",
	state: "short",
}))
	test(`Dedicated OAuth policy rejects wrong ${key}`, () => {
		assert.throws(() =>
			assertYepWatchOAuthRequest(config, "/oauth2/authorize", {
				...input,
				[key]: value,
			}),
		)
	})
test("Signed consent is checked against same exact policy; cross-resource and identity scopes denied", () => {
	assert.doesNotThrow(() =>
		assertYepWatchOAuthRequest(config, "/oauth2/consent", {
			oauth_query: new URLSearchParams(input).toString(),
		}),
	)
	for (const patch of [
		{ scope: "yepwatch:read email" },
		{ resource: [config.resource, "https://goodwatch.app/mcp"] },
		{ client_id: "other", scope: "yepwatch:read" },
	])
		assert.throws(() =>
			assertYepWatchOAuthRequest(config, "/oauth2/authorize", {
				...input,
				...patch,
			}),
		)
})

test("YepWatch's own sign-in is read access, optionally with offline_access, and nothing else", () => {
	assert.equal(isYepWatchSignInScope("yepwatch:read"), true)
	assert.equal(isYepWatchSignInScope("yepwatch:read offline_access"), true)
	assert.equal(isYepWatchSignInScope("offline_access"), false)
	assert.equal(isYepWatchSignInScope("yepwatch:read mcp:read"), false)
	assert.equal(isYepWatchSignInScope("yepwatch:read offline_access mcp:write"), false)
	assert.equal(isYepWatchSignInScope(null), false)
	assert.doesNotThrow(() =>
		assertYepWatchOAuthRequest(config, "/oauth2/consent", { ...input, scope: "yepwatch:read offline_access" }),
	)
})
