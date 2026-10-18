import {
	OAuthError,
	type OAuthTokenVerifier,
	bearerAuthChallengeResponse,
	createMcpHandler,
	readRequestBody,
	verifyBearerToken,
} from "@modelcontextprotocol/server"
import type { RateVerdict, RateWindow } from "../rate-limit.server.ts"
import { isAddressedTo } from "../site-origin.server.ts"
import { fillWebFetchGaps } from "../web-fetch-gaps.server.ts"
import { mcpAuthorization } from "./authorization.server.ts"
import { IMPORT_PATH, MAX_BATCH_ITEMS } from "./batch.server.ts"
import type { RankedSearch } from "./ranked.server.ts"
import { describeRpc } from "./rpc-log.ts"
import { createToolServer, readToolNames } from "./tools.server.ts"
import { isWriteCall, writeItemCount, writeToolNames } from "./write-names.ts"

const knownTools: ReadonlySet<string> = new Set([
	...readToolNames,
	...writeToolNames,
])

interface Limiter {
	take(
		name: string,
		member: string,
		windows: RateWindow[],
		cost?: number,
	): Promise<RateVerdict>
}

/**
 * Title writes per member, on top of the request limit: a batch counts once per item, so 60 batch calls a minute
 * can't make 3,000 writes. Whole histories belong in the file import.
 */
export const WRITE_ITEM_WINDOWS: RateWindow[] = [
	{ limit: 300, seconds: 60 },
	{ limit: 2000, seconds: 3600 },
]

const tooMany = (retryAfterSeconds: number, body: Record<string, unknown>) =>
	// Not Response.json: remix-serve's polyfilled Response has no static json().
	new Response(JSON.stringify(body), {
		status: 429,
		headers: {
			"Content-Type": "application/json",
			"Retry-After": String(retryAfterSeconds),
		},
	})

export function createReadMcpHandler(
	options: {
		resource?: string
		authorization?: OAuthTokenVerifier
		limiter?: Limiter
		rankedSearch?: RankedSearch
	} = {},
) {
	const resource = options.resource ?? process.env.MCP_RESOURCE_URL
	const authOptions = {
		verifier: options.authorization ?? mcpAuthorization,
		requiredScopes: ["mcp:read"],
		expectedResource: resource ? new URL(resource) : undefined,
		resourceMetadataUrl: resource
			? new URL("/.well-known/oauth-protected-resource/mcp", resource).href
			: undefined,
	}
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
				!isAddressedTo(request, resource) ||
				(origin && origin !== new URL(resource).origin)
			)
				return new Response("Origin rejected", { status: 403 })
		}
		let auth: Awaited<ReturnType<typeof verifyBearerToken>>
		try {
			const [header] = (request.headers.get("Authorization") ?? "").split(",")
			auth = await verifyBearerToken(header || undefined, authOptions)
		} catch (error) {
			// No initial scope hint: clients discover both supported scopes from resource metadata.
			// Enforcement stays read-only at the gate; write calls have their own scope check below.
			return bearerAuthChallengeResponse(error, {
				...authOptions,
				requiredScopes:
					error instanceof OAuthError && error.code === "invalid_token"
						? []
						: authOptions.requiredScopes,
			})
		}
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
		const protocolHeader = request.headers.get("MCP-Protocol-Version")
		for (const message of Array.isArray(body) ? body : [body]) {
			const line = describeRpc(message, knownTools, protocolHeader)
			if (line) console.log(line)
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
					requiredScopes: ["mcp:read", "mcp:write"],
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
			return tooMany(verdict.retryAfterSeconds, { error: "rate_limited" })
		const writes = writeItemCount(body, MAX_BATCH_ITEMS)
		// Batches of one member run one at a time per request: each judges its items against the data it read first.
		if (writes.batches > 1 || writes.count > WRITE_ITEM_WINDOWS[0].limit)
			return Response.json(
				{
					jsonrpc: "2.0",
					id: null,
					error: {
						code: -32600,
						message:
							"Send one batch write (items or batch_id) per request, and split larger work into several requests.",
					},
				},
				{ status: 400 },
			)
		if (writes.count) {
			const budget = await limiter.take(
				"mcp-write-items",
				userId,
				WRITE_ITEM_WINDOWS,
				writes.count,
			)
			if (!budget.allowed)
				return tooMany(budget.retryAfterSeconds, {
					error: "rate_limited",
					scope: "write_items",
					message: `Too many title writes for now; retry after ${budget.retryAfterSeconds} seconds. For a whole history, the member can use the file import: ${new URL(IMPORT_PATH, resource).href}`,
				})
		}
		const handler = createMcpHandler(
			() =>
				createToolServer(
					userId,
					new URL(resource).origin,
					auth.scopes.includes("mcp:write"),
					options.rankedSearch,
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
