import type { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod4"
import { linkInstructions, titleLink } from "./links.ts"
import { writeToolEnabled } from "./policy.server.ts"
import { writeSelected } from "./schemas.ts"
import type { ReadArgs } from "./tools.server.ts"
import type { WriteToolName } from "./write-names.ts"
export interface WriteArgs extends ReadArgs {
	action_id: string
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
const definitions: {
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
			"Log one movie or episode watch. Dates remain unknown unless explicitly supplied. Results say exactly which watches and marks changed.",
		destructive: false,
		schema: writeSelected.safeExtend({
			...action,
			season: z.number().int().min(0).optional(),
			episode: z.number().int().min(1).optional(),
			date: z.iso.date().optional(),
		}),
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
]
export function registerWriteTools(
	server: McpServer,
	userId: string,
	origin: string,
	observe: (name: WriteToolName, outcome: string, seconds: number) => void,
) {
	for (const tool of definitions) {
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
				).enrichTitleResults(userId, data)
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
