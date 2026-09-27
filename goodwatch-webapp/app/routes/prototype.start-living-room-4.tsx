// PROTOTYPE - throwaway. Round 4 of the living room start page (#178). See the top of
// ~/ui/prototype-start-living-room/r4.tsx for the owner's round 3 feedback and what changed.
//   /prototype/start-living-room-4?variant=teal-a|teal-b|teal-c|seat-e4[&country=DE]
// The TV boots, then shows a start experience; the remote in your hand navigates it. Keyboard: up and down
// turn the wheel, Enter is OK, Escape is Back, H is Home.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tealA from "~/img/prototype-living-room/room-teal-a.webp"
import tealB from "~/img/prototype-living-room/room-teal-b.webp"
import tealC from "~/img/prototype-living-room/room-teal-c.webp"
import seatE4 from "~/img/prototype-living-room/seat-e4.webp"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { LivingRoom3, type Room3 } from "~/ui/prototype-start-living-room/r3"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"

const W = 1672
const H = 941
// Seat-e with the blanket, edited for teal-and-amber light, a few plants, and no blur anywhere.
const ROOMS: Record<string, Room3> = {
	"teal-a": { name: "Teal moonlight, amber lantern", src: tealA, w: W, h: H, tv: { x: 529, y: 90, w: 614, h: 333 }, alt: "Moonlight through a window and a warm paper lantern, a knitted blanket and one cup" },
	"teal-b": { name: "Teal wall, amber lantern", src: tealB, w: W, h: H, tv: { x: 529, y: 89, w: 614, h: 333 }, alt: "A deep teal wall lit amber by a paper lantern, a knitted blanket and one cup" },
	"teal-c": { name: "Teal shelf light, amber lantern", src: tealC, w: W, h: H, tv: { x: 529, y: 89, w: 614, h: 333 }, alt: "Teal light in the bookshelves, a warm paper lantern, a knitted blanket and one cup" },
	"seat-e4": { name: "Round 4 blanket room (reference)", src: seatE4, w: W, h: H, tv: { x: 528, y: 90, w: 615, h: 333 }, alt: "A wool blanket over the lap, one cup on a round oak table, a paper lantern" },
}

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getLivingRoom(request))
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room start page prototype, round 4 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Switching rooms must not re-run the loader (each run costs database queries).
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

export default function LivingRoomRound4() {
	const data = useLoaderData<typeof loader>() as unknown as LRData
	const [params] = useSearchParams()
	const room = ROOMS[params.get("variant") ?? "teal-a"] ?? ROOMS["teal-a"]
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3 data={data} room={room} pose="hand" round4 />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(ROOMS).map(([k, v]) => [k, v.name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
		</>
	)
}
