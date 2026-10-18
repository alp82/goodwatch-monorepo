import type { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import {
	type LanguageSetting,
	MEDIA_LANGUAGES,
} from "../../utils/media-language.ts"
import { counter } from "../metrics/registry.server.ts"
import {
	type BatchToolName,
	IMPORT_PATH,
	MAX_BATCH_ITEMS,
	isBatchTool,
} from "./batch.server.ts"
import { linkInstructions, titleLink } from "./links.ts"
import { writeToolEnabled } from "./policy.server.ts"
import { writeSelected } from "./schemas.ts"
import type { ReadArgs } from "./tools.server.ts"
import type { WriteToolName } from "./write-names.ts"
export interface WriteArgs extends ReadArgs {
	/** A batch: up to MAX_BATCH_ITEMS titles, each with this tool's fields; the top-level fields are defaults. */
	items?: Omit<WriteArgs, "action_id" | "items" | "batch_id">[]
	/** undo_watch only: the batch whose changes to take back. */
	batch_id?: string
	action_id: string
	language?: LanguageSetting
	list_id?: string
	list_name?: string
	visibility?: "public" | "unlisted"
	titles?: ReadArgs[]
	add_titles?: ReadArgs[]
	remove_title_ids?: string[]
	episode_end?: number
	whole_season?: boolean
	country?: string
	services?: (string | number)[]
	season?: number
	episode?: number
	date?: string
	score?: number | null
	want_to_see?: boolean
	not_interested?: boolean
	watch_id?: string
	status?: "Not started" | "Watching" | "On hold" | "Dropped" | "Seen"
}
const action = {
	action_id: z
		.string()
		.min(1)
		.max(100)
		.describe(
			"Stable ID for this exact action. Reuse it for retries; use a different ID for a new action.",
		),
}
const logWatchFields = {
	season: z.number().int().min(0).optional(),
	episode: z.number().int().min(1).max(100000).optional(),
	episode_end: z.number().int().min(1).max(100000).optional(),
	whole_season: z.boolean().optional(),
	date: z.iso.date().optional(),
}
const rateFields = { score: z.number().int().min(1).max(10).nullable() }
const wantFields = { want_to_see: z.boolean() }
const hiddenFields = { not_interested: z.boolean() }
const statusFields = {
	status: z.enum(["Not started", "Watching", "On hold", "Dropped", "Seen"]),
}
const watchId = z.string().min(1).max(100)

/** The single-title call of each batch tool. Every batch item, with the top-level fields filled in, must pass it. */
export const itemSchemas = {
	log_watch: writeSelected
		.safeExtend({ ...action, ...logWatchFields })
		.refine(
			(value) =>
				value.episode_end === undefined ||
				(value.season !== undefined &&
					value.season > 0 &&
					value.episode !== undefined &&
					value.episode_end >= value.episode),
			"A range needs a regular season and ascending episode numbers",
		)
		.refine(
			(value) =>
				!value.whole_season ||
				(value.season !== undefined &&
					value.season > 0 &&
					value.episode === undefined &&
					value.episode_end === undefined),
			"A whole season needs a regular season and no episode numbers",
		),
	rate_title: writeSelected.safeExtend({ ...action, ...rateFields }),
	set_want_to_see: writeSelected.safeExtend({ ...action, ...wantFields }),
	set_not_interested: writeSelected.safeExtend({ ...action, ...hiddenFields }),
	set_show_status: writeSelected.safeExtend({ ...action, ...statusFields }),
} satisfies Record<BatchToolName, z.ZodType<WriteArgs>>
const undoSingle = writeSelected.safeExtend({
	...action,
	watch_id: watchId.optional(),
})

function copyIssues(
	parsed: { success: boolean; error?: z.ZodError },
	ctx: z.RefinementCtx,
) {
	for (const issue of parsed.error?.issues ?? [])
		ctx.addIssue({ code: "custom", message: issue.message, path: issue.path })
}

/**
 * A batch tool's input: its single-title call as before, or `items`, a list of up to MAX_BATCH_ITEMS titles. A
 * single call is checked by the single schema exactly as before, so its arguments and receipts are unchanged.
 */
function batchable(single: z.ZodType<WriteArgs>, fields: z.ZodRawShape) {
	const optional = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => [
			key,
			(field as z.ZodType).optional(),
		]),
	)
	// The JSON Schema can't say "required unless items", so the description says it.
	const topLevel = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => {
			const schema = field as z.ZodType
			return [
				key,
				schema.safeParse(undefined).success
					? schema
					: schema
							.optional()
							.describe(
								"Required for a single title. With items, give it per item, or once here for every item.",
							),
			]
		}),
	)
	const item = z
		.object({ ...writeSelected.shape, ...optional })
		.strict()
		.refine(
			(value) => Boolean(value.title_id || value.title_name),
			"Each item needs title_id, or title_name with an optional year",
		)
	return z
		.object({
			...action,
			...writeSelected.shape,
			...topLevel,
			items: z
				.array(item)
				.min(1)
				.max(
					MAX_BATCH_ITEMS,
					`At most ${MAX_BATCH_ITEMS} items per call. Split the list into calls of ${MAX_BATCH_ITEMS} or fewer; for a whole history, the member can use the file import at ${IMPORT_PATH} on GoodWatch.`,
				)
				.optional()
				.describe(
					`Up to ${MAX_BATCH_ITEMS} titles in one call, in place of title_id or title_name. Each item takes title_id, or title_name with an optional year, plus this tool's fields; a field given at the top level applies to every item that leaves it out.`,
				),
		})
		.strict()
		.superRefine((value, ctx) => {
			if (value.items) {
				if (value.title_id || value.title_name || value.year !== undefined)
					ctx.addIssue({
						code: "custom",
						message:
							"Give either one title (title_id or title_name) or an items list, not both",
					})
				return
			}
			copyIssues(single.safeParse(value), ctx)
		}) as unknown as z.ZodType<WriteArgs>
}
export const writeToolDefinitions: {
	name: WriteToolName
	title: string
	description: string
	destructive: boolean
	schema: z.ZodType<WriteArgs>
}[] = [
	{
		name: "log_watch",
		title: "Log a watch",
		description:
			"Log one movie or episode watch, an inclusive episode range (season, episode, episode_end), or a whole season (season, whole_season=true). Ranges use the catalog season/episode numbers from get_show_progress, mark only aired regular episodes missing in the current pass, never duplicate existing watches, and produce one receipt. Dates remain unknown unless explicitly supplied. Results report every added watch. Batch items are movies, episode ranges or whole seasons; to mark a whole show as watched, use set_show_status with Seen.",
		destructive: true,
		schema: batchable(itemSchemas.log_watch, logWatchFields),
	},
	{
		name: "rate_title",
		title: "Rate a title",
		description:
			"Set a score from 1 to 10, or clear it with null. Clearing a score is destructive. A movie rating can own one undated watch; show ratings never log episodes or change show status. The result reports the previous score and exact watch changes.",
		destructive: true,
		schema: batchable(itemSchemas.rate_title, rateFields),
	},
	{
		name: "set_want_to_see",
		title: "Set Want to See",
		description:
			"Add or remove a title from your Wishlist. Removal is destructive. Adding a Seen title means Want to rewatch and preserves watches. Reports previous membership and added-at time.",
		destructive: true,
		schema: batchable(itemSchemas.set_want_to_see, wantFields),
	},
	{
		name: "set_not_interested",
		title: "Set Not interested",
		description:
			"Set or clear Not interested for an unseen, unrated title. Setting it removes an existing Wishlist entry and is destructive. Reports both marks before and after.",
		destructive: true,
		schema: batchable(itemSchemas.set_not_interested, hiddenFields),
	},
	{
		name: "set_show_status",
		title: "Set show status",
		description:
			"Apply a native show-status transition. Dropped and bulk Seen are destructive. Seen logs aired episodes with no dates. Watching from Seen starts a new pass while retaining earlier watches. Not started never erases watches. Reports previous/new status, pass and watch changes.",
		destructive: true,
		schema: batchable(itemSchemas.set_show_status, statusFields),
	},
	{
		name: "undo_watch",
		title: "Remove a watch",
		description:
			"Remove one watch record. Choose a watch_id, or omit it for the most recently logged individual watch of this title. Destructive: results identify the exact removed watch, date, pass and resulting marks; retrying the same action never removes a different watch. Or pass only batch_id (from a batch result) to take back every change that batch call made, title by title, through the same undo the site uses; a title changed again since keeps its newer value, and each title reports undone, partly_undone, already_undone, changed_since, not_undoable or error. A batch is undone once: undoing it again returns the first undo's result.",
		destructive: true,
		schema: z
			.object({
				...action,
				...writeSelected.shape,
				watch_id: watchId.optional(),
				batch_id: z
					.string()
					.min(1)
					.max(100)
					.optional()
					.describe(
						"The batch_id of a batch result. Alone (no title or watch_id), it takes back that whole call.",
					),
			})
			.strict()
			.superRefine((value, ctx) => {
				if (value.batch_id !== undefined) {
					if (
						value.title_id ||
						value.title_name ||
						value.year !== undefined ||
						value.watch_id
					)
						ctx.addIssue({
							code: "custom",
							message:
								"batch_id takes back a whole batch: leave out title_id, title_name, year and watch_id",
						})
					return
				}
				copyIssues(undoSingle.safeParse(value), ctx)
			}),
	},
	{
		name: "set_my_services",
		title: "Set my country and services",
		description:
			"Replace your saved country and streaming services. Country changes and removed services are destructive. Services accept exact names or numeric TMDB IDs; unknown/ambiguous names return choices without writing. Reports the full previous/new country and service IDs.",
		destructive: true,
		schema: z
			.object({
				...action,
				country: z
					.string()
					.trim()
					.regex(/^[A-Za-z]{2}$/)
					.transform((value) => value.toUpperCase()),
				services: z
					.array(
						z.union([
							z.number().int().positive(),
							z.string().trim().min(1).max(100),
						]),
					)
					.max(500),
			})
			.strict(),
	},
	{
		name: "set_settings",
		title: "Change Watching from or Show titles in",
		description:
			"Change your saved country (Watching from) and/or title language (Show titles in). Omitted fields and streaming services are preserved. Country and language are independent. Language browser follows your browser on the site. Reports previous and new preferences; concurrent changes return conflict.",
		destructive: true,
		schema: z
			.object({
				...action,
				country: z
					.string()
					.trim()
					.regex(/^[A-Za-z]{2}$/)
					.transform((value) => value.toUpperCase())
					.optional(),
				language: z.enum(["browser", ...MEDIA_LANGUAGES]).optional(),
			})
			.strict()
			.refine(
				(value) => value.country !== undefined || value.language !== undefined,
				"Supply country and/or language",
			),
	},
	{
		name: "create_list",
		title: "Create a share list",
		description:
			"Create a share list of exactly five distinct titles in rank order. Requires an existing site handle; if missing, returns handle_required and the Lists page. Uses the site's default card and Ember theme. Public by default; unlisted is accessible to anyone with the share link. Returns the site's real share link. Does not change ratings or Wishlist.",
		destructive: true,
		schema: z
			.object({
				...action,
				list_name: z.string().trim().min(1).max(80),
				titles: z.array(writeSelected).length(5),
				visibility: z.enum(["public", "unlisted"]).default("public"),
			})
			.strict(),
	},
	{
		name: "update_list_titles",
		title: "Add and remove share-list titles",
		description:
			"Atomically add and remove titles from one of your share lists. A share list always contains exactly five distinct titles: provide additions and removals together, with equal counts. Remaining titles keep their rank; added titles go at the end in supplied order. Returns previous/new rankings and the site's share link. A concurrent edit returns conflict; read again before choosing a new action. No ratings or Wishlist changes.",
		destructive: true,
		schema: z
			.object({
				...action,
				list_id: z.string().regex(/^[0-9A-Za-z]{10}$/),
				add_titles: z.array(writeSelected).min(1).max(5),
				remove_title_ids: z
					.array(z.string().regex(/^(movie|show):[1-9]\d{0,9}$/))
					.min(1)
					.max(5),
			})
			.strict()
			.refine(
				(value) => value.add_titles.length === value.remove_title_ids.length,
				"Add and remove equal numbers of titles to keep exactly five",
			),
	},
]
const batchItems = counter(
	"goodwatch_mcp_batch_items_total",
	"Items of MCP batch writes by result.",
	["tool", "status"],
	64,
)

