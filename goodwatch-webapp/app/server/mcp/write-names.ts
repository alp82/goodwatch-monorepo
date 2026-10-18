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

/**
 * How many title writes a request body asks for: each write call counts once, a batch call once per item (at
 * most the cap; a longer list is refused unwritten). The endpoint counts these against the member's write budget.
 */
export function writeItemCount(body: unknown, cap: number): number {
	let count = 0
	for (const message of Array.isArray(body) ? body : [body]) {
		if (!isWriteCall(message)) continue
		const params = (message as { params: { arguments?: unknown } }).params
		const items =
			params.arguments && typeof params.arguments === "object"
				? (params.arguments as { items?: unknown }).items
				: undefined
		count += Array.isArray(items) ? Math.min(Math.max(items.length, 1), cap) : 1
	}
	return count
}
