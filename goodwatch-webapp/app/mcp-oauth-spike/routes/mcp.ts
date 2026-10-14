import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { requireMcpAuth } from "@better-auth/mcp"
import * as z from "zod"
import { auth, audit, ready, resource } from "../auth.server"
import { titles, shows } from "../fixtures.server"

const annotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
}
const protectedHandler = requireMcpAuth(
	auth,
	async (request, claims) => {
		const handler = createMcpHandler(
			() => {
				const server = new McpServer({
					name: "goodwatch-oauth-spike",
					version: "0.0.1",
				})
				const output = (tool: string, data: Record<string, unknown>) => {
					audit("tool-call", { tool, member: claims.sub })
					return {
						content: [{ type: "text" as const, text: JSON.stringify(data) }],
						structuredContent: data,
					}
				}
				server.registerTool(
					"get_title",
					{
						title: "Get a title",
						description: "Read one fictional movie or show by its fixture ID.",
						inputSchema: z.object({ title_id: z.string() }),
						annotations,
					},
					async ({ title_id }) =>
						output("get_title", {
							title: titles.find((title) => title.id === title_id) ?? null,
							fixture: true,
						}),
				)
				server.registerTool(
					"get_my_shows",
					{
						title: "Get my shows",
						description:
							"Read the signed-in demo member's fictional show progress.",
						inputSchema: z.object({}),
						annotations,
					},
					async () =>
						output("get_my_shows", {
							memberId: claims.sub,
							shows,
							fixture: true,
						}),
				)
				server.registerTool(
					"search_titles",
					{
						title: "Search titles",
						description:
							"Search the small fictional catalog by name. An empty query lists all fixtures.",
						inputSchema: z.object({ query: z.string() }),
						annotations,
					},
					async ({ query }) =>
						output("search_titles", {
							titles: titles.filter((title) =>
								title.name.toLowerCase().includes(query.toLowerCase()),
							),
							fixture: true,
						}),
				)
				return server
			},
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
		challengeScopes: ["mcp:read", "offline_access"],
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
