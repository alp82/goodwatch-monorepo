import type { McpServer } from "@modelcontextprotocol/server"
import { TMDB_IMAGE_ORIGIN } from "./poster-grid/cards.ts"
import { POSTER_GRID_TEMPLATE } from "./poster-grid/html.generated.ts"
import type { ReadToolName } from "./tools.server.ts"

// The optional MCP Apps poster grid (https://modelcontextprotocol.io/extensions/apps/overview). A host with MCP Apps
// support reads this resource and shows the tool result as posters next to the answer. Every other client ignores the
// metadata and gets the same text and structuredContent. Change the URI's version when the widget's data contract
// changes: hosts may cache the resource by URI.
export const POSTER_GRID_URI = "ui://goodwatch/posters-v3.html"
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app"
export const POSTER_GRID_TOOLS: ReadonlySet<ReadToolName> = new Set([
	"search_titles",
	"get_similar_titles",
	"discover_titles",
	"search_people",
	"get_person",
	"get_list",
	"get_library",
	"get_tonight",
])

/** Tool `_meta`: the standard key, the ext-apps helpers' legacy key, and ChatGPT's alias. */
export const posterGridToolMeta = {
	ui: { resourceUri: POSTER_GRID_URI },
	"ui/resourceUri": POSTER_GRID_URI,
	"openai/outputTemplate": POSTER_GRID_URI,
}

/** Posters from TMDB; the font and the title pages from the site. No fetch, XHR or WebSocket destinations. */
export function posterGridCsp(origin: string) {
	return {
		resourceDomains: [TMDB_IMAGE_ORIGIN, origin],
		connectDomains: [] as string[],
	}
}

export function posterGridHtml(origin: string): string {
	const site = new URL(origin).origin
	return POSTER_GRID_TEMPLATE.split("__GW_ORIGIN__").join(site)
}

export function registerPosterGrid(server: McpServer, origin: string) {
	const site = new URL(origin).origin
	const csp = posterGridCsp(site)
	const ui = { csp, prefersBorder: false }
	server.registerResource(
		"goodwatch-posters",
		POSTER_GRID_URI,
		{
			title: "GoodWatch posters",
			description:
				"Poster cards for discovery, search results, people, More like this, filmographies, share lists, My library and Watch next. Shown by clients that support MCP Apps.",
			mimeType: MCP_APP_MIME_TYPE,
			_meta: { ui },
		},
		async () => ({
			contents: [
				{
					uri: POSTER_GRID_URI,
					mimeType: MCP_APP_MIME_TYPE,
					text: posterGridHtml(site),
					_meta: {
						ui,
						"openai/widgetCSP": {
							connect_domains: [],
							resource_domains: csp.resourceDomains,
						},
						"openai/widgetPrefersBorder": false,
						"openai/widgetDescription":
							"GoodWatch posters for the titles in this answer, with taste match and links to their GoodWatch pages.",
					},
				},
			],
		}),
	)
}
