import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import {
	counter,
	durationBuckets,
	histogram,
} from "../metrics/registry.server.ts"
import { linkInstructions, withPageLink } from "./links.ts"
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
	for_you?: boolean
	exclude_seen?: boolean
	filter?: string
	sort?: "added" | "waiting" | "last" | "score" | "title" | "match" | "runtime"
	kind?: "all" | "movie" | "show"
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
		title: "Search titles by name",
		description:
			"Search movie and show names across the GoodWatch catalog, separate from your library. Name lookup by default; for descriptive queries, explicitly set ranked=true for an optional smarter match, ordered For you by default. Searches everywhere, including already seen titles, regardless of saved services/filters. Set exclude_seen=true for unseen results in one call; never loop over get_title to filter seen titles. Returns up to 40 results by default; request a smaller limit only when asked. Different works can share a name and year: use runtime_minutes to distinguish them. Smarter matches allow 20 uncached attempts per member per UTC day, one in flight, normalized queries cached for 60 seconds and paging is free.",
		schema: z
			.object({
				query: z.string().trim().max(120).default(""),
				ranked: z
					.boolean()
					.default(false)
					.describe(
						"Use an optional smarter match for descriptive queries instead of name lookup. Costs one of 20 daily attempts unless cached; paging is free.",
					),
				...paging,
				limit: z.number().int().min(1).max(40).default(40),
				for_you: z
					.boolean()
					.optional()
					.describe(
						"Smarter matches: use the site's For you ordering (default true). Keep unchanged when paging; a cursor inherits its original filters.",
					),
				exclude_seen: z
					.boolean()
					.optional()
					.describe(
						"Default false: include seen titles. True uses the site's Not seen yet rule: exclude rated, watched, in-progress, on-hold, dropped and quiz-skipped titles. Apply natively before paging.",
					),
				cursor: z
					.string()
					.regex(/^(offset:[0-9]{1,8}|ranked:[a-f0-9]{32}:[0-9]{1,8})$/)
					.optional(),
			})
			.strict()
			.refine(
				(value) =>
					!value.cursor || value.ranked === value.cursor.startsWith("ranked:"),
				"Smarter matches use ranked: result cursors; name lookup uses offset: cursors",
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
		title: "Watch next",
		description:
			"Choose one thing to watch next, using your saved country and services: a next episode from a show you are watching, otherwise a Wishlist movie or show to start (or a suggestion if the Wishlist is empty). For the full Wishlist / Want to See list (including sorting by date added), use get_library with filter=want_to_see.",
		schema: z.object({}).strict(),
	},
	{
		name: "get_library",
		title: "Get my library",
		description:
			"Your marked titles, including scores, Wishlist / Want to See, watch progress and Not interested. Use filter=want_to_see for your Wishlist; get_tonight chooses one thing to watch next. Includes added_at (Wishlist date, null when absent), runtime_minutes (movie duration or usual show episode length), and GoodWatch match. Defaults to match (Best match by your taste) when taste is available, otherwise the usual date sort. Use sort=runtime for the longest titles first across your entire filtered library, without per-title lookups. Explicit sorts are preserved. Sorts match My library: added (last added), last (last watched), score (highest first), title (ignores leading articles); waiting puts the oldest Wishlist additions first. Separate from search_titles.",
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
				sort: z
					.enum([
						"added",
						"waiting",
						"last",
						"score",
						"title",
						"match",
						"runtime",
					])
					.optional(),
				kind: z.enum(["all", "movie", "show"]).default("all"),
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
	const server = new McpServer(
		{ name: "goodwatch", version: "1.0.0" },
		{ instructions: linkInstructions },
	)
	for (const tool of definitions) {
		if (!readToolEnabled(userId, tool.name)) continue
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: `${tool.description} ${linkInstructions}`,
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
									)(userId, origin, args, context.mcpReq.signal)
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
					data = await (
						await import("./title-results.server.ts")
					).enrichTitleResults(userId, data)
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
				data = withPageLink(origin, tool.name, args, data)
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
