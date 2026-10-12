// PROTOTYPE - throwaway. "Which TV screens exist on the start page's TV, how do you move between them, and how do
// you leave for a real page?" Three flow variants in the room with the reworked Remote:
//   /prototype/tv-screen-flow?variant=rows|apps|guided&as=guest|member&view=room|tv&label=expand|full-view|...
// The three buttons at the top left (or the keys 1, 2, 3) switch the variant; the arrow keys, Enter, Escape, H, M and
// S drive the TV like the Remote.
// Sample data only, nothing is read or written. See app/ui/prototype-tv-flow/scene.tsx for every parameter, and
// docs/prototypes/tv-screen-flow/README.md for the screen maps, the screenshots and the open questions.
import type { LinksFunction } from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvFlowScene } from "~/ui/prototype-tv-flow/scene"
import { assetUrl } from "~/utils/asset-url"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: assetUrl(livingRoomCss) }]
export const meta = () => [{ title: "TV screen flow prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TvScreenFlowPrototype() {
	return <TvFlowScene />
}
