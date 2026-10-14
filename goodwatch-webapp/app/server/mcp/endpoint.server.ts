import {
	OAuthError,
	type OAuthTokenVerifier,
	bearerAuthChallengeResponse,
	createMcpHandler,
	readRequestBody,
	requireBearerAuth,
} from "@modelcontextprotocol/server"
import type { RateVerdict, RateWindow } from "../rate-limit.server.ts"
import { mcpAuthorization } from "./authorization.server.ts"
import { createToolServer } from "./tools.server.ts"
import { isWriteCall } from "./write-names.ts"

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
		let body: unknown = null
		if (request.method === "POST") {
			const read = await readRequestBody(request.clone())
			if (read.tooLarge)
				return Response.json({ error: "request_too_large" }, { status: 413 })
			try {
				body = JSON.parse(read.text)
			} catch {
				return Response.json(
					{
						jsonrpc: "2.0",
						id: null,
						error: { code: -32700, message: "Invalid JSON" },
					},
					{ status: 400 },
				)
			}
		}
		if (
			!auth.scopes.includes("mcp:write") &&
			(Array.isArray(body) ? body : [body]).some(isWriteCall)
		) {
			return bearerAuthChallengeResponse(
				new OAuthError(
					"insufficient_scope",
					"This operation requires mcp:write",
				),
				{
					requiredScopes: ["mcp:write"],
					resourceMetadataUrl: auth.resourceMetadataUrl,
				},
			)
		}
		const limiter =
			options.limiter ?? (await import("../rate-limit.server.ts")).rateLimiter
		const verdict = await limiter.take("mcp-read", userId, [
			{ limit: 60, seconds: 60 },
			{ limit: 1000, seconds: 3600 },
		])
		if (!verdict.allowed)
			return Response.json(
				{ error: "rate_limited" },
				{
					status: 429,
					headers: { "Retry-After": String(verdict.retryAfterSeconds) },
				},
			)
		const handler = createMcpHandler(
			() =>
				createToolServer(
					userId,
					new URL(resource).origin,
					auth.scopes.includes("mcp:write"),
				),
			{ legacy: "stateless" },
		)
		try {
			return await handler.fetch(request, { authInfo: auth })
		} finally {
			await handler.close()
		}
	}
}
