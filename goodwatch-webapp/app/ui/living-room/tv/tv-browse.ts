// Small URL contract shared with the eager TV machine. Interaction UI/data stay in screen chunks.
export const BROWSE_OPTIONS = {
	type: ["all", "movie", "show"],
	services: ["mine", "all"],
	unseen: ["1", "0"],
	sort: ["popular", "top", "newest", "relevance", "match"],
	foryou: ["1", "0"],
	moods: ["", "funny", "feelgood", "romance", "action", "scary", "mind"],
	themes: ["", "crime", "mystery", "family", "growing", "future", "fantasy"],
	styles: ["", "animated", "spectacle", "slow", "fast", "talky", "nonlinear"],
} as const
export type BrowseKey = keyof typeof BROWSE_OPTIONS
export type BrowseState = {
	browse?: string
	page?: number
	filters?: boolean
	all?: boolean
}
export const BROWSE_KEYS = Object.keys(BROWSE_OPTIONS) as BrowseKey[]
/** Best match is always taste ordering, regardless of the saved blending preference. */
export const bestMatchActive = (
	params: URLSearchParams,
	defaults: Record<string, string> | undefined,
	hasTaste: boolean,
) => hasTaste && (params.get("sort") ?? defaults?.sort) === "match"
export const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"]
export const KEY_ITEMS = [
	...KEY_ROWS.flatMap((row) => [...row].map((c) => `key:${c}`)),
	"key:delete",
	"key:space",
	"key:clear",
	"go",
]
export const validPage = (value: unknown) =>
	typeof value === "number"
		? Number.isSafeInteger(value) && value > 0
			? Math.min(250, value)
			: 1
		: typeof value === "string" && /^[1-9]\d*$/.test(value)
			? Math.min(250, Number(value))
			: 1
export function cleanBrowse(params: URLSearchParams): string {
	const out = new URLSearchParams()
	for (const key of BROWSE_KEYS) {
		const value = params.get(key)
		if (
			value !== null &&
			(BROWSE_OPTIONS[key] as readonly string[]).includes(value)
		)
			out.set(key, value)
	}
	return out.toString()
}
export function readBrowse(params: URLSearchParams): BrowseState {
	const browse = cleanBrowse(params),
		page = validPage(params.get("page"))
	return {
		...(browse && { browse }),
		...(page > 1 && { page }),
		...(params.get("filters") === "1" && { filters: true }),
		...(params.get("all") === "1" && { all: true }),
	}
}
export function writeBrowse(state: BrowseState, out: URLSearchParams) {
	new URLSearchParams(state.browse).forEach((value, key) => out.set(key, value))
	if (state.page && state.page > 1)
		out.set("page", String(validPage(state.page)))
	if (state.filters) out.set("filters", "1")
	if (state.all) out.set("all", "1")
}
export function browseQuery(
	screen: BrowseState & {
		name: string
		tab?: string
		choice?: string | null
		query?: string | null
	},
): string {
	const p = new URLSearchParams()
	if (screen.choice && screen.tab) p.set(screen.tab, screen.choice)
	new URLSearchParams(screen.browse).forEach((v, k) => p.set(k, v))
	if (screen.query) p.set("q", screen.query)
	return p.toString()
}
export const browseIdentity = (
	screen: BrowseState & {
		name: string
		tab?: string
		choice?: string | null
		query?: string | null
	},
) => `${screen.name}:${browseQuery(screen)}:${screen.page ?? 1}`
export function browseHref(screen: Parameters<typeof browseQuery>[0]) {
	const p = new URLSearchParams(browseQuery(screen))
	if ((screen.page ?? 1) > 1) p.set("page", String(screen.page))
	return `/discover${p.size ? `?${p.toString().replace(/\+/g, "%20")}` : ""}`
}
export const filterItems = [
	"browse:done",
	...BROWSE_KEYS.map((key) => `filter:${key}`),
	"browse:reset",
]
export function pageInfo(data?: {
	total: number
	page: number
	pageSize: number
}) {
	if (!data) return { total: 0, pages: 1, next: false }
	const pages = Math.max(
		1,
		Math.min(250, Math.ceil(data.total / data.pageSize)),
	)
	return { total: data.total, pages, next: data.page < pages }
}
