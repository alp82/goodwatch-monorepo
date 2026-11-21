// The Browse hub: `/movies`, `/shows`, and `/all` (movies and shows together). Any other first segment that no route
// names answers 404 here: a redirect to a hub would read as a soft 404 to a crawler.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { hub, kindOfSeg, kindSeg } from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy"
import { notFound } from "~/domain/browse/not-found"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { WRAP } from "~/ui/browse/base"
import { BrowseRow } from "~/ui/browse/BrowseRow"
import { PageTitle } from "~/ui/heading"
import { buildMeta } from "~/utils/meta"

const canonicalLoader = async ({ params }: LoaderFunctionArgs) => {
	const kind = kindOfSeg(params.type)
	if (!kind) throw notFound()
	return { address: hub(kind) }
}

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
	const { address } = useLoaderData<typeof loader>()
	const copy = copyFor(kindSeg(address.kind), "hub", "home")
	return (
		<div className="pb-16">
			<BrowseRow address={address} />
			<div className={`${WRAP} pt-8`}>
				<PageTitle className="text-4xl font-extrabold text-white md:text-5xl">
					{HEADINGS[address.kind]}
				</PageTitle>
				{copy && <p className="mt-3 max-w-2xl text-lg text-gray-300">{copy.lede}</p>}
			</div>
		</div>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/$type._index")
