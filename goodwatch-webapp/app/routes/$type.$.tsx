// Every Browse address below a kind (`/movies/moods/cozy`, `/all/moods/cozy/comedy?with=trope:final-girl`,
// `/movies/streaming/us/netflix`, ...). An old address answers 301 straight to its final new address
// (domain/browse/redirects.ts); an address the tree doesn't know answers 404, never a redirect to a hub.
// docs/implementation/explore-rethink/spec.md
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { kindOfSeg, parse } from "~/domain/browse/address"
import { notFound } from "~/domain/browse/not-found"
import { browseRedirect, finalAddress, legacyGenreFallback } from "~/domain/browse/redirects"
import { PlacesNotReady, openPlaces } from "~/server/browse/places.server"

const trimmed = (pathname: string) => pathname.replace(/\/+$/, "") || "/"

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
	const kind = kindOfSeg(params.type)
	if (!kind) throw notFound()
	const url = new URL(request.url)
	const pathname = trimmed(url.pathname)
	if (browseRedirect(pathname, url.search)) throw redirect(finalAddress(pathname, url.search), 301)

	const segs = pathname.split("/").filter(Boolean)
	const country = segs[1] === "streaming" && segs[2] ? segs[2] : "us"
	let places: Awaited<ReturnType<typeof openPlaces>>
	try {
		places = await openPlaces(request, kind, country)
	} catch (error) {
		if (error instanceof PlacesNotReady)
			throw new Response("Loading", {
				status: 503,
				headers: { "Retry-After": "5", "Cache-Control": "no-store" },
			})
		throw error
	}
	const address = parse(pathname, url.searchParams, places)
	if (!address) {
		// An old genre page that has no page any more moves to its kind's genre index.
		const fallback =
			segs[1] === "genres" && segs[2] && !segs[3] ? legacyGenreFallback(kind, segs[2]) : null
		if (fallback) throw redirect(fallback, 301)
		throw notFound()
	}
	// The pages arrive with the place, index, streaming, and trope pages (spec tickets T3 to T6).
	throw notFound()
}
