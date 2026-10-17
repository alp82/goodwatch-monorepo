import type { ReadArgs, ReadToolName } from "./tools.server.ts"

export const linkInstructions =
	"Always write every movie or show title using its ready-made link field VERBATIM as a Markdown link, including the full Title (Year) label. Never replace it with bold or plain text, including choices and write receipts. End every list-like answer with 'See it on GoodWatch:' followed by a Markdown link to page_url. Use page_note for broader views; never invent URLs, years or promise identical results."

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
			path = query
				? `/discover?${new URLSearchParams({ q: query })}`
				: "/discover"
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
			break
		}
		case "get_my_shows":
			path = "/my-shows"
			break
		case "get_taste":
			path = "/taste"
			break
		case "get_tonight":
			path = "/?tv=tonight"
			break
		default:
			return data
	}
	return {
		...data,
		page_url: new URL(path, origin).href,
		...(note ? { page_note: note } : {}),
	}
}
