import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import {
	counter,
	durationBuckets,
	histogram,
} from "../metrics/registry.server.ts"
import { readToolEnabled } from "./policy.server.ts"

const calls = counter(
	"goodwatch_mcp_tool_calls_total",
	"MCP read tool calls by outcome.",
	["tool", "outcome"],
	50,
)
const durations = histogram(
	"goodwatch_mcp_tool_duration_seconds",
	"MCP read tool duration.",
	["tool"],
	durationBuckets,
	7,
)
const paging = {
	cursor: z
		.string()
		.regex(/^offset:[0-9]{1,8}$/)
		.optional(),
	limit: z.number().int().min(1).max(20).default(20),
}
const selector = {
	title_id: z
		.string()
		.regex(/^(movie|show):[1-9]\d{0,9}$/)
		.optional(),
	title_name: z.string().trim().min(2).max(120).optional(),
	year: z.number().int().min(1800).max(2100).optional(),
}
const selected = z
	.object(selector)
	.strict()
	.refine(
		(value) => Boolean(value.title_id) !== Boolean(value.title_name),
		"Exactly one title_id or title_name is required",
	)
export type ReadToolName =
	| "search_titles"
	| "get_title"
	| "get_my_shows"
	| "get_show_progress"
	| "get_tonight"
	| "get_library"
	| "get_taste"
export interface ReadArgs {
	cursor?: string
	limit?: number
	query?: string
	filter?: string
	title_id?: string
	title_name?: string
	year?: number
}
const definitions: {
	name: ReadToolName
	title: string
	description: string
	schema: z.ZodType<ReadArgs>
}[] = [
	{
		name: "search_titles",
		title: "Search all catalog titles",
		description:
			"Cheap catalog name lookup of all titles, separate from your library. Does not run ranked search or spend its daily budget.",
		schema: z
			.object({ query: z.string().trim().max(120).default(""), ...paging })
			.strict(),
	},
	{
		name: "get_title",
		title: "Get a title",
		description:
			"Catalog details, availability evidence and your marks for one title. Unknown watch dates stay unknown.",
		schema: selected,
	},
	{
		name: "get_my_shows",
		title: "Get my shows",
		description:
			"Only your shows: Continue, Pick up, Waiting for episodes, Want to See, On hold and Dropped.",
		schema: z.object(paging).strict(),
	},
	{
		name: "get_show_progress",
		title: "Get show progress",
		description:
			"Your current pass, next episode and paged watches. Dates are unknown unless recorded.",
		schema: selected.safeExtend(paging),
	},
	{
		name: "get_tonight",
		title: "Get tonight's pick",
		description:
			"Your next episode or Wishlist choice, using your saved country and services.",
		schema: z.object({}).strict(),
	},
	{
		name: "get_library",
		title: "Get my library",
		description:
			"Only your marked titles, including scores, Want to See, watch progress and Not interested. Separate from search_titles.",
		schema: z
			.object({
				filter: z
					.enum([
						"all",
						"want_to_see",
						"seen",
						"not_interested",
						"rated",
						"watching",
						"on_hold",
						"dropped",
						"unrated",
					])
					.default("all"),
				...paging,
			})
			.strict(),
	},
	{
		name: "get_taste",
		title: "Get my taste",
		description:
			"Your real taste signal and strongest attributes; explains when there is not enough evidence.",
		schema: z.object({}).strict(),
	},
]

export function createReadToolServer(userId: string, origin: string) {
	const server = new McpServer({ name: "goodwatch", version: "1.0.0" })
	for (const tool of definitions) {
		if (!readToolEnabled(userId, tool.name)) continue
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.schema,
				annotations: {
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			async (args: ReadArgs) => {
				const start = performance.now()
				let outcome = "ok"
				let data: Record<string, unknown>
				try {
					if (!readToolEnabled(userId, tool.name)) {
						outcome = "disabled"
						data = {
							status: "tool_disabled",
							message: "This tool is disabled for this member",
						}
					} else {
						data = await (await import("./data.server.ts")).readMemberTool(
							userId,
							origin,
							tool.name,
							args,
						)
						if (
							typeof data.status === "string" &&
							![
								"not_started",
								"watching",
								"on_hold",
								"dropped",
								"seen",
							].includes(data.status)
						)
							outcome = "error"
					}
				} catch {
					outcome = "error"
					data = {
						status: "data_unavailable",
						message: "Could not read GoodWatch data. Try again later.",
					}
				} finally {
					calls.inc([tool.name, outcome])
					durations.observe([tool.name], (performance.now() - start) / 1000)
				}
				return {
					content: [{ type: "text", text: JSON.stringify(data) }],
					structuredContent: data,
					isError: outcome !== "ok",
				}
			},
		)
	}
	return server
}
