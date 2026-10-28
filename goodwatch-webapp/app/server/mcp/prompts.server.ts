import type { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import { MCP_PROMPT_EXAMPLES } from "../../ui/connector/example-prompts.ts"

type PromptArgs = Record<string, string | undefined>
type PromptDefinition = {
	name: keyof typeof MCP_PROMPT_EXAMPLES
	description: string
	args: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>
	ask: (args: PromptArgs) => string
	steps: readonly [tool: string, usage: string][]
}
const title = z
	.string()
	.trim()
	.min(1)
	.describe("movie or show name, with year if known")

export const promptDefinitions: readonly PromptDefinition[] = [
	{
		name: "watch_tonight",
		description: "pick something to watch next on my saved services",
		args: {},
		ask: () => MCP_PROMPT_EXAMPLES.watch_tonight,
		steps: [
			["get_settings", "read my saved country and services"],
			[
				"get_tonight",
				"get one pick and its availability, noting any missing availability evidence",
			],
		],
	},
	{
		name: "log_and_score",
		description: "log a movie or episode watch and save my score",
		args: {
			title,
			episode: z
				.string()
				.trim()
				.min(1)
				.optional()
				.describe("optional episode in s2e4 form"),
			score: z
				.string()
				.regex(/^(10|[1-9])$/)
				.describe("my whole-number score from 1 to 10"),
		},
		ask: ({ title, episode, score }) =>
			`just watched ${title}${episode ? ` ${episode}` : ""}, score it with ${score}`,
		steps: [
			[
				"search_titles",
				"resolve the title to its id; ask me about ambiguous titles or missing show episode details",
			],
			[
				"log_watch",
				"log the movie or specified episode with its id and tracking season/episode numbers; leave the date unknown unless i supplied it",
			],
			[
				"rate_title",
				"save my numeric score with the same id and, if supplied, season/episode",
			],
		],
	},
	{
		name: "more_like_this",
		description: "find something like a title i loved",
		args: { title },
		ask: ({ title }) => `something like ${title}`,
		steps: [
			[
				"search_titles",
				"resolve the title i loved to its id, clarifying ambiguity",
			],
			[
				"get_similar_titles",
				"find similar titles using that id, with exclude_seen=true and the default for-you ordering",
			],
		],
	},
	{
		name: "where_to_stream",
		description: "find where a title streams in my saved country",
		args: { title },
		ask: ({ title }) => `where can i stream ${title}`,
		steps: [
			["get_settings", "read my saved country and services"],
			["search_titles", "resolve the title to its id, clarifying ambiguity"],
			[
				"get_title",
				"read availability and provider links for that id; distinguish unknown availability and fallback links from playback links",
			],
		],
	},
	{
		name: "catch_up_shows",
		description: "catch me up on what is next across my watching shows",
		args: {},
		ask: () => MCP_PROMPT_EXAMPLES.catch_up_shows,
		steps: [
			["get_my_shows", "page through my shows and identify the watching shows"],
			[
				"get_show_progress",
				"read each watching show's next episode and progress; distinguish episodes ready to watch from waiting for new ones",
			],
		],
	},
	{
		name: "bulk_mark_seen",
		description:
			"mark a pasted list as seen with scores and keep batch ids for undo",
		args: {
			titles: z
				.string()
				.trim()
				.min(1)
				.describe(
					"pasted movie/show names, optional years, and optional scores from 1 to 10",
				),
		},
		ask: ({ titles }) => `${MCP_PROMPT_EXAMPLES.bulk_mark_seen}:\n${titles}`,
		steps: [
			[
				"search_titles",
				"resolve each entry to an id and movie/show type; clarify ambiguous entries before writing",
			],
			[
				"log_watch",
				"batch the movies as items, up to 50 per call, leaving unspecified dates unknown",
			],
			[
				"set_show_status",
				"batch the shows as items with status=Seen, up to 50 per call; this marks aired episodes without dates",
			],
			[
				"rate_title",
				"batch only supplied whole-title scores as items, up to 50 per call, using numeric scores",
			],
			[
				"undo_watch",
				"report every returned batch_id with its operation and item failures; explain that batch_id takes back undoable changes while preserving newer edits, without calling undo unless i request it",
			],
		],
	},
	{
		name: "top_five_year",
		description:
			"build a top-5 share list from my highest-scored releases of a year",
		args: {
			year: z
				.string()
				.regex(/^\d{4}$/)
				.describe("four-digit release year, not the year i watched it"),
		},
		ask: ({ year }) => `make a top 5 list from ${year}`,
		steps: [
			[
				"get_library",
				"read filter=rated with sort=score, paging until five titles from the requested release year are found or results end; ask about ties and stop if fewer than five qualify",
			],
			[
				"create_list",
				"create exactly five distinct ids in score order with a suitable list_name; return the share link, or explain handle_required if no site handle exists",
			],
		],
	},
	{
		name: "compare_my_taste",
		description: "compare a title with my taste and explain the fit",
		args: { title },
		ask: ({ title }) => `would i like ${title} and why`,
		steps: [
			["search_titles", "resolve the title to its id, clarifying ambiguity"],
			["get_taste", "read my taste signal and strongest attributes"],
			[
				"get_title",
				"read the title with analysis and scores; compare its attributes with my taste and returned match, acknowledging insufficient evidence",
			],
		],
	},
]

export function registerPrompts(
	server: McpServer,
	availableTools: ReadonlySet<string>,
) {
	for (const prompt of promptDefinitions) {
		if (!prompt.steps.every(([tool]) => availableTools.has(tool))) continue
		// registerPrompt declares the SDK's prompts capability and installs list/get handlers.
		server.registerPrompt(
			prompt.name,
			{
				title: MCP_PROMPT_EXAMPLES[prompt.name],
				description: prompt.description,
				argsSchema: z.object(prompt.args).strict(),
			},
			(args) => ({
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `${prompt.ask(args)}\n\n${prompt.steps.map(([tool, usage], i) => `${i + 1}. ${tool}: ${usage}`).join("\n")}${prompt.steps.some(([tool]) => ["log_watch", "create_list"].includes(tool)) ? "\nuse a distinct action_id for each write call, reusing it only for retries of that exact call" : ""}`,
						},
					},
				],
			}),
		)
	}
}
