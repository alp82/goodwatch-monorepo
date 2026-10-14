import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import {
	counter,
	durationBuckets,
	histogram,
} from "../metrics/registry.server.ts"
import { readToolEnabled } from "./policy.server.ts"
import type { RankedSearch } from "./ranked.server.ts"
import { paging, selected } from "./schemas.ts"
import { registerWriteTools } from "./write-tools.server.ts"

const calls = counter(
	"goodwatch_mcp_tool_calls_total",
	"MCP tool calls by outcome.",
	["tool", "outcome"],
	50,
)
const durations = histogram(
	"goodwatch_mcp_tool_duration_seconds",
	"MCP tool duration.",
	["tool"],
	durationBuckets,
	14,
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
	ranked?: boolean
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
			"Search all catalog titles, separate from your library. Cheap name lookup by default; ranked=true explicitly opts into ranked search: 20 uncached searches per member per UTC day, one in flight, normalized queries cached for 60 seconds and paging is free.",
		schema: z
			.object({
				query: z.string().trim().max(120).default(""),
				ranked: z.boolean().default(false),
				...paging,
				cursor: z
					.string()
					.regex(/^(offset:[0-9]{1,8}|ranked:[a-f0-9]{32}:[0-9]{1,8})$/)
					.optional(),
			})
			.strict()
			.refine(
				(value) =>
					!value.cursor || value.ranked === value.cursor.startsWith("ranked:"),
				"Ranked searches use ranked result cursors; name lookup uses offset cursors",
			),
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

export function createToolServer(
	userId: string,
	origin: string,
	writes = false,
	rankedSearch?: RankedSearch,
) {
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
			async (args: ReadArgs, context) => {
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
						data =
							tool.name === "search_titles" && args.ranked
								? await (
										rankedSearch ??
										(await import("./ranked.server.ts")).rankedSearch
									)(userId, origin, args, context.signal)
								: await (await import("./data.server.ts")).readMemberTool(
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
	if (writes)
		registerWriteTools(server, userId, origin, (name, outcome, elapsed) => {
			calls.inc([name, outcome])
			durations.observe([name], elapsed)
		})
	return server
}
export const createReadToolServer = (userId: string, origin: string) =>
	createToolServer(userId, origin)
