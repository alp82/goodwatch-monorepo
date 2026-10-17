import type { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import { linkInstructions, titleLink } from "./links.ts"
import { writeToolEnabled } from "./policy.server.ts"
import {
	MEDIA_LANGUAGES,
	type LanguageSetting,
} from "../../utils/media-language.ts"
import { writeSelected } from "./schemas.ts"
import type { ReadArgs } from "./tools.server.ts"
import type { WriteToolName } from "./write-names.ts"
export interface WriteArgs extends ReadArgs {
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
			"Log one movie or episode watch, an inclusive episode range (season, episode, episode_end), or a whole season (season, whole_season=true). Ranges use the catalog season/episode numbers from get_show_progress, mark only aired regular episodes missing in the current pass, never duplicate existing watches, and produce one receipt. Dates remain unknown unless explicitly supplied. Results report every added watch.",
		destructive: false,
		schema: writeSelected
			.safeExtend({
				...action,
				season: z.number().int().min(0).optional(),
				episode: z.number().int().min(1).max(100000).optional(),
				episode_end: z.number().int().min(1).max(100000).optional(),
				whole_season: z.boolean().optional(),
				date: z.iso.date().optional(),
			})
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
	},
	{
		name: "rate_title",
		title: "Rate a title",
		description:
			"Set a score from 1 to 10, or clear it with null. Clearing a score is destructive. A movie rating can own one undated watch; show ratings never log episodes or change show status. The result reports the previous score and exact watch changes.",
		destructive: true,
		schema: writeSelected.safeExtend({
			...action,
			score: z.number().int().min(1).max(10).nullable(),
		}),
	},
	{
		name: "set_want_to_see",
		title: "Set Want to See",
		description:
			"Add or remove a title from your Wishlist. Removal is destructive. Adding a Seen title means Want to rewatch and preserves watches. Reports previous membership and added-at time.",
		destructive: true,
		schema: writeSelected.safeExtend({ ...action, want_to_see: z.boolean() }),
	},
	{
		name: "set_not_interested",
		title: "Set Not interested",
		description:
			"Set or clear Not interested for an unseen, unrated title. Setting it removes an existing Wishlist entry and is destructive. Reports both marks before and after.",
		destructive: true,
		schema: writeSelected.safeExtend({
			...action,
			not_interested: z.boolean(),
		}),
	},
	{
		name: "set_show_status",
		title: "Set show status",
		description:
			"Apply a native show-status transition. Dropped and bulk Seen are destructive. Seen logs aired episodes with no dates. Watching from Seen starts a new pass while retaining earlier watches. Not started never erases watches. Reports previous/new status, pass and watch changes.",
		destructive: true,
		schema: writeSelected.safeExtend({
			...action,
			status: z.enum(["Not started", "Watching", "On hold", "Dropped", "Seen"]),
		}),
	},
	{
		name: "undo_watch",
		title: "Remove a watch",
		description:
			"Remove one watch record. Choose a watch_id, or omit it for the most recently logged individual watch of this title. Destructive: results identify the exact removed watch, date, pass and resulting marks; retrying the same action never removes a different watch.",
		destructive: true,
		schema: writeSelected.safeExtend({
			...action,
			watch_id: z.string().min(1).max(100).optional(),
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
		destructive: false,
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
				description: `${tool.description} For title actions, title_id takes precedence; title_name and year are ignored when an ID is supplied. Otherwise provide title_name and optionally year. ${linkInstructions} Replayed results describe the original action, not current state; read again for current state.`,
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
