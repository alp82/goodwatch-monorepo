import { test } from "node:test"
import assert from "node:assert/strict"
import {
	assertYepWatchOAuthRequest,
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
