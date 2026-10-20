import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import {
	counter,
	durationBuckets,
	histogram,
} from "../metrics/registry.server.ts"
import {
	type DiscoverFilterArgs,
	discoverFilters,
	isDiscoverySearch,
	validDiscoverRanges,
} from "./discover-filters.ts"
import { mcpServerInfo } from "./identity.ts"
import { resultFacts, withPageLink } from "./links.ts"
import { readToolEnabled } from "./policy.server.ts"
import {
	POSTER_GRID_TOOLS,
	posterGridToolMeta,
	registerPosterGrid,
} from "./poster-grid.server.ts"
import type { RankedSearch } from "./ranked.server.ts"
import { paging, selected, similarTitles, titleDetails } from "./schemas.ts"
import type { enrichTitleResults } from "./title-results.server.ts"
import { registerWriteTools } from "./write-tools.server.ts"

const calls = counter(
	"goodwatch_mcp_tool_calls_total",
	"MCP tool calls by outcome.",
	["tool", "outcome"],
	64,
)
const durations = histogram(
	"goodwatch_mcp_tool_duration_seconds",
	"MCP tool duration.",
	["tool"],
	durationBuckets,
	32,
)
type EnrichTitleResults = typeof enrichTitleResults
export type ReadToolName =
	| "search_titles"
	| "discover_titles"
	| "get_discover_filters"
	| "get_title"
	| "get_similar_titles"
	| "get_my_shows"
	| "get_show_progress"
	| "get_tonight"
	| "get_library"
	| "get_taste"
	| "search_people"
	| "get_person"
	| "get_my_lists"
	| "get_list"
	| "get_settings"
