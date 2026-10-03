import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { useEffect, useState } from "react"
import type { ExplorerMap as MapData } from "~/domain/explorer"
import { explorerQueryOf } from "~/server/explorer/http.server"
import {
	ExplorerUnavailable,
	getExplorerMap,
} from "~/server/explorer/index.server"
import { isEnabled } from "~/server/features.server"
import { getViewerContext } from "~/server/viewer.server"
import { ExplorerMap } from "~/ui/explorer/ExplorerMap"
import { IslandList } from "~/ui/explorer/IslandList"
import explorerCss from "~/ui/explorer/explorer.css?url"
import { getUserIdFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

// Explorer: the islands map, behind REC_EXPLORER (not found while it's off, or for viewers outside the preview list).
// The server renders the grouping's islands as a list of headings and links, for browsers without JavaScript and
// for search engines; the map replaces it once the page runs.

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("explorer", { userId }))
		throw new Response("Not found", { status: 404 })
	let map: MapData | null = null
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		map = await getExplorerMap(
			ctx,
			explorerQueryOf(new URL(request.url).searchParams),
		)
	} catch (error) {
		// The first seconds after the server starts: the page loads the map itself once the snapshot is in.
		if (!(error instanceof ExplorerUnavailable)) throw error
	}
	return json({ map }, { headers: { "Cache-Control": "private, no-store" } })
}

// The map follows the URL's grouping and filters itself; only a new page load asks the server again.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && currentUrl.pathname === nextUrl.pathname
		? false
		: defaultShouldRevalidate

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Explorer | GoodWatch",
		description:
			"Explore movies and TV shows as a map of islands by mood, theme, style, occasion, genre, decade, country, or how close they are to your taste. Zoom in on an island to find titles you'll love.",
		url: "https://goodwatch.app/explorer",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Movies and TV shows as islands on a map on GoodWatch",
	}
	return buildMeta({ pageMeta })
}

export const links = () => [
	{ rel: "stylesheet", href: explorerCss },
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap",
	},
]

// Without JavaScript the list shows in place of the map, and the controls that need the map step aside.
const NO_SCRIPT_CSS =
	".ex-list{inset:0;width:auto;height:auto;overflow-y:auto;clip-path:none;padding:24px 24px 48px}.ex-top,.ex-rail,.ex-hint,.ex-loading{display:none}"

export default function ExplorerPage() {
	const { map } = useLoaderData<typeof loader>()
	const [running, setRunning] = useState(false)
	useEffect(() => setRunning(true), [])
	return (
		<>
			<noscript>
				<style>{NO_SCRIPT_CSS}</style>
			</noscript>
			<ExplorerMap
				initialMap={map as MapData | null}
				fallback={!running && map ? <IslandList map={map as MapData} /> : null}
			/>
		</>
	)
}
