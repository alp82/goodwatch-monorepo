import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { createMcpHandler } from "@modelcontextprotocol/server"
import { requireMcpAuth } from "@better-auth/mcp"
import { createInsufficientScopeError } from "better-auth/oauth2"
import { auth, audit, ready, resource } from "../auth.server"
import { createToolServer, writeTools } from "../tools.server"

const protectedHandler = requireMcpAuth(
	auth,
	async (request, claims) => {
		const body = await request
			.clone()
			.json()
			.catch(() => null)
		if (
			(Array.isArray(body) ? body : [body]).some(
				(message) =>
					message?.method === "tools/call" &&
					writeTools.has(message.params?.name),
			) &&
			!(
				typeof claims.scope === "string" &&
				claims.scope.split(" ").includes("mcp:write")
			)
		) {
			throw createInsufficientScopeError(["mcp:write"])
		}
		const memberId = claims.sub
		if (typeof memberId !== "string")
			return new Response("Missing member subject", { status: 403 })
		const handler = createMcpHandler(
			() =>
				createToolServer(memberId, new URL(resource).origin, (tool, status) =>
					audit("tool-call", { tool, member: claims.sub, status }),
				),
			{
				legacy:
					process.env.MCP_SPIKE_LEGACY === "reject" ? "reject" : "stateless",
			},
		)
		try {
			return await handler.fetch(request)
		} finally {
			await handler.close()
		}
	},
	{
		resource,
		requiredScopes: ["mcp:read"],
		challengeScopes: ["mcp:read", "mcp:write", "offline_access"],
	},
)

async function handle(request: Request) {
	await ready
	const origin = request.headers.get("Origin")
	if (
		origin &&
		origin !== new URL(resource).origin &&
		!["http://localhost:6274", "http://127.0.0.1:6274"].includes(origin)
	)
		return new Response("Origin rejected", { status: 403 })
	const response = await protectedHandler(request)
	response.headers.set("Cache-Control", "no-store, no-transform")
	audit("mcp-http", { method: request.method, status: response.status })
	return response
}
export const loader = ({ request }: LoaderFunctionArgs) => handle(request)
export const action = ({ request }: ActionFunctionArgs) => handle(request)
