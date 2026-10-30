// What a page's 103 Early Hints response says (early-hints.server.ts sends it). While the server renders, the browser
// already opens the connections to the static hostname and fetches what the first paint needs: the render-blocking
// style sheets, the brand font, and on the start page the room's picture and the small marks on its first screen.
//
// The hints follow the page's own elements, so the browser can use what they fetch: while the files come from the
// static hostname, the style sheets (root.tsx, _index.tsx) and the room's pictures (ui/start/room/StartRoom.tsx) ask
// with `crossorigin`, and Chrome preloads a file of another host from a 103 response in that mode only; so does the white
// G mark (ui/brand/white-mark.ts), and a CSS mask is fetched in that mode anyway. The page's other images go with credentials,
// and a browser keeps the two kinds on separate connections, so there is a preconnect for each.

export type EarlyHintsRequest = {
	method?: string
	/** The request target: a path with its query. */
	url?: string
	headers: Record<string, string | string[] | undefined>
}

/** The files a hint can name, as paths from the root (`/assets/tailwind-AbCd1234.css`). */
export type EarlyHintsFiles = {
	/** The site's style sheet on every page. */
	site: string
	/** Explorer has a second render-blocking stylesheet. It always requests it in CORS mode. */
	explorer?: string
	/** The start page's own style sheets, in the order the page links them. */
	home: string[]
	/**
	 * The brand font's Latin file, which the root preloads: the site header's title on every page, and most of the
	 * start page's first screen, are set in it.
	 */
	font: string
	/**
	 * The start page's room pictures in AVIF: the first screen's largest content (its LCP). A phone upright draws the
	 * portrait room, a desktop the landscape room.
	 */
	room: { phone: string[]; desktop: string[] }
	/**
	 * The start page's small marks on its first screen, in every layout, hinted so that they don't wait for a
	 * connection of their own while the room paints. `images` are `img` elements, which ask like the room's pictures
	 * (the G on the phone's dock, ui/brand/white-mark.ts). `masks` are CSS masks, which a browser fetches in CORS mode
	 * on any host, the site's own too.
	 */
	marks: { images: string[]; masks: string[] }
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
 * The room pictures to hint for this request, or none. The server doesn't know the window, so it reads what a Chromium
 * browser says on every request: `Sec-CH-UA-Mobile` (`?1` on a phone) and whether `Accept` takes AVIF. Other browsers
 * don't send the first, and get no picture hints. A phone held sideways draws the landscape room, not the portrait one:
 * its hinted pictures go unused, and the page fetches its own.
 */
function roomPictures(
	request: EarlyHintsRequest,
	room: EarlyHintsFiles["room"],
): string[] {
	const mobile = request.headers["sec-ch-ua-mobile"]
	if (mobile === undefined) return []
	if (!header(request.headers.accept).includes("image/avif")) return []
	return header(mobile) === "?1" ? room.phone : room.desktop
}

/**
 * The `Link` values of the request's 103 response, or none. `base` is the static hostname's origin of this response,
 * or empty while the page names the site's own host.
 */
export function earlyHintLinks(
	request: EarlyHintsRequest,
	base: string,
	files: EarlyHintsFiles,
): string[] {
	if (!isPageNavigation(request)) return []
	const path = (request.url ?? "/").split("?", 1)[0]
	const cors = base ? "; crossorigin" : ""
	const links: string[] = []
	if (base) {
		links.push(`<${base}>; rel=preconnect; crossorigin`)
		links.push(`<${base}>; rel=preconnect`)
	}
	links.push(`<${base}${files.site}>; rel=preload; as=style${cors}`)
	// A font is always fetched without credentials, so its preload has `crossorigin` on any host, as the root's has.
	links.push(
		`<${base}${files.font}>; rel=preload; as=font; type="font/woff2"; crossorigin`,
	)
	if (path === "/map" && files.explorer)
		links.push(`<${base}${files.explorer}>; rel=preload; as=style; crossorigin`)
	if (path !== "/") return links
	for (const sheet of files.home)
		links.push(`<${base}${sheet}>; rel=preload; as=style${cors}`)
	// High priority, like the pictures' own elements: a preload asks with low priority otherwise, and the element
	// takes over the request with the priority it already has (Lighthouse: LCP request discovery).
	for (const picture of roomPictures(request, files.room))
		links.push(
			`<${base}${picture}>; rel=preload; as=image${cors}; fetchpriority=high`,
		)
	for (const mark of files.marks.images)
		links.push(`<${base}${mark}>; rel=preload; as=image${cors}`)
	for (const mask of files.marks.masks)
		links.push(`<${base}${mask}>; rel=preload; as=image; crossorigin`)
	return links
}
