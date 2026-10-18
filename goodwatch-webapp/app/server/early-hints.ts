// What a page's 103 Early Hints response says (early-hints.server.ts sends it). While the server renders, the browser
// already opens the connections to the static hostname and fetches the render-blocking style sheets.
//
// The hints follow the page's own links, so the browser can use what they fetch: while the style sheets come from the
// static hostname, root.tsx and _index.tsx link them with `crossorigin`, and Chrome preloads a file of another host
// from a 103 response in that mode only. The page's images go with credentials, and a browser keeps the two kinds on
// separate connections, so there is a preconnect for each.

export type EarlyHintsRequest = {
	method?: string
	/** The request target: a path with its query. */
	url?: string
	headers: Record<string, string | string[] | undefined>
}

export type EarlyHintsSheets = {
	/** The site's style sheet on every page, as a path from the root (`/assets/tailwind-AbCd1234.css`). */
	site: string
	/** The start page's own style sheets, in the order the page links them. */
	home: string[]
}

const header = (value: string | string[] | undefined) =>
	(Array.isArray(value) ? value[0] : value) ?? ""

/** Whether the request is a page that a browser navigates to: not a file, not data, not an API call. */
export function isPageNavigation(request: EarlyHintsRequest): boolean {
	if (request.method !== "GET") return false
	const [path = "/", query = ""] = (request.url ?? "/").split("?", 2)
	if (/(^|&)_data=/.test(query)) return false
	if (/^\/(api|assets|health|og|sitemaps?|mcp)(\/|$)/.test(path)) return false
	// A file: its last segment has an extension.
	if (/\.[a-z0-9]+$/i.test(path)) return false
	const dest = header(request.headers["sec-fetch-dest"])
	if (dest) return dest === "document"
	return header(request.headers.accept).includes("text/html")
}

/**
 * The `Link` values of the request's 103 response, or none. `base` is the static hostname's origin of this response,
 * or empty while the page names the site's own host.
 */
export function earlyHintLinks(
	request: EarlyHintsRequest,
	base: string,
	sheets: EarlyHintsSheets,
): string[] {
	if (!isPageNavigation(request)) return []
	const path = (request.url ?? "/").split("?", 1)[0]
	const links: string[] = []
	if (base) {
		links.push(`<${base}>; rel=preconnect; crossorigin`)
		links.push(`<${base}>; rel=preconnect`)
	}
	links.push(
		`<${base}${sheets.site}>; rel=preload; as=style${base ? "; crossorigin" : ""}`,
	)
	if (path === "/")
		for (const sheet of sheets.home)
			links.push(
				`<${base}${sheet}>; rel=preload; as=style${base ? "; crossorigin" : ""}`,
			)
	return links
}
