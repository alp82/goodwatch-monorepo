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
