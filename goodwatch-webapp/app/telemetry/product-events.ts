/** Product event vocabulary shared by browser, server and backfill. No SDK dependencies. */
export const PRODUCT_EVENTS = [
	"account created",
	"email verified",
	"sign in succeeded",
	"sign in failed",
	"taste quiz started",
	"taste quiz completed",
	"rating saved",
	"rating cleared",
	"review saved",
	"want to see added",
	"want to see removed",
	"title skipped",
	"title unskipped",
	"not interested added",
	"not interested removed",
	"favorite added",
	"favorite removed",
	"discovery results shown",
	"discovery filters changed",
	"title opened",
	"availability checked",
	"streaming service clicked",
	"tracking action applied",
	"watch state changed",
	"watch logged",
	"watch removed",
	"watch date changed",
	"import started",
	"import completed",
	"import failed",
	"import undone",
	"settings changed",
	"list saved",
	"list deleted",
	"guest progress transferred",
] as const
export type ProductEvent = (typeof PRODUCT_EVENTS)[number]
export type AnalyticsValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| number[]
export type EventProperties = Record<string, AnalyticsValue | undefined>

/** Only these fields may leave the app. Add a field here once to support every transport. */
const keys = new Set([
	"tmdb_id",
	"media_type",
	"score",
	"previous_score",
	"has_review",
	"action",
	"from_state",
	"to_state",
	"pass",
	"previous_pass",
	"watch_id",
	"watch_count",
	"removed_count",
	"season_number",
	"episode_number",
	"origin",
	"source",
	"surface",
	"result_position",
	"sort",
	"country",
	"service_ids",
	"provider_id",
	"offer_type",
	"on_my_services",
	"for_you",
	"moods",
	"result_count",
	"has_query",
	"query_length",
	"query_id",
	"recommendation_version",
	"batch_id",
	"import_id",
	"import_source",
	"added",
	"updated",
	"kept",
	"failed",
	"rating_count",
	"goal",
	"method",
	"reason",
	"setting_keys",
	"list_id",
	"item_count",
	"visibility",
	"backfilled",
	"backfill_version",
	"history_precision",
	"original_created_at",
	"environment",
	"release",
	"route_pattern",
	"request_id",
	"is_internal",
	"is_guest",
	"storage",
	"date_precision",
	"date_known",
	"tmdb_ids",
	"title_type",
	"unseen",
	"services_scope",
])
export function productProperties(
	properties: EventProperties,
): EventProperties {
	return Object.fromEntries(
		Object.entries(properties).filter(
			([key, value]) =>
				keys.has(key) &&
				value !== undefined &&
				(value === null ||
					typeof value === "boolean" ||
					(typeof value === "number" && Number.isFinite(value)) ||
					(typeof value === "string" && value.length <= 200) ||
					(Array.isArray(value) &&
						value.length <= 100 &&
						value.every(
							(v) =>
								(typeof v === "string" && v.length <= 80) ||
								(typeof v === "number" && Number.isFinite(v)),
						))),
		),
	)
}
/** Discovery parameters are allowlisted: free-text queries never leave the browser. */
export function discoveryProperties(params: URLSearchParams): EventProperties {
	const numbers = (key: string) =>
		(params.get(key) ?? "")
			.split(",")
			.map(Number)
			.filter((n) => Number.isSafeInteger(n) && n > 0)
			.slice(0, 100)
	return productProperties({
		sort: params.get("sort") ?? undefined,
		country: params.get("country") ?? undefined,
		service_ids: numbers(
			params.has("services") ? "services" : "withStreamingProviders",
		),
		moods: (params.get("moods") ?? "")
			.split(",")
			.filter((v) => /^[a-z_-]{1,40}$/.test(v)),
		services_scope:
			params.get("services") === "mine"
				? "mine"
				: params.get("services") === "all"
					? "all"
					: undefined,
		title_type: params.get("type") ?? undefined,
		unseen: params.get("unseen") === "1",
		on_my_services:
			params.get("services") === "mine" || params.get("onMyServices") === "1",
		for_you: params.get("foryou") !== "0",
		has_query: Boolean(params.get("q")),
		query_length: params.get("q")?.length ?? 0,
	})
}

// Existing internal accounts, preserved when identities move from email to immutable IDs.
export const INTERNAL_USER_IDS = new Set([
	"3a8e67d6-627b-47c3-a54f-9b873079e4a4",
	"ee0e64c3-cf6a-48f9-8609-22325a9b7252",
])
