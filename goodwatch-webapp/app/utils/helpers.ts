export function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ")
}

export function titleToDashed(title: string) {
	return title
		.toLowerCase()
		.replace(/[^\w- ]+/g, "")
		.replace(/ +/g, "-")
}

// Canonical movie or show page path: the page's canonical tag and the sitemap name the same one.
export function titlePath(mediaType: string, tmdbId: number, title: string) {
	return `/${mediaType}/${tmdbId}-${titleToDashed(title)}`
}

// Where a title page asked for under another path moves to, with its query, or null when the request is at the
// canonical path already. `pathname` is the request's path as sent, still percent-encoded, so an encoded spelling of
// the right slug moves too. A canonical path that a URL parser would rewrite could never be asked for as it is
// written, so it gets no redirect instead of a loop. A link from the old search journey (`searchJourney=1`, with the
// search's query and filters) moves too, keeping only the title page's own parameters.
export function titleRedirectPath({
	pathname,
	search,
	mediaType,
	tmdbId,
	title,
}: {
	pathname: string
	search: string
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
}): string | null {
	if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0 || typeof title !== "string")
		return null
	const canonical = titlePath(mediaType, tmdbId, title)
	const query = withoutSearchJourney(search)
	if (pathname === canonical && query === search) return null
	if (new URL(canonical, "http://localhost").pathname !== canonical) return null
	return canonical + query
}

/** The query without what the old search journey added: of its links' parameters, the title page reads these. */
const TITLE_PAGE_PARAMS = ["country", "language"]

function withoutSearchJourney(search: string): string {
	const params = new URLSearchParams(search)
	if (!params.has("searchJourney")) return search
	const kept = new URLSearchParams()
	for (const key of TITLE_PAGE_PARAMS) {
		const value = params.get(key)
		if (value) kept.set(key, value)
	}
	const query = kept.toString()
	return query ? `?${query}` : ""
}

// Canonical cast and crew page path. Names without Latin letters get no slug.
export function personPath(id: number, name: string) {
	const slug = titleToDashed(name).replace(/^-+|-+$/g, "")
	return slug ? `/person/${id}-${slug}` : `/person/${id}`
}

/** A count with its noun in the right number: "1 title", "5 titles", "2 TV shows". */
export function pluralize(
	count: number,
	singular: string,
	plural = `${singular}s`,
) {
	return `${count} ${count === 1 ? singular : plural}`
}
