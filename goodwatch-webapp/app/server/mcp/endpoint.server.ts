import {
	type OAuthTokenVerifier,
	createMcpHandler,
	requireBearerAuth,
} from "@modelcontextprotocol/server"
import type { RateVerdict, RateWindow } from "../rate-limit.server.ts"
import { fillWebFetchGaps } from "../web-fetch-gaps.server.ts"
import { mcpAuthorization } from "./authorization.server.ts"
import { createReadToolServer } from "./tools.server.ts"

interface Limiter {
	take(
		name: string,
		member: string,
		windows: RateWindow[],
	): Promise<RateVerdict>
}

export function createReadMcpHandler(
	options: {
		resource?: string
		authorization?: OAuthTokenVerifier
		limiter?: Limiter
	} = {},
) {
	const resource = options.resource ?? process.env.MCP_RESOURCE_URL
	const gate = requireBearerAuth({
		verifier: options.authorization ?? mcpAuthorization,
		requiredScopes: ["mcp:read"],
		expectedResource: resource ? new URL(resource) : undefined,
		resourceMetadataUrl: resource
			? new URL("/.well-known/oauth-protected-resource/mcp", resource).href
			: undefined,
	})
	return async (request: Request): Promise<Response> => {
		// The SDK's challenge and answers call Response.json(), which remix-serve's polyfill lacks.
		fillWebFetchGaps()
		const response = await handle(request)
		response.headers.set("Cache-Control", "private, no-store, no-transform")
		return response
	}
	async function handle(request: Request): Promise<Response> {
		if (resource) {
			const origin = request.headers.get("Origin")
			if (
				new URL(request.url).origin !== new URL(resource).origin ||
				(origin && origin !== new URL(resource).origin)
			)
				return new Response("Origin rejected", { status: 403 })
		}
		const auth = await gate(request)
		if (auth instanceof Response) return auth
		if (!resource)
			return new Response("MCP resource is not configured", { status: 503 })
		const userId = auth.extra?.userId
		if (typeof userId !== "string" || !userId.trim())
			return new Response("Missing member subject", { status: 403 })
		const limiter =
			options.limiter ?? (await import("../rate-limit.server.ts")).rateLimiter
		const verdict = await limiter.take("mcp-read", userId, [
			{ limit: 60, seconds: 60 },
			{ limit: 1000, seconds: 3600 },
		])
		if (!verdict.allowed)
			// Not Response.json: remix-serve's polyfilled Response has no static json().
			return new Response(JSON.stringify({ error: "rate_limited" }), {
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": String(verdict.retryAfterSeconds),
				},
			})
		const handler = createMcpHandler(
			() => createReadToolServer(userId, new URL(resource).origin),
			{ legacy: "stateless" },
		)
		try {
			return await handler.fetch(request, { authInfo: auth })
		} finally {
			await handler.close()
		}
	}
}
