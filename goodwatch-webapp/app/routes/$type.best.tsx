// /movies/best and /shows/best: the sitemap's movies or shows, best first, 250 a page (see domain/best-lists.ts). A
// later page is `?page=N`, its own address with its own canonical; a page past the last answers 404.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	LIST_KINDS,
	type ListKind,
	listCopy,
	listName,
	pageCount,
	pagePath,
	pageRange,
	requestedPage,
	titleKindOf,
} from "~/domain/best-lists"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { getRankedList } from "~/server/best-lists.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { rowServices } from "~/server/row-services.server"
import { ListHead } from "~/ui/best-lists/ListHead"
import { ListPageLinks, RankedTitles } from "~/ui/best-lists/RankedTitles"
import { notFound } from "~/ui/explore/address"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { buildMeta } from "~/utils/meta"

const crumbsOf = (kind: ListKind): Crumb[] => [
	{ label: kind === "movies" ? "Movies" : "Shows", path: `/${kind}` },
	{ label: listName(kind), path: `/${kind}/best` },
]

const canonicalLoader = async ({ params, request }: LoaderFunctionArgs) => {
	const kind = params.type as ListKind
	if (!LIST_KINDS.includes(kind)) throw notFound()
	const { titles, popular } = await getRankedList(titleKindOf(kind))
	const total = titles.length
	const pages = pageCount(total)
	const page = requestedPage(new URL(request.url).search)
	if (page > pages) throw notFound()
	const { first, last } = pageRange(page, total)
	const shown = titles.slice(first - 1, last)
	return {
		kind,
		page,
		pages,
		total,
		popular,
		first,
		titles: shown,
		// A member's own services per title, for the logos in the rows; null for a guest, whose page is shared.
		services: await rowServices(
			request,
			shown.map((t) => ({ mediaType: t.media_type, tmdbId: t.tmdb_id })),
		),
	}
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const { kind, page, pages, total, popular, first, titles } = data
	const copy = listCopy(kind, { total, popular, page })
	return buildMeta({
		pageMeta: {
			title: copy.title,
			description: copy.description,
			url: `https://goodwatch.app${pagePath(kind, page)}`,
			image: `https://goodwatch.app/images/heroes/hero-${kind}.png`,
			alt: copy.heading,
		},
		breadcrumbs: crumbsOf(kind),
		itemList: { paths: titles.map((t) => t.path), first },
		pages: {
			prev: page > 1 ? pagePath(kind, page - 1) : undefined,
			next: page < pages ? pagePath(kind, page + 1) : undefined,
		},
	})
}

export default function BestList() {
	const { kind, page, pages, total, popular, first, titles, services } =
		useLoaderData<typeof loader>()
	const copy = listCopy(kind, { total, popular, page })
	const links = (
		<ListPageLinks kind={kind} page={page} pages={pages} total={total} />
	)
	return (
		<div className="pb-16">
			<ListHead heading={copy.heading} intro={copy.intro}>
				<div className="mt-3">{links}</div>
			</ListHead>
			<RankedTitles titles={titles} first={first} services={services} />
			<div className="mx-auto mt-6 max-w-7xl px-4">{links}</div>
		</div>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/$type.best")
