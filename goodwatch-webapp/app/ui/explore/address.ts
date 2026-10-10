// Which answer an address of the category pages gets: `/<type>`, `/<type>/<category>`, and `/<type>/<category>/<page>`.
// Those routes match every path of one to three segments that no other route names, so they also decide what an
// unknown path answers. An unknown path answers 404: a redirect to the start page or a hub reads as a soft 404 to a
// crawler, and whatever the address had earned is dropped.
import { validUrlParams } from "~/ui/explore/config"
import { mainHierarchy } from "~/ui/explore/main-nav"

export interface ExploreAddress {
	type?: string
	category?: string
	page?: string
}

// A name from a URL is only a key when the object itself has it: `constructor` is on every object.
const has = (object: object, key: string) =>
	Object.prototype.hasOwnProperty.call(object, key)

const pagesOf = (category: string): Record<string, unknown> | undefined =>
	has(mainHierarchy, category)
		? mainHierarchy[category as keyof typeof mainHierarchy]
		: undefined

/** Whether the address names a page. A segment the address doesn't have is left out or empty. */
export const exploreAddressExists = ({
	type = "",
	category = "",
	page = "",
}: ExploreAddress) => {
	if (!validUrlParams.type.includes(type)) return false
	if (!category) return !page
	const pages = pagesOf(category)
	if (!pages) return false
	return !page || has(pages, page)
}

/** The loaders' answer for an address that names no page. */
export const notFound = () => new Response("Not Found", { status: 404 })

// The names the type segment had before `/shows`.
const formerShowTypes = ["tv-shows", "tv"]

/**
 * The address that replaced `/explore/<type>/<category>/<text>`, or null when no page replaced it. Only a page that
 * exists is a target: the old pages listed titles by a free tag, and most tags have no page now.
 */
export const formerExplorePath = (
	type: string,
	category: string,
	text: string,
) => {
	const address = {
		type: formerShowTypes.includes(type) ? "shows" : type,
		category,
		page: text,
	}
	return exploreAddressExists(address)
		? `/${address.type}/${category}/${text}`
		: null
}

/**
 * The `/shows` address of a `/tv-shows` one, with its query. The first segment is dropped whatever its spelling: the
 * route also matches `/TV-SHOWS` and `/%74v-shows`.
 */
export const formerTvShowsPath = (pathname: string, search: string) =>
	`/shows${pathname.replace(/^\/[^/]*/, "").replace(/\/+$/, "")}${search}`