/** How a batch tool's description explains items, the cap and the file import for whole histories. */
export const batchHint = (origin: string) =>
	`To change many titles at once, pass items instead of one title: up to ${MAX_BATCH_ITEMS} per call. Items are written independently and each reports done, already_set, not_found, ambiguous (with candidates; nothing written) or error, with a summary count and a batch_id; undo_watch with that batch_id takes back the whole call. For a full history (hundreds of titles or more), send the member to the file import instead: ${new URL(IMPORT_PATH, origin).href}`

export function registerWriteTools(
	server: McpServer,
	userId: string,
	origin: string,
	observe: (name: WriteToolName, outcome: string, seconds: number) => void,
) {
	for (const tool of writeToolDefinitions) {
		if (!writeToolEnabled(userId, tool.name)) continue
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: `${tool.description}${isBatchTool(tool.name) ? ` ${batchHint(origin)}` : ""} For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Otherwise provide title_name and optionally year. ${linkInstructions} Replayed results describe the original action, not current state; read again for current state.`,
				inputSchema: tool.schema,
				annotations: {
					readOnlyHint: false,
					destructiveHint: tool.destructive,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			async (args) => {
				const start = performance.now()
				let data: Record<string, unknown>
				try {
					data = writeToolEnabled(userId, tool.name)
						? await (await import("./writes.server.ts")).writeMemberTool(
								userId,
								origin,
								tool.name,
								args,
							)
						: {
								outcome: "disabled",
								message: "This tool is disabled for this member",
							}
				} catch {
					data = {
						outcome: "unavailable",
						message:
							"Could not determine this action’s outcome. Read the title or settings, and retry only with the same action ID.",
					}
				}
				// Historical receipts keep their stored state; enrich only their presentation for older results.
				const title = data.title
				if (
					title &&
					typeof title === "object" &&
					"name" in title &&
					"url" in title &&
					typeof title.name === "string" &&
					typeof title.url === "string"
				)
					data = {
						...data,
						title: {
							...title,
							link: titleLink(
								title.name,
								"year" in title && typeof title.year === "number"
									? title.year
									: null,
								title.url,
							),
						},
					}
				data = await (
					await import("./title-results.server.ts")
				).enrichTitleResults(userId, data, {
					posters:
						tool.name === "create_list" || tool.name === "update_list_titles",
				})
				const ok = ["applied", "unchanged"].includes(String(data.outcome))
				if (data.batch === true && !data.replayed && data.summary)
					for (const [status, count] of Object.entries(data.summary))
						if (status !== "total" && typeof count === "number" && count)
							batchItems.inc([tool.name, status], count)
				observe(
					tool.name,
					ok ? "ok" : "error",
					(performance.now() - start) / 1000,
				)
				return {
					content: [{ type: "text", text: JSON.stringify(data) }],
					structuredContent: data,
					isError: !ok,
				}
			},
		)
	}
}