export interface ReadArgs extends DiscoverFilterArgs {
	cursor?: string
	limit?: number
	query?: string
	ranked?: boolean
	for_you?: boolean
	exclude_seen?: boolean
	filter?: string
	sort?:
		| "added"
		| "waiting"
		| "last"
		| "score"
		| "title"
		| "match"
		| "runtime"
		| "for_you"
		| "newest"
	kind?: "all" | "movie" | "show"
	person_id?: number
	role?: "all" | "acting" | "directing" | "writing"
	list_id?: string
	title_id?: string
	title_name?: string
	year?: number
	include?: ("cast" | "scores" | "analysis" | "seasons" | "episodes")[]
	season_number?: number
	episode_cursor?: string
	episode_limit?: number
}
export const readToolDefinitions: {
	name: ReadToolName
	title: string
	description: string
	schema: z.ZodType<ReadArgs>
}[] = [
	{
		name: "search_titles",
		title: "Search titles by name",
		description:
			"Search movie and show names across the GoodWatch catalog, separate from your library. Name lookup by default; for descriptive queries, explicitly set ranked=true for an optional smarter match, ordered For you by default. Defaults to everywhere and includes seen titles. Use the shared Discover filters to narrow by type, genres, years, runtime, score, services, moods and more; get_discover_filters lists genres/provider IDs. Repeat filters with offset cursors; ranked cursors inherit their view. Use discover_titles whenever no name or descriptive query is given. Except when paging with a ranked cursor, a missing, empty or whitespace-only query runs the same Discover path, filters and For you default as discover_titles; ranked is ignored and no smarter-match attempt is charged. exclude_seen=true filters seen titles before paging. Returns up to 40 results by default. Different works can share a name and year; runtime_minutes can distinguish them. Smarter matches allow 20 uncached attempts per member per UTC day, one in flight, normalized queries cached for 60 seconds and paging is free.",
		schema: z
			.object({
				...discoverFilters,
				query: z
					.string()
					.trim()
					.max(120)
					.default("")
					.describe(
						"A title name or descriptive query. For recommendations without a query use discover_titles; blank queries run discovery.",
					),
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
				validDiscoverRanges,
				"Use ascending year/runtime bounds and choose either saved services or explicit providers",
			)
			.refine(
				(value) =>
					!value.cursor ||
					(value.cursor.startsWith("ranked:")
						? value.ranked
						: !value.ranked || isDiscoverySearch(value)),
				"Smarter matches use ranked: result cursors; name lookup and discovery use offset: cursors",
			),
	},
	{
		name: "discover_titles",
		title: "Discover movies and shows",
		description:
			"Discover without a query using the same catalog, filters and ordering as GoodWatch Discover/Explore. For you by default; everywhere and seen titles included. Choose popularity, newest, score or match ordering. Use on_my_services=true for saved services, or providers for specific services, in your saved country. get_discover_filters lists valid genres and providers. Filters apply before pagination. Repeat filters when paging with offset cursors. Returns up to 40 titles and a matching Discover grid page_url.",
		schema: z
			.object({
				...discoverFilters,
				...paging,
				limit: z.number().int().min(1).max(40).default(40),
				for_you: z.boolean().optional(),
				exclude_seen: z.boolean().optional(),
			})
			.strict()
			.refine(
				validDiscoverRanges,
				"Use ascending year/runtime bounds and choose either saved services or explicit providers",
			),
	},
	{
		name: "get_discover_filters",
		title: "Get Discover filter options",
		description:
			"List exact genre names, provider IDs/names available in your saved country (plus saved providers), and saved services for search_titles/discover_titles. Other filter choices are enumerated in those tools schemas. Reads existing settings without changing them.",
		schema: z.object({}).strict(),
	},
	{
		name: "get_title",
		title: "Get a title",
		description:
			"Catalog details, trailer, availability evidence and your marks. Default include=[cast,scores,analysis] adds five top-billed people and directors/creators, each with a ready-made person link, provider scores on labelled scales, and title analysis (moods, themes, tags, featured tropes). Pass include=[] for the smallest answer, or add seasons/episodes for the website’s season/episode ratings. Episodes use the website’s displayed numbering, which can differ from tracking; page with episode_cursor/episode_limit and optionally season_number. Unknown scores and watch dates stay unknown.",
		schema: titleDetails,
	},
	{
		name: "get_similar_titles",
		title: "More like this",
		description:
			"Find more like a movie or show from GoodWatch’s own title-page fingerprint neighbors (up to 80 candidates), with each result’s GoodWatch taste match and posters. Ordered For you by default; for_you=false keeps similarity order. Similarity describes the source title, never your taste match. Searches everywhere and includes seen titles by default; exclude_seen=true applies Not seen yet before paging. Not interested and Dropped are always hidden. kind filters all/movie/show. Keep title and filters unchanged when paging. No paid descriptive search is used.",
		schema: similarTitles,
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
	{
		name: "search_people",
		title: "Search people",
		description:
			"Search cast and crew matching the name query, most popular first (TMDB popularity). Results include each person’s ready-made link. Use the returned person_id with get_person for their acting, directing and writing filmography.",
		schema: z
			.object({ query: z.string().trim().min(2).max(120), ...paging })
			.strict(),
	},
	{
		name: "get_person",
		title: "Get a person's filmography",
		description:
			"A person's catalog credits with your GoodWatch taste match. Results include the subject’s ready-made person link and title links for credits. Includes every title, even without a poster or score. Defaults to For you, everywhere, including seen titles. Newest and score sort the whole filmography before paging; exclude_seen uses the site's Not seen yet rule. Links open the person's real GoodWatch page; its grouping can differ.",
		schema: z
			.object({
				person_id: z.number().int().positive().max(2_000_000_000),
				role: z.enum(["all", "acting", "directing", "writing"]).default("all"),
				sort: z.enum(["for_you", "newest", "score"]).default("for_you"),
				exclude_seen: z.boolean().default(false),
				...paging,
			})
			.strict(),
	},
	{
		name: "get_my_lists",
		title: "Get my share lists",
		description:
			"Your share lists from Lists, including unlisted lists, newest updated first. Each list has exactly five ranked titles and the share link produced by the site.",
		schema: z.object(paging).strict(),
	},
	{
		name: "get_list",
		title: "Get a share list",
		description:
			"Read one of your share lists and its five titles in rank order, with taste match and the site's share link. Other members' lists are not exposed by this tool.",
		schema: z
			.object({ list_id: z.string().regex(/^[0-9A-Za-z]{10}$/) })
			.strict(),
	},
	{
		name: "get_settings",
		title: "Get my settings",
		description:
			"Read Watching from (country), Show titles in (language), and saved streaming service IDs. Browser language is a saved setting, not a language inferred from your country. No browser locale is supplied by MCP.",
		schema: z.object({}).strict(),
	},
]

export const readToolNames: ReadonlySet<string> = new Set(
	readToolDefinitions.map((tool) => tool.name),
)

export function createToolServer(
	userId: string,
	origin: string,
	writes = false,
	rankedSearch?: RankedSearch,
	/** Tests only: replaces the taste and display enrichment. */
	enrich?: EnrichTitleResults,
) {
	const server = new McpServer(mcpServerInfo, {
		instructions: resultFacts,
	})
	for (const tool of readToolDefinitions) {
		if (!readToolEnabled(userId, tool.name)) continue
		const posters = POSTER_GRID_TOOLS.has(tool.name)
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
				_meta: {
					securitySchemes: [{ type: "oauth2", scopes: ["mcp:read"] }],
					...(posters ? posterGridToolMeta : {}),
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
							tool.name === "search_titles" &&
							args.ranked &&
							!isDiscoverySearch(args)
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
						enrich ??
						(await import("./title-results.server.ts")).enrichTitleResults
					)(userId, data, {
						posters: posters || tool.name === "get_title",
						taglines: tool.name === "get_tonight",
					})
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
	registerPosterGrid(server, origin)
	if (writes)
		registerWriteTools(server, userId, origin, (name, outcome, elapsed) => {
			calls.inc([name, outcome])
			durations.observe([name], elapsed)
		})
	return server
}
export const createReadToolServer = (userId: string, origin: string) =>
	createToolServer(userId, origin)
