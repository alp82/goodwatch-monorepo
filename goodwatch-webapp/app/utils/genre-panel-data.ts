/** Old Browse clients expect every panel in the loader data. The current client opts into
 * the smaller wire format on its Remix data URL; this never changes the page address. */
const panelParam = "_genrePanel"
const genreIndex = /^\/(?:movies|shows|all)\/genres\/?$/

export const isGenreIndexDataUrl = (url: URL) =>
	genreIndex.test(url.pathname) && url.searchParams.get("_data") === "routes/$type.$"

export function genrePanelDataUrl(url: URL) {
	const target = new URL(url)
	target.searchParams.set(panelParam, "1")
	return target
}

/** Remix strips _data before route loaders run; its response hook receives the original URL. */
export function legacyGenreDocument(request: Request, response: Response) {
	if (request.method !== "GET" || response.status !== 200 || !request.url.includes("/genres"))
		return null
	const url = new URL(request.url)
	if (!isGenreIndexDataUrl(url) || url.searchParams.get(panelParam) === "1") return null
	url.searchParams.delete("_data")
	url.searchParams.delete(panelParam)
	return url.pathname + url.search
}
