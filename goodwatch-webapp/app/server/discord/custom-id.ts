export type CardAction =
	| "country"
	| "watch"
	| "share"
	| "similar"
	| "want"
	| "seen"
	| "rate"
	| "rate-submit"
export const isTitleId = (value: string) =>
	/^(movie|show):[1-9]\d{0,9}$/.test(value)
/** Actions whose card or result keeps the list the title was opened from, for Back. */
const KEEPS_BACK = [
	"country",
	"share",
	"watch",
	"want",
	"seen",
	"rate",
	"rate-submit",
]
/** The custom ID for a title action. A list reference that would pass Discord's 100 characters is left out. */
export function formatCustomId(
	action: CardAction,
	titleId: string,
	back?: ListRef,
	country?: string,
): string {
	if (country && !/^[A-Z]{2}$/.test(country)) throw new Error("Invalid country")
	const plain = `gw1:${action}:${titleId}${country ? `:c${country}` : ""}`
	const withBack =
		KEEPS_BACK.includes(action) && back
			? `${plain}:${formatListRef(back)}`
			: plain
	const value = withBack.length <= 100 ? withBack : plain
	if (
		![
			"country",
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
export function parseCustomId(value: string): {
	action: CardAction
	titleId: string
	back?: ListRef
	country?: string
} | null {
	if (value.length > 100) return null
	const match =
		/^gw1:(country|watch|share|similar|want|seen|rate|rate-submit):((?:movie|show):[1-9]\d{0,9})(?::c([A-Z]{2}))?(?::(.+))?$/.exec(
			value,
		)
	if (!match) return null
	const back = match[4] ? parseListRef(match[4]) : null
	if (match[4] && (!KEEPS_BACK.includes(match[1]) || !back)) return null
	return {
		action: match[1] as CardAction,
		titleId: match[2],
		...(match[3] ? { country: match[3] } : {}),
		...(back ? { back } : {}),
	}
}

const STATE = "(?:i[A-Za-z0-9_-]{1,65}|k[a-f0-9]{18})"
const PAGE = "\\d{1,6}"

/**
 * Where a title came from, so its card can offer Back: `d:<state>:<page>` (/discover), `q:<state>:<page>` (/search),
 * `s:<title ID>` (/similar), `p:<person ID>` (/person), `h:<page>` (/hot), `n` (/next).
 */
export type ListRef =
	| { kind: "discover" | "search"; key: string; page: number }
	| { kind: "similar"; titleId: string }
	| { kind: "person"; personId: number }
	| { kind: "hot"; page: number }
	| { kind: "next" }

const REF = new RegExp(
	`^(?:([dq]):(${STATE}):(${PAGE})|s:((?:movie|show):[1-9]\\d{0,9})|p:([1-9]\\d{0,9})|h:(${PAGE})|(n))$`,
)

export function formatListRef(ref: ListRef) {
	switch (ref.kind) {
		case "discover":
		case "search":
			return `${ref.kind === "discover" ? "d" : "q"}:${ref.key}:${ref.page}`
		case "similar":
			return `s:${ref.titleId}`
		case "person":
			return `p:${ref.personId}`
		case "hot":
			return `h:${ref.page}`
		case "next":
			return "n"
	}
}

export function parseListRef(value: string): ListRef | null {
	const m = REF.exec(value)
	if (!m) return null
	if (m[1])
		return {
			kind: m[1] === "d" ? "discover" : "search",
			key: m[2],
			page: Number(m[3]),
		}
	if (m[4]) return { kind: "similar", titleId: m[4] }
	if (m[5]) return { kind: "person", personId: Number(m[5]) }
	if (m[7]) return { kind: "next" }
	return { kind: "hot", page: Number(m[6]) }
}

export type ListAction =
	| "open"
	| "back"
	| "person-share"
	| "similar-share"
	| "hot"
	| "hot-share"
	| "discover"
	| "discover-share"
	| "search"
	| "search-share"
	| "profile-share"

export function listCustomId(action: ListAction, value: string) {
	const id = `gw1:${action}:${value}`
	if (id.length > 100 || !/^[A-Za-z0-9_:.-]+$/.test(id))
		throw new Error("Invalid custom ID")
	return id
}
export function parseListId(id: string) {
	if (id.length > 100) return null
	const match =
		/^gw1:(open|back|person-share|similar-share|hot|hot-share|discover|discover-share|search|search-share|profile-share):([A-Za-z0-9_:.-]+)$/.exec(
			id,
		)
	if (!match) return null
	const [, action, value] = match as unknown as [string, ListAction, string]
	if (
		action === "open" &&
		!["private", "public"].includes(value) &&
		!parseListRef(value)
	)
		return null
	if (action === "back" && !parseListRef(value)) return null
	if (action === "person-share" && !/^[1-9]\d{0,9}$/.test(value)) return null
	if (action === "similar-share" && !isTitleId(value)) return null
	if (action === "profile-share" && !/^[a-z]{1,20}$/.test(value)) return null
	if (action === "hot" && !new RegExp(`^${PAGE}$`).test(value)) return null
	if (
		action === "hot-share" &&
		value !== "now" &&
		!new RegExp(`^${PAGE}$`).test(value)
	)
		return null
	if (
		(action.startsWith("discover") || action.startsWith("search")) &&
		!new RegExp(`^${STATE}:${PAGE}$`).test(value)
	)
		return null
	return { action, value }
}

/** Undo for one write; `back` keeps the list the title was opened from when it fits in 100 characters. */
export function undoCustomId(batchId: string, titleId: string, back?: ListRef) {
	const id = `gw1:undo:${batchId}:${titleId}`
	if (
		!/^gw1:undo:[A-Za-z0-9_-]{1,65}:(movie|show):[1-9]\d{0,9}$/.test(id) ||
		id.length > 100
	)
		throw new Error("Invalid undo ID")
	const withBack = back ? `${id}:${formatListRef(back)}` : id
	return withBack.length <= 100 ? withBack : id
}
export function parseUndoId(
	id: string,
): { batchId: string; titleId: string; back?: ListRef } | null {
	if (id.length > 100) return null
	const match =
		/^gw1:undo:([A-Za-z0-9_-]{1,65}):((?:movie|show):[1-9]\d{0,9})(?::(.+))?$/.exec(
			id,
		)
	if (!match) return null
	const back = match[3] ? parseListRef(match[3]) : null
	if (match[3] && !back) return null
	return { batchId: match[1], titleId: match[2], ...(back ? { back } : {}) }
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

/** The staff-only Details button on a feedback post (docs/implementation/feedback/README.md). */
export function feedbackDetailsId(reportId: string) {
	if (!/^[a-f0-9]{64}$/.test(reportId)) throw new Error("Invalid report id")
	return `gw1:feedback-details:${reportId}`
}
export function parseFeedbackDetailsId(id: string): string | null {
	return /^gw1:feedback-details:([a-f0-9]{64})$/.exec(id)?.[1] ?? null
}
