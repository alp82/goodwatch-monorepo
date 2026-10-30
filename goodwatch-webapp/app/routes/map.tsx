import {
	liveMediaLanguage,
	localizeTitlePayload,
} from "~/server/media-payload.server"
import { isbot } from "isbot"
import { assetUrl } from "~/utils/asset-url"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { useEffect, useState } from "react"
import type { ExplorerWorld } from "~/domain/explorer"
import {
	explorerQueryOf,
	EXPLORER_OVERLAY_MAX_TITLES,
} from "~/server/explorer/http.server"
import { ExplorerUnavailable } from "~/server/explorer/index.server"
import { getExplorerWorld } from "~/server/explorer/world.server"
import { getViewerContext } from "~/server/viewer.server"
import { ExplorerMap } from "~/ui/explorer/ExplorerMap"
import { IslandList } from "~/ui/explorer/IslandList"
import explorerCss from "~/ui/explorer/explorer.css?url"
import { getUserIdFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

// Explorer: the islands map.
// The server renders every grouping's islands as a list of headings and links, for browsers without JavaScript and
// for search engines; the map replaces it once the page runs.

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	let world: ExplorerWorld | null = null
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		world = await getExplorerWorld(
			ctx,
			explorerQueryOf(new URL(request.url).searchParams),
		)
	} catch (error) {
		// The first seconds after the server starts: the page loads the map itself once the snapshot is in.
		if (!(error instanceof ExplorerUnavailable)) throw error
	}
	const language = await liveMediaLanguage(request, userId)
	if (world && !isbot(request.headers.get("user-agent")))
		world = await localizeTitlePayload(world, language, undefined, undefined, {
			maxTitles: EXPLORER_OVERLAY_MAX_TITLES,
		})
	return json(
		{ world, displayLanguage: language ?? "en" },
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

// The map follows the URL's filters and picked islands itself; only a new page load asks the server again.
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
		title: "Map | GoodWatch",
		description:
			"Explore movies and TV shows as a map of islands by mood, theme, style, occasion, decade, country, or how close they are to your taste. Combine up to five islands and zoom in to find titles you'll love.",
		url: "https://goodwatch.app/map",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Movies and TV shows as islands on a map on GoodWatch",
	}
	return buildMeta({ pageMeta })
}

export const links = () => [
	{
		rel: "stylesheet",
		href: assetUrl(explorerCss),
		crossOrigin: "anonymous" as const,
	},
]

// Without JavaScript the list shows in place of the map, and the controls that need the map step aside.
const NO_SCRIPT_CSS =
	".ex-list{inset:0;width:auto;height:auto;overflow-y:auto;clip-path:none;padding:24px 24px 48px}.ex-top,.ex-rail,.ex-hint,.ex-loading{display:none}"

export default function ExplorerPage() {
	const data = useLoaderData<typeof loader>()
	const world = data.world as ExplorerWorld | null
	const [running, setRunning] = useState(false)
	useEffect(() => setRunning(true), [])
	return (
		<>
			<noscript>
				<style>{NO_SCRIPT_CSS}</style>
			</noscript>
			<ExplorerMap
				initialWorld={world}
				initialLanguage={data.displayLanguage}
				fallback={!running && world ? <IslandList world={world} /> : null}
			/>
		</>
	)
}

export const loader = canonicalLoader
