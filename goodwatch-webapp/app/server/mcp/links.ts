import { type LibraryStatus, sortsFor } from "../../domain/my-library.ts"
import { GUEST, type PathViewer, WATCH_PATHS, NOT_INTERESTED_PATH, statusHome, tasteHome, tasteTabFor } from "../../domain/member-paths.ts"
import {
	MCP_PROMPT_EXAMPLES,
	TONIGHT_ASK,
} from "../../ui/connector/example-prompts.ts"
import {
	discoverParams,
	hasDiscoverFilters,
	isDiscoverySearch,
} from "./discover-filters.ts"
import type { ReadArgs, ReadToolName } from "./tools.server.ts"

export const resultFacts =
	"Results include canonical GoodWatch URLs in url and ready-made Markdown links in link for titles and people. List-like results include page_url for the corresponding page and may include page_note describing differences from that page. GoodWatch match (50–99 percent) and match_label describe taste fit; null means insufficient liked titles or a missing title fingerprint. runtime_minutes is movie duration or usual episode duration for shows. Availability offers include provider stream_link values; link_kind=where_to_watch identifies a TMDB fallback rather than a direct playback link. Different IDs can identify distinct works with the same title and year." +
	"\n\nGoodWatch helps with what to watch, where it streams, and the member's own ratings, watches, Wishlist, shows, share lists and taste. Availability answers depend on the member's saved country and streaming services: get_settings reads them, set_my_services replaces them, and set_settings changes country or language while preserving services. Title write tools accept GoodWatch title IDs returned by search_titles or other read results, with title_name and optional year as a fallback. Batch-capable write tools accept items with up to 50 entries per call; undo_watch with batch_id takes back that batch's changes where undoable, preserving newer edits. get_tonight picks one thing to watch next; discover_titles browses with filters; get_similar_titles finds neighbors of a title." +
	`\n\nSimple examples: "${TONIGHT_ASK}" uses get_tonight. "${MCP_PROMPT_EXAMPLES.log_and_score}" uses search_titles, log_watch, then rate_title.` +
	`\nAdvanced examples: "${MCP_PROMPT_EXAMPLES.bulk_mark_seen}" uses search_titles, then batch items in log_watch (movies), set_show_status (shows) and rate_title; each result's batch_id can undo that batch. "${MCP_PROMPT_EXAMPLES.top_five_year}" uses get_library sorted by score, then create_list with five titles.`

/** Escape display text, not markup; never invent a missing catalog year. */
export function titleLink(
	name: string,
	year: number | null,
	url: string,
): string {
	const label = `${name} (${year ?? "Year unknown"})`.replace(
		/[\\[\]]/g,
		"\\$&",
	)
	return `[${label}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`
}

/** Existing page routes only. MCP has some filters the website does not expose. */
export function withPageLink(
	origin: string,
	name: ReadToolName,
	args: ReadArgs,
	data: Record<string, unknown>,
	viewer: PathViewer = GUEST,
): Record<string, unknown> {
	let path: string | undefined
	let note: string | undefined
	switch (name) {
		case "get_discover_filters":
		case "discover_titles":
		case "search_titles": {
			const query = (
				typeof data.query === "string" ? data.query : (args.query ?? "")
			).trim()
			const filters = {
				...args,
				...((data.filters as object) ?? {}),
				for_you: (data.for_you ?? args.for_you) as boolean | undefined,
				exclude_seen: (data.exclude_seen ?? args.exclude_seen) as
					| boolean
					| undefined,
			}
			const searching =
				name === "search_titles" && !isDiscoverySearch({ ...args, query })
			const filtered = !searching || hasDiscoverFilters(filters)
			const params = filtered
				? discoverParams(filters, searching)
				: new URLSearchParams()
			if (query) params.set("q", query)
			if (!params.has("services")) params.set("services", "all")
			params.set(
				"unseen",
				(data.exclude_seen ?? args.exclude_seen ?? false) ? "1" : "0",
			)
			if (!params.has("foryou"))
				params.set("foryou", (data.for_you ?? args.for_you ?? true) ? "1" : "0")
			if (!searching) {
				params.delete("q")
				params.set("layout", "grid")
			}
			path = `/discover?${params}`
			note = !searching
				? undefined
				: "Discover searches this query using the website's ranking and filters; its results can differ from this tool's catalog lookup."
			break
		}
		case "get_title": {
			const title = data.title as { url?: string } | undefined
			if (!title?.url) return data
			path = title.url
			break
		}
		case "get_similar_titles": {
			const source = data.source as { url?: string } | undefined
			if (!source?.url) return data
			path = `${source.url}#related`
			note =
				"The title page shows GoodWatch’s related neighborhood. This tool applies its own For you, type and seen filters to the first 80 neighbors; the page can show a broader set in a different order."
			break
		}
		case "get_library": {
			const filter = args.filter ?? "all"
			const statusOf: Record<string, LibraryStatus> = {
				want_to_see: "want",
				seen: "seen",
				watching: "watching",
				on_hold: "on_hold",
				dropped: "dropped",
				unrated: "unrated",
			}
			if (filter === "not_interested") path = NOT_INTERESTED_PATH
			else if (filter === "rated") path = tasteTabFor(viewer, "scores")
			else if (statusOf[filter]) path = statusHome(statusOf[filter], args.kind ?? "all", viewer)
			else {
				path = tasteHome(viewer)
				note =
					"Watch holds your Wishlist, seen titles and shows in progress. Taste holds your scores and Not rated. This link opens your Taste profile."
			}
			const sort = data.sort ?? args.sort
			const status = filter === "want_to_see" ? "want" : filter
			if (
				sort &&
				["want", "seen", "watching", "on_hold", "dropped", "unrated"].includes(
					status,
				)
			) {
				const url = new URL(path, origin)
				const sorts = sortsFor(status as LibraryStatus)
				if (sorts.some((candidate) => candidate === sort)) {
					if (sort !== sorts[0]) url.searchParams.set("sort", String(sort))
				} else
					note =
						"This sort is available in the tool; the linked page opens this status in its default website order."
				path = url.pathname + url.search
			}
			if (filter === "seen" && args.kind && args.kind !== "all") {
				const url = new URL(path, origin)
				url.searchParams.set("type", args.kind)
				path = url.pathname + url.search
			}
			break
		}
		case "get_my_shows":
			path = WATCH_PATHS.nextEpisodes
			break
		case "get_taste":
			path = tasteHome(viewer)
			break
		case "get_tonight": {
			const pick = data.pick as { title?: { id?: string } } | null | undefined
			path = pick?.title?.id?.startsWith("show:") ? WATCH_PATHS.nextEpisodes : WATCH_PATHS.tonight
			note =
				"Watch next is a single pick, which can be an episode of a show already being watched. This page opens the matching movies or shows list."
			break
		}
		default:
			return data
	}
	return {
		...data,
		page_url: new URL(path, origin).href,
		...(note ? { page_note: note } : {}),
	}
}
