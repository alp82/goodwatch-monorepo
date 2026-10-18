// A title page's hero picture in its 103 Early Hints response (early-hints.server.ts). The server doesn't know the
// picture before it renders the page, and the hint path makes no database query: each instance remembers the files of a
// page it has rendered (the loader names them), for that page's next visit. The first visit after a start gets no
// hero hint. The map keeps the most recent pages and forgets the oldest.
//
// The file depends on the window, which the server doesn't know: a Chromium browser says on every request whether it
// is a phone (`Sec-CH-UA-Mobile`). A phone gets the phone's file, any other the desktop's; a browser that doesn't send
// the header gets no hero hint. A window that picks another file from the srcset (a phone held sideways, a narrow
// desktop window) fetches that one as well: the hinted file costs it one extra download. The picture asks with `crossorigin` (TMDB answers with the CORS header), as Chrome
// preloads a file of another host from a 103 response in that mode only.

export type HeroFiles = {
	/** The file a phone's window picks from the picture's srcset. */
	phone: string
	/** The file a desktop's window picks. */
	desktop: string
}

export type HeroRequest = {
	/** The request target: a path with its query. */
	url?: string
	headers: Record<string, string | string[] | undefined>
}

/** How many pages an instance remembers. A path and two file names are about 200 bytes. */
export const HERO_PAGES = 5000

export function createHeroHints(max = HERO_PAGES) {
	const heroes = new Map<string, HeroFiles>()
	const pathOf = (url: string | undefined) => (url ?? "/").split("?", 1)[0]
	return {
		/** After a render: the page's hero files. The page moves to the end, and the oldest beyond `max` goes. */
		remember(pathname: string, files: HeroFiles): void {
			heroes.delete(pathname)
			heroes.set(pathname, files)
			if (heroes.size > max) {
				const oldest = heroes.keys().next().value
				if (oldest !== undefined) heroes.delete(oldest)
			}
		},
		/** The `Link` value of the page's hero for this request, or none. */
		link(request: HeroRequest): string | undefined {
			const mobile = request.headers["sec-ch-ua-mobile"]
			if (mobile === undefined) return undefined
			const files = heroes.get(pathOf(request.url))
			if (!files) return undefined
			const phone = (Array.isArray(mobile) ? mobile[0] : mobile) === "?1"
			return `<${phone ? files.phone : files.desktop}>; rel=preload; as=image; crossorigin`
		},
		get size() {
			return heroes.size
		},
	}
}
