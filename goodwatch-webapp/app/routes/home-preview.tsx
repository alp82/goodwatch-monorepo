// A build aid for the new TV (docs/implementation/tv-screen-revamp): the start page's new room at /home-preview,
// so its slices can be seen on the integration branch before the new TV replaces the old one on `/`. No flag:
// the branch is not merged until the new TV is complete. The switch slice deletes this file.
// Noindex with the canonical of `/`, in no sitemap, linked from nowhere, and never stored by a cache.
//
// So far it shows the room with an empty TV (slice 2). SEAM: slice 3 gives it its own loader
// (server/living-room/tv-loader.server.ts), `useTv` in place of the stand-in, and `shouldRevalidate`.
import { type LinksFunction, type MetaFunction, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { PRIVATE_CACHE_CONTROL } from "~/server/living-room/data.server"
import { loadStartTitles } from "~/server/living-room/start-titles.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvRoom } from "~/ui/living-room/tv/TvRoom"
import { EmptyTv, useRoomStandIn } from "~/ui/living-room/tv/room-stand-in"
import tvCss from "~/ui/living-room/tv/tv.css?url"
import { assetUrl } from "~/utils/asset-url"

export { pageHeaders as headers } from "~/utils/headers"

export async function loader() {
	// The titles below the room, as on the start page: without them the section shows the hubs alone.
	const startTitles = await loadStartTitles(
		getTitleSnapshot(),
		getDisplayFields,
	)
	return json(
		{ startTitles },
		{ headers: { "Cache-Control": PRIVATE_CACHE_CONTROL } },
	)
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
	{ rel: "stylesheet", href: assetUrl(tvCss) },
]

export const meta: MetaFunction = () => [
	{ title: "The new TV (preview) · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
	{ tagName: "link", rel: "canonical", href: "https://goodwatch.app/" },
]

export default function HomePreview() {
	const { startTitles } = useLoaderData<typeof loader>()
	const { tv, lastKey } = useRoomStandIn()
	return (
		<TvRoom
			tv={tv}
			startTitles={startTitles}
			renderScreen={(canvas) => <EmptyTv canvas={canvas} lastKey={lastKey} />}
		/>
	)
}
