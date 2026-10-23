import type { TitleWrite } from "../mcp/title-write.server.ts"
import { MAX_BATCH_ITEMS } from "../mcp/batch.server.ts"
import { WRITE_ITEM_WINDOWS } from "../mcp/write-budget.ts"
import type { WriteArgs } from "../mcp/write-tools.server.ts"
import type { WriteToolName } from "../mcp/write-names.ts"
import { HEAVY_WRITE_COST, writeItemCount } from "../mcp/write-names.ts"
import type { RateVerdict, RateWindow } from "../rate-limit.server.ts"

type Data = Record<string, unknown>
interface Ports {
	receipt(userId: string, actionId: string): Promise<Data | null>
	write(
		userId: string,
		origin: string,
		name: WriteToolName,
		args: WriteArgs,
	): Promise<Data>
	take(
		userId: string,
		windows: RateWindow[],
		cost: number,
	): Promise<RateVerdict>
}
/** Uses the same member budget and durable receipts as MCP, without its transport switches. */
export function createDiscordWriter(ports: Ports) {
	return async (
		userId: string,
		origin: string,
		name: WriteToolName,
		args: WriteArgs,
	): Promise<Data> => {
		let undoItems: number | undefined
		if (name === "undo_watch" && args.batch_id) {
			// Receipt reads are scoped to the current GoodWatch member, including after a relink.
			const receipt = await ports.receipt(userId, args.batch_id)
			if (!receipt)
				return {
					outcome: "refused",
					message: "Only the person who made this change can undo it.",
				}
			if (Array.isArray(receipt.items))
				undoItems = Math.max(1, Math.min(MAX_BATCH_ITEMS, receipt.items.length))
		} else {
			// Discord receipts intentionally replay without a hash check: the interaction ID identifies the original press.
			const prior = await ports.receipt(userId, args.action_id)
			if (prior) return prior
		}
		let { count } = writeItemCount(
			{ method: "tools/call", params: { name, arguments: args } },
			MAX_BATCH_ITEMS,
		)
		if (undoItems !== undefined) count = undoItems
		if (
			name === "log_watch" &&
			args.items?.some((item) => item.title_id?.startsWith("show:"))
		)
			count = HEAVY_WRITE_COST
		const budget = await ports.take(userId, WRITE_ITEM_WINDOWS, count)
		if (!budget.allowed)
			return {
				outcome: "refused",
				message: `Too many title writes for now. Try again in ${budget.retryAfterSeconds} seconds.`,
			}
		return ports.write(userId, origin, name, args)
	}
}
export const discordWrite = createDiscordWriter({
	receipt: async (...args) =>
		(await import("../mcp/actions.server.ts")).readActionResult(...args),
	write: async (...args) => {
		const { writeMemberTool, liveWritePorts } = await import(
			"../mcp/writes.server.ts"
		)
		return writeMemberTool(...args, {
			...liveWritePorts,
			applyTitleWrite: async (
				userId,
				origin,
				name,
				input,
				title,
				before,
				actionId,
			) => {
				if (
					name !== "log_watch" ||
					title.media_type !== "show" ||
					input.season !== undefined ||
					input.episode !== undefined
				)
					return liveWritePorts.applyTitleWrite(
						userId,
						origin,
						name,
						input,
						title,
						before,
						actionId,
					)
				const { applyShowTrackingAction } = await import(
					"../show-tracking.server.ts"
				)
				return logShowWatch(
					applyShowTrackingAction,
					userId,
					title.tmdb_id,
					actionId,
					input.date!,
				)
			},
		})
	},
	take: async (userId, windows, cost) =>
		(await import("../rate-limit.server.ts")).rateLimiter.take(
			"mcp-write-items",
			userId,
			windows,
			cost,
		),
})

/** Discord's title-level Seen logs aired episodes, using the native press and its reversible group. */
export async function logShowWatch(
	apply: (
		userId: string,
		action: import("../show-tracking.server.ts").ShowAction,
	) => Promise<{ status: string; refused: string | null; rows: unknown[] }>,
	userId: string,
	titleId: number,
	actionId: string,
	day: string,
): Promise<TitleWrite> {
	const result = await apply(userId, {
		id: titleId,
		actionId,
		event: { type: "pressSeen", today: day },
	})
	if (result.status !== "applied")
		return { refused: result.refused ?? "Could not log this show." }
	if (result.rows.length) {
		const dated = await apply(userId, {
			id: titleId,
			event: { type: "setGroupDate", group: actionId, day },
		})
		if (dated.status !== "applied")
			throw new Error("Could not date the show's watches")
	}
	return { removedWatchId: null, event: "pressSeen" }
}
