// Every Browse address below a kind (`/movies/moods/cozy`, `/all/moods/cozy/comedy?with=trope:final-girl`,
// `/movies/streaming/us/netflix`, ...). An old address answers 301 straight to its final new address
// (domain/browse/redirects.ts); an address the tree doesn't know answers 404, never a redirect to a hub.
// docs/implementation/explore-rethink/spec.md
import { type LoaderFunctionArgs, type MetaFunction, redirect } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { CSSProperties } from "react"
import {
	type Address,
	browsePath,
	canonicalPath,
	kindOfSeg,
	parse,
	splitParts,
} from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy-lookup"
import { notFound } from "~/domain/browse/not-found"
import { browseRedirect, finalAddress, legacyGenreFallback } from "~/domain/browse/redirects"
import { loadAddEntry } from "~/server/browse/add-entry.server"
import { peekOf } from "~/server/browse/blend.server"
import { loadMarks } from "~/server/browse/card-marks.server"
import { loadPlacePage } from "~/server/browse/place-page.server"
import { MIN_PAGE, PlacesNotReady, openPlaces } from "~/server/browse/places.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { BrowseRow } from "~/ui/browse/BrowseRow"
import { BrowsePageProvider } from "~/ui/browse/page-context"
import { PlacePage } from "~/ui/browse/place/PlacePage"
import { tropesRoute } from "~/server/browse/tropes-route.server"
import { TropesRoute } from "~/ui/browse/tropes/TropesRoute"
import { crumbsOf } from "~/ui/browse/place/PlaceHead"
import { buildMeta } from "~/utils/meta"

const trimmed = (pathname: string) => pathname.replace(/\/+$/, "") || "/"

/** The page a single place opens: moods, genres, themes and styles have the place page; every blend has it too. */
const isPlacePage = (a: Address) =>
	a.view === "place" &&
	(a.parts.length > 1 || ["mood", "genre", "theme", "style"].includes(a.parts[0]?.family ?? ""))

/**
 * Whether a place page may be indexed: single places and two-part path blends with a full page, for movies or shows.
 * `/all`, `?with=` blends, three or more parts, themes and styles, and thin places stay out (noindex, follow).
 */
function indexable(a: Address, count: number) {
	if (a.kind === "all" || count < MIN_PAGE) return false
	if (a.parts.some((p) => p.family === "theme" || p.family === "style")) return false
	return splitParts(a.parts).rest.length === 0
}

const site = (path: string) => `https://goodwatch.app${path}`

const canonicalLoader = async ({ params, request }: LoaderFunctionArgs) => {
	const kind = kindOfSeg(params.type)
	if (!kind) throw notFound()
	const url = new URL(request.url)
	const pathname = trimmed(url.pathname)
	if (browseRedirect(pathname, url.search)) throw redirect(finalAddress(pathname, url.search), 301)

	const segs = pathname.split("/").filter(Boolean)
	const country = segs[1] === "streaming" && segs[2] ? segs[2] : "us"
	let atlas: Awaited<ReturnType<typeof openPlaces>>
	try {
		atlas = await openPlaces(request, kind, country)
	} catch (error) {
		if (error instanceof PlacesNotReady)
			throw new Response("Loading", {
				status: 503,
				headers: { "Retry-After": "5", "Cache-Control": "no-store" },
			})
		throw error
	}
	const address = parse(pathname, url.searchParams, atlas)
	if (!address) {
		// An old genre page that has no page any more moves to its kind's genre index.
		const fallback =
			segs[1] === "genres" && segs[2] && !segs[3] ? legacyGenreFallback(kind, segs[2]) : null
		if (fallback) throw redirect(fallback, 301)
		throw notFound()
	}

	// The pantry's preview: a few posters of the blend with one more ingredient (the Add button asks with `?peek=1`).
	if (url.searchParams.get("peek") === "1" && address.view === "place")
		return { page: "peek" as const, data: await peekOf(atlas, address.parts) }

	// The tropes index and a single trope's page (a trope blended with anything else is a place page).
	const tropes = await tropesRoute(atlas, address)
	if (tropes) return tropes

	if (isPlacePage(address)) {
		const args = { request, url, address, atlas }
		const data = await loadPlacePage(args)
		const count = atlas.count(address.parts)
		const lead = address.parts[0]
		return {
			page: "place" as const,
			address,
			data,
			viewer: atlas.viewer,
			marks: await loadMarks(atlas),
			entry: loadAddEntry(atlas, address),
			title: data.room.title,
			description:
				(address.parts.length === 1 ? copyFor(kind, lead.family, lead.slug)?.lede : null) ??
				data.dz.lede ??
				"",
			canonical: canonicalPath(address),
			indexable: indexable(address, count),
		}
	}
	// The index, era, country, streaming, trope, and Top pages arrive with spec tickets T4 to T7.
	throw notFound()
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (data && (data.page === "tropes" || data.page === "trope")) return buildMeta(data.meta)
	if (!data || data.page !== "place") return [{ title: "Page Not Found | GoodWatch" }]
	const crumbs = crumbsOf(data.data, data.address, (a) => browsePath(a)).map((c) => ({
		label: c.label,
		path: "to" in c && c.to ? c.to : data.canonical,
	}))
	return buildMeta({
		pageMeta: {
			title: `${data.title} | GoodWatch`,
			description: data.description,
			url: site(data.canonical),
			image: `https://goodwatch.app/images/heroes/hero-${data.address.kind === "show" ? "shows" : "movies"}.png`,
			alt: data.title,
		},
		breadcrumbs: crumbs,
		robots: data.indexable ? undefined : "noindex, follow",
	})
}

const to = (a: Address, extra?: Record<string, string | undefined>) => browsePath(a, extra)

export default function BrowsePage() {
	const data = useLoaderData<typeof loader>()
	if (data.page === "tropes" || data.page === "trope") return <TropesRoute data={data} to={to} />
	if (data.page !== "place") return null
	return (
		<BrowsePageProvider value={{ marks: data.marks, entry: data.entry }}>
			{/* The Browse row adds 44px under the tab row from `lg`: a sticky bar inside the page sits under it. */}
			<div className="pb-16" style={{ "--browse-head-top": "calc(4rem + 93px)" } as CSSProperties}>
				<BrowseRow address={data.address} streamingCountry={data.viewer.country.toLowerCase()} />
				<PlacePage data={data.data} address={data.address} to={to} viewer={data.viewer} />
			</div>
		</BrowsePageProvider>
	)
}
