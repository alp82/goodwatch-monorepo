// /movies/top, /shows/top and /all/top: the Top lists (server/top-page.server.ts). Without filters each is the
// published ranking, 250 a page; a later page is `?page=N`, its own address with its own canonical, and a page past the
// last answers 404. A mood, genre, decade or year (`?with=`, `?year=`) narrows the ranking on a page of its own that
// isn't indexed, and so is everything under /all. The old `/movies/best` addresses answer 301 here
// (domain/browse/redirects.ts).
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { browsePath, kindLabel, kindOfSeg, parse, withKind, KINDS } from "~/domain/browse/address"
import { notFound } from "~/domain/browse/not-found"
import { listName } from "~/domain/top-lists"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { PlacesNotReady, openPlaces } from "~/server/browse/places.server"
import { loadTopPage } from "~/server/top-page.server"
import { TopRanking } from "~/ui/top-lists/TopRanking"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { buildMeta } from "~/utils/meta"
import { EXPLORE_AFTER_PAINT } from "~/utils/start-after-paint"

export const handle = EXPLORE_AFTER_PAINT

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
	const kind = kindOfSeg(params.type)
	if (!kind) throw notFound()
	const url = new URL(request.url)
	let places: Awaited<ReturnType<typeof openPlaces>>
	try {
		places = await openPlaces(request, kind)
	} catch (error) {
		if (error instanceof PlacesNotReady)
			throw new Response("Loading", {
				status: 503,
				headers: { "Retry-After": "5", "Cache-Control": "no-store" },
			})
		throw error
	}
	const pathname = url.pathname.replace(/\/+$/, "")
	const address = parse(pathname, url.searchParams, places)
	if (!address || address.view !== "top") throw notFound()
	const page = await loadTopPage(places, address, url.searchParams)
	if (!page) throw notFound()
	return {
		...page,
		kinds: KINDS.map((k) => ({
			kind: k,
			label: kindLabel(k),
			href: browsePath(withKind({ ...address, page: undefined }, k)),
			on: address.kind === k,
		})),
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const crumbs: Crumb[] = [
		{
			label: kindLabel(data.kind),
			path: browsePath({ view: "hub", kind: data.kind, parts: [], country: "us" }),
		},
		{ label: listName(data.listKind), path: data.canonical.split("?")[0] },
	]
	const indexable = data.published && data.kind !== "all"
	return buildMeta({
		pageMeta: {
			title: data.title,
			description: data.description,
			url: `https://goodwatch.app${data.canonical}`,
			image: `https://goodwatch.app/images/heroes/hero-${data.kind === "show" ? "shows" : "movies"}.png`,
			alt: data.heading,
		},
		robots: indexable ? "index, follow" : "noindex, follow",
		breadcrumbs: crumbs,
		itemList: { paths: data.rows.map((r) => r.title.to), first: data.first },
		pages: { prev: data.prev, next: data.next },
	})
}

export default function TopList() {
	const data = useLoaderData<typeof loader>()
	return <TopRanking data={data} kinds={data.kinds} />
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/$type.top")
