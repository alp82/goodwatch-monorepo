import { type LibraryStatus, sortsFor } from "../../domain/my-library.ts"
import type { ReadArgs, ReadToolName } from "./tools.server.ts"

export const linkInstructions =
	"Use each title’s GoodWatch match (50–99 percent) and match_label for taste fit; never replace them with your own judgment, an invented score, or an estimated ranking. Null means no GoodWatch taste match is available (insufficient liked titles or missing title fingerprint); say so. For the best-fitting library titles use sort=match; for longest movies use kind=movie and sort=runtime, which sorts the whole filtered library before paging. runtime_minutes is movie duration or usual episode duration for shows. When availability includes offers, use their url and name; link_kind=where_to_watch is the site’s TMDB fallback, not a direct playback link. Always write every movie or show title using its ready-made link field VERBATIM as a Markdown link, including the full Title (Year) label. Never replace it with bold or plain text, including choices and write receipts. Different IDs can be distinct works with the same title and year: mention their runtime_minutes when needed to distinguish them. End every list-like answer with 'See it on GoodWatch:' followed by a Markdown link to page_url. Use page_note for broader views; never invent URLs, years or promise identical results."

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
): Record<string, unknown> {
	let path: string | undefined
	let note: string | undefined
	switch (name) {
		case "search_titles": {
			const query = (
				typeof data.query === "string" ? data.query : (args.query ?? "")
			).trim()
			const params = new URLSearchParams()
			if (query) params.set("q", query)
			params.set("services", "all")
			params.set(
				"unseen",
				(data.exclude_seen ?? args.exclude_seen ?? false) ? "1" : "0",
			)
			params.set("foryou", (data.for_you ?? args.for_you ?? true) ? "1" : "0")
			path = `/discover?${params}`
			note =
				"Discover searches this query using the website's ranking and filters; its results can differ from this tool's catalog lookup."
			break
		}
		case "get_library": {
			const filter = args.filter ?? "all"
			if (filter === "not_interested") path = "/settings/hidden"
			else if (filter === "want_to_see") path = "/my-library"
			else if (
				["seen", "watching", "on_hold", "dropped", "unrated"].includes(filter)
			)
				path = `/my-library?status=${filter}`
			else {
				path = filter === "rated" ? "/my-library?status=seen" : "/my-library"
				note =
					filter === "rated"
						? "My library's Seen view also includes unrated titles and follows the website's show-status rules; there is no rated-only page."
						: "My library opens Want to see; switch status there to browse the rest of your marked titles."
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
						"This sort is available in the tool; My library opens this status in its default website order."
				if (args.kind && args.kind !== "all")
					url.searchParams.set("type", args.kind)
				path = url.pathname + url.search
			}
			break
		}
		case "get_my_shows":
			path = "/my-shows"
			break
		case "get_taste":
			path = "/taste"
			break
		case "get_tonight": {
			const pick = data.pick as { title?: { id?: string } } | null | undefined
			path = pick?.title?.id?.startsWith("show:") ? "/my-shows" : "/my-movies"
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
