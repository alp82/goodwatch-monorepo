// PROTOTYPE - throwaway. "How should the TV hand over to a real page, and how does the person get back?" Nine
// transitions from the approved Cinema TV into the REAL page behind its Expand key, and three ways back:
//   /prototype/tv-expand?t=today|grow|frame|morph|camera|live|wipe|lean|leanlite&back=bar|key|esc&slow=1&calm=1
// Without `t` it opens on "Lean in" (6 and 5 combined, with 3's frame) and the scroll-up bar, the owner's picks.
// The keys 1 to 9 choose the transition, B the way back, W a slow page, R reduced motion, D the other TV screen;
// the arrow keys, Enter and Escape drive the TV like the Remote. The real pages need a dev server that can read
// Crate and Valkey. See app/ui/prototype-tv-expand/scene.tsx and docs/prototypes/tv-expand-transitions/README.md.
import { type LinksFunction, type LoaderFunctionArgs, redirect } from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvExpandScene } from "~/ui/prototype-tv-expand/scene"
import { assetUrl } from "~/utils/asset-url"

export function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// The TV starts on the mini Discover results, with the Expand key focused.
	const url = new URL(request.url)
	if (!url.searchParams.has("at")) {
		url.searchParams.set("at", "home.discover.discover-funny")
		url.searchParams.set("f", "expand")
		throw redirect(url.pathname + url.search)
	}
	return null
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]
export const meta = () => [{ title: "TV expand transitions prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TvExpandPrototype() {
	return <TvExpandScene />
}
