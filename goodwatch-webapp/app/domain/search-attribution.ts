/**
 * Bounded diagnostics, never part of a reading/cache identity. The labels never grant anything; the one rule read from
 * them only takes away: a guest's web search that arrived in the URL buys no reading (paidReadingAllowed).
 */
export const SEARCH_SURFACES = [
	"start",
	"header",
	"discover",
	"title_tag",
	"title_trope",
	"quick_list",
	"tv",
	"yepwatch",
	"mcp",
	"discord",
	"unknown",
] as const
export const SEARCH_TRIGGERS = [
	"typing_pause",
	"enter",
	"search_button",
	"selection",
	"link",
	"navigation",
	"retry",
	"filter_change",
	"api",
	"unknown",
] as const
export type SearchSurface = (typeof SEARCH_SURFACES)[number]
export type SearchTrigger = (typeof SEARCH_TRIGGERS)[number]
export type SearchOrigin = { surface: SearchSurface; trigger: SearchTrigger }
export type SearchActor = "member" | "guest" | "external" | "unknown"
export type SearchAttribution = SearchOrigin & {
	version: 1
	consumer: "web" | "yepwatch" | "mcp" | "discord" | "unknown"
	actor_kind: SearchActor
	search_id: string
	reported_by: "client" | "server" | "unknown"
}

const webSurfaces = new Set<string>([
	"start",
	"header",
	"discover",
	"title_tag",
	"title_trope",
	"quick_list",
	"tv",
])
const webTriggers = new Set<string>(SEARCH_TRIGGERS.filter((t) => t !== "api"))

/** Old clients and forged integration/actor labels stay explicitly unknown. */
export function browserSearchOrigin(value: unknown): SearchOrigin {
	const v =
		value && typeof value === "object" ? (value as Record<string, unknown>) : {}
	return {
		surface:
			typeof v.surface === "string" && webSurfaces.has(v.surface)
				? (v.surface as SearchSurface)
				: "unknown",
		trigger:
			typeof v.trigger === "string" && webTriggers.has(v.trigger)
				? (v.trigger as SearchTrigger)
				: "unknown",
	}
}

export type SearchContext = SearchOrigin & {
	consumer: SearchAttribution["consumer"]
	reported_by: SearchAttribution["reported_by"]
	/** Set only by an authenticated integration, never read from a browser body. */
	actor?: SearchActor
	search_id?: string
}

export function attributedSearch(
	context: SearchContext | undefined,
	accountId: string | null,
): SearchAttribution {
	return {
		version: 1,
		consumer: context?.consumer ?? "unknown",
		surface: context?.surface ?? "unknown",
		trigger: context?.trigger ?? "unknown",
		actor_kind: context?.actor ?? (accountId ? "member" : "guest"),
		search_id: context?.search_id ?? "unknown",
		reported_by: context?.reported_by ?? "unknown",
	}
}

/**
 * A paid reading needs a person's action. A guest's web search that only arrived in the URL (a page load with ?q= or
 * back/forward) is answered with a cached reading or the basic search: link crawlers run the page's script and would
 * otherwise buy a reading per link. The label comes from the browser, so it can only take away: a client that claims
 * an action is believed (a challenge for those is a separate follow-up). Members and integrations are unchanged.
 */
export function paidReadingAllowed(attribution: SearchAttribution): boolean {
	return !(
		attribution.consumer === "web" &&
		attribution.actor_kind === "guest" &&
		attribution.trigger === "navigation"
	)
}
