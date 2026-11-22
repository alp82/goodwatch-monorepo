// The Browse hub: `/movies`, `/shows`, and `/all` (movies and shows together). Any other first segment that no route
// names answers 404 here: a redirect to a hub would read as a soft 404 to a crawler.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { CSSProperties } from "react"
import { type Address, browsePath, hub, kindOfSeg, kindSeg } from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy"
import { notFound } from "~/domain/browse/not-found"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { hubViewData } from "~/server/browse/hub/view-data"
import { loadHubPage } from "~/server/browse/hub/hub.server"
import { PlacesNotReady, openPlaces } from "~/server/browse/places.server"
import { BrowseRow } from "~/ui/browse/BrowseRow"
import { HubPage } from "~/ui/browse/hub/HubPage"
import { buildMeta } from "~/utils/meta"
import { EXPLORE_AFTER_PAINT } from "~/utils/start-after-paint"

export const handle = EXPLORE_AFTER_PAINT

const canonicalLoader = async ({ params, request }: LoaderFunctionArgs) => {
	const kind = kindOfSeg(params.type)
	if (!kind) throw notFound()
	const address = hub(kind)
	let atlas: Awaited<ReturnType<typeof openPlaces>>
	try {
		atlas = await openPlaces(request, kind, "us")
	} catch (error) {
		if (error instanceof PlacesNotReady)
			throw new Response("Loading", {
				status: 503,
				headers: { "Retry-After": "5", "Cache-Control": "no-store" },
			})
		throw error
	}
	const url = new URL(request.url)
	return {
		address,
		viewer: atlas.viewer,
		data: hubViewData(await loadHubPage({ request, url, address, atlas })),
	}
}

const to = (a: Address, extra?: Record<string, string | undefined>) => browsePath(a, extra)

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

const HEADINGS = { movie: "Movies", show: "Shows", all: "Movies and shows" } as const

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const { kind } = data.address
	const seg = kindSeg(kind)
	const copy = copyFor(seg, "hub", "home")
	return buildMeta({
		pageMeta: {
			title: `${HEADINGS[kind]} by mood, genre, era, and place | GoodWatch`,
			description: copy?.lede ?? "",
			url: `https://goodwatch.app/${seg}`,
			image: `https://goodwatch.app/images/heroes/hero-${kind === "show" ? "shows" : "movies"}.png`,
			alt: copy?.short ?? HEADINGS[kind],
		},
		breadcrumbs: [{ label: HEADINGS[kind], path: `/${seg}` }],
		// Movies and shows together repeat two indexable hubs.
		robots: kind === "all" ? "noindex, follow" : undefined,
	})
}

export default function BrowseHub() {
	const { address, viewer, data } = useLoaderData<typeof loader>()
	return (
		<div className="pb-16" style={{ "--browse-head-top": "calc(4rem + 93px)" } as CSSProperties}>
			<BrowseRow address={address} streamingCountry={viewer.country.toLowerCase()} />
			<HubPage address={address} viewer={viewer} to={to} data={data} />
		</div>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/$type._index")
