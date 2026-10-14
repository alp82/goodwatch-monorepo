import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { jwt } from "better-auth/plugins"
import { mcp } from "@better-auth/mcp"
import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { setTasteFlag } from "./fixtures.server"

if (process.env.MCP_SPIKE !== "1")
	throw new Error(
		"Run npm run spike:mcp; this is not a production auth instance",
	)
export const origin = process.env.MCP_SPIKE_ORIGIN!
export const resource = `${origin}/mcp`
export const email = "spike@example.test"
export function audit(event: string, fields: Record<string, unknown> = {}) {
	console.log(
		JSON.stringify({
			spike: true,
			at: new Date().toISOString(),
			event,
			...fields,
		}),
	)
}

const db: Record<string, Record<string, unknown>[]> = Object.fromEntries(
	[
		"user",
		"session",
		"account",
		"verification",
		"jwks",
		"oauthClient",
		"oauthResource",
		"oauthClientResource",
		"oauthAccessToken",
		"oauthRefreshToken",
		"oauthConsent",
		"oauthClientAssertion",
	].map((model) => [model, []]),
)
export const auth = betterAuth({
	baseURL: origin,
	basePath: "/api/auth",
	secret: process.env.MCP_SPIKE_SECRET,
	database: memoryAdapter(db),
	emailAndPassword: { enabled: true },
	disabledPaths: ["/sign-up/email"],
	trustedOrigins: [origin],
	advanced: { cookiePrefix: "goodwatch-mcp-spike" },
	plugins: [
		jwt(),
		mcp({
			loginPage: "/login",
			consentPage: "/consent",
			resource,
			scopes: [
				"openid",
				"profile",
				"email",
				"offline_access",
				"mcp:read",
				"mcp:write",
			],
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			accessTokenExpiresIn: 60,
			refreshTokenExpiresIn: 3600,
		}),
		cimd({
			metadataProfile: "mcp-2026-07-28",
			fetchClientMetadataResource,
			onClientCreated: ({ client }) =>
				audit("cimd-created", { clientId: client.clientId }),
			onClientRefreshed: ({ client }) =>
				audit("cimd-refreshed", { clientId: client.clientId }),
		}),
	],
})

// Direct server API bootstraps the single demo account; HTTP signup stays disabled.
export const ready = auth.api
	.signUpEmail({
		body: {
			email,
			password: process.env.MCP_SPIKE_PASSWORD!,
			name: "Spike member",
		},
	})
	.then((result) => {
		setTasteFlag(result.user.id, process.env.MCP_SPIKE_REC_TASTE === "1")
		return result
	})

export function postAuth(
	request: Request,
	path: string,
	body: Record<string, unknown>,
) {
	const headers = new Headers(request.headers)
	headers.set("Content-Type", "application/json")
	headers.set("Accept", "application/json")
	headers.delete("Content-Length")
	return handleAuth(
		new Request(`${origin}/api/auth${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		}),
	)
}

export async function handleAuth(request: Request) {
	await ready
	const path = new URL(request.url).pathname
	const fields: Record<string, unknown> = { method: request.method, path }
	if (path.endsWith("/token")) {
		const body = await request.clone().text()
		fields.grantType = new URLSearchParams(body).get("grant_type")
	}
	const response = await auth.handler(request)
	audit("auth-http", { ...fields, status: response.status })
	return response
}
