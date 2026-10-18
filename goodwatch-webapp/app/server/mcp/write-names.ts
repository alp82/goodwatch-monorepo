export const writeToolNames = new Set([
	"log_watch",
	"rate_title",
	"set_want_to_see",
	"set_not_interested",
	"set_show_status",
	"undo_watch",
	"set_my_services",
	"set_settings",
	"create_list",
	"update_list_titles",
] as const)
export type WriteToolName =
	| "log_watch"
	| "rate_title"
	| "set_want_to_see"
	| "set_not_interested"
	| "set_show_status"
	| "undo_watch"
	| "set_my_services"
	| "set_settings"
	| "create_list"
	| "update_list_titles"
export function isWriteTool(name: unknown): name is WriteToolName {
	return typeof name === "string" && writeToolNames.has(name as WriteToolName)
}

export function isWriteCall(message: unknown): boolean {
	if (
		!message ||
		typeof message !== "object" ||
		!("method" in message) ||
		message.method !== "tools/call" ||
		!("params" in message)
	)
		return false
	const params = message.params
	return Boolean(
		params &&
			typeof params === "object" &&
			"name" in params &&
			isWriteTool(params.name),
	)
}

/** What one title write costs: a whole show marked Seen or a whole season logs many episodes at once. */
export const HEAVY_WRITE_COST = 5

/**
 * What the write calls of a request body cost against the member's write budget, and how many of them are batches.
 * A single write costs 1 (5 when heavy), a batch the sum of its items up to the cap (a longer list is refused
 * unwritten), and undoing a batch as much as a full batch.
 */
export function writeItemCount(
	body: unknown,
	cap: number,
): { count: number; batches: number } {
	let count = 0
	let batches = 0
	for (const message of Array.isArray(body) ? body : [body]) {
		if (!isWriteCall(message)) continue
		const params = (
			message as { params: { name: WriteToolName; arguments?: unknown } }
		).params
		const args =
			params.arguments && typeof params.arguments === "object"
				? (params.arguments as Record<string, unknown>)
				: {}
		const cost = (fields: Record<string, unknown>) =>
			(params.name === "set_show_status" && fields.status === "Seen") ||
			(params.name === "log_watch" && fields.whole_season === true)
				? HEAVY_WRITE_COST
				: 1
		if (params.name === "undo_watch" && args.batch_id !== undefined) {
			batches++
			count += cap
		} else if (Array.isArray(args.items)) {
			batches++
			count += Math.max(
				1,
				args.items.slice(0, cap).reduce(
					(sum: number, item: unknown) =>
						sum +
						cost({
							...args,
							...(item && typeof item === "object" ? item : {}),
						}),
					0,
				),
			)
		} else count += cost(args)
	}
	return { count, batches }
}
