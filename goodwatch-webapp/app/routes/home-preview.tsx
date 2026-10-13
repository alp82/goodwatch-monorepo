// A build aid for the new TV (docs/implementation/tv-screen-revamp): the start page with the new TV at
// /home-preview, so its slices can be seen on the integration branch before the new TV replaces the old one on `/`.
// No flag: the branch is not merged until the new TV is complete. The switch slice deletes this file.
// Noindex with the canonical of `/`, in no sitemap, linked from nowhere, and never stored by a cache.
//
// The TV's screen lives in the search params (`?tv=discover&mood=funny`); changing only those never reruns the
// loader.
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
} from "@remix-run/react"
import type { tvHomeLoader } from "~/server/living-room/tv-loader.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvLivingRoom } from "~/ui/living-room/tv/TvLivingRoom"
import { isTvOnlyChange } from "~/ui/living-room/tv/tv-machine"
import tvCss from "~/ui/living-room/tv/tv.css?url"
import { assetUrl } from "~/utils/asset-url"

export { tvHomeLoader as loader } from "~/server/living-room/tv-loader.server"
export { pageHeaders as headers } from "~/utils/headers"

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && isTvOnlyChange(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
	{ rel: "stylesheet", href: assetUrl(tvCss) },
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]

export const meta: MetaFunction = () => [
	{ title: "The new TV (preview) · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
	{ tagName: "link", rel: "canonical", href: "https://goodwatch.app/" },
]

export default function HomePreview() {
	const data = useLoaderData<typeof tvHomeLoader>()
	return <TvLivingRoom data={data} />
}
