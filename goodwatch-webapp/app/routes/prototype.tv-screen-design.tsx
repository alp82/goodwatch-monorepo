// PROTOTYPE - throwaway. "What should the start page's TV look like?" Round two of the TV revamp: the apps flow of
// /prototype/tv-screen-flow in three visual directions, with real posters and backdrops and a larger TV in the room:
//   /prototype/tv-screen-design?design=cinema|marquee|glow&as=guest|member&view=room|tv&label=expand|full-view|...
// The three buttons at the top left (or the keys 1, 2, 3) switch the direction; the arrow keys, Enter, Escape, H, M
// and S drive the TV like the Remote. Sample data and TMDB art only, nothing is read or written. See
// app/ui/prototype-tv-design/scene.tsx for every parameter, and docs/prototypes/tv-screen-design/README.md.
import type { LinksFunction } from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvDesignScene } from "~/ui/prototype-tv-design/scene"
import { assetUrl } from "~/utils/asset-url"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]
export const meta = () => [{ title: "TV screen design prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TvScreenDesignPrototype() {
	return <TvDesignScene />
}
