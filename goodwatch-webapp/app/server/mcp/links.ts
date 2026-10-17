import type { ReadArgs, ReadToolName } from "./tools.server.ts"

export const linkInstructions =
	"Link every movie or show title to its returned url, including choices and write receipts. End list-like answers with 'See it on GoodWatch:' and a link to the returned page_url. Use page_note to explain when the page is a broader view; never invent URLs or promise identical results."

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
