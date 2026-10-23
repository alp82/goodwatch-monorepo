export type CardAction =
	| "watch"
	| "share"
	| "similar"
	| "want"
	| "seen"
	| "rate"
	| "rate-submit"
export const isTitleId = (value: string) =>
	/^(movie|show):[1-9]\d{0,9}$/.test(value)
export function formatCustomId(action: CardAction, titleId: string): string {
	const value = `gw1:${action}:${titleId}`
	if (
		![
			"watch",
			"share",
			"similar",
			"want",
			"seen",
			"rate",
			"rate-submit",
		].includes(action) ||
		!isTitleId(titleId) ||
		value.length > 100
	)
		throw new Error("Invalid custom ID")
	return value
}
export function parseCustomId(
	value: string,
): { action: CardAction; titleId: string } | null {
	if (value.length > 100) return null
	const match =
		/^gw1:(watch|share|similar|want|seen|rate|rate-submit):((?:movie|show):[1-9]\d{0,9})$/.exec(
			value,
		)
	return match ? { action: match[1] as CardAction, titleId: match[2] } : null
}

export function listCustomId(
	action:
		| "open"
		| "person-share"
		| "similar-share"
		| "hot-share"
		| "discover"
		| "discover-share",
	value: string,
) {
	const id = `gw1:${action}:${value}`
	if (id.length > 100 || !/^[A-Za-z0-9_:.-]+$/.test(id))
		throw new Error("Invalid custom ID")
	return id
}
export function parseListId(id: string) {
	if (id.length > 100) return null
	const match =
		/^gw1:(open|person-share|similar-share|hot-share|discover|discover-share):([A-Za-z0-9_:.-]+)$/.exec(
			id,
		)
	if (!match) return null
	const [, action, value] = match
	if (action === "open" && !["private", "public"].includes(value)) return null
	if (action === "person-share" && !/^[1-9]\d{0,9}$/.test(value)) return null
	if (action === "similar-share" && !isTitleId(value)) return null
	if (action === "hot-share" && value !== "now") return null
	if (
		action.startsWith("discover") &&
		!/^(?:i[A-Za-z0-9_-]{1,65}|k[a-f0-9]{18}):\d{1,6}$/.test(value)
	)
		return null
	return { action, value }
}

export function undoCustomId(batchId: string, titleId: string) {
	const id = `gw1:undo:${batchId}:${titleId}`
	if (
		!/^gw1:undo:[A-Za-z0-9_-]{1,65}:(movie|show):[1-9]\d{0,9}$/.test(id) ||
		id.length > 100
	)
		throw new Error("Invalid undo ID")
	return id
}
export function parseUndoId(id: string) {
	if (id.length > 100) return null
	const match =
		/^gw1:undo:([A-Za-z0-9_-]{1,65}):((?:movie|show):[1-9]\d{0,9})$/.exec(id)
	return match ? { batchId: match[1], titleId: match[2] } : null
}

export type TogetherAction =
	| "join"
	| "yep"
	| "nope"
	| "undo"
	| "leave"
	| "pick"
	| "end"
	| "remove"
	| "choose"
export function togetherCustomId(
	action: TogetherAction,
	session: string,
	titleId?: string,
) {
	const id = `gw1:together:${action}:${session}${titleId ? `:${titleId}` : ""}`
	if (!parseTogetherId(id)) throw new Error("Invalid together custom ID")
	return id
}
export function parseTogetherId(
	id: string,
): { action: TogetherAction; session: string; titleId?: string } | null {
	if (id.length > 100) return null
	const match =
		/^gw1:together:(join|yep|nope|undo|leave|pick|end|remove|choose):([a-f0-9]{24})(?::((?:movie|show):[1-9]\d{0,9}))?$/.exec(
			id,
		)
	if (!match) return null
	const action = match[1] as TogetherAction
	if ((action === "yep" || action === "nope") && !match[3]) return null
	if (!["yep", "nope", "undo"].includes(action) && match[3]) return null
	return {
		action,
		session: match[2],
		...(match[3] ? { titleId: match[3] } : {}),
	}
}
