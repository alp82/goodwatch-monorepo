// PROTOTYPE - throwaway. Round 2 of the living room start page (#178). Owner on round 1: "the room is a good
// start", wants a bigger, modern remote with an LCD that picks moods, switches attributes, and searches, and
// some variations of the living room. Variants are rooms; the remote and channels are the same in each.
//   /prototype/start-living-room-2?variant=original|midcentury|cabin|loft|japandi|seventies|greenhouse[&country=DE]
// Remote: CH, Mood, Tune, and Search modes; drag around the wheel or scroll over it to step, OK to apply.
// Keyboard: up and down change the channel, 1 to 7 jump, G opens the guide.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { ROOMS, Room2 } from "~/ui/prototype-start-living-room/room2"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getLivingRoom(request))
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room start page prototype, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

export default function LivingRoomRound2() {
	const data = useLoaderData<typeof loader>() as unknown as LRData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "midcentury"
	const room = ROOMS[key] ?? ROOMS.midcentury
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			{/* Same remote and TV across rooms: switching keeps the channel and your mood. */}
			<Room2 data={data} room={room} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(ROOMS).map(([k, v]) => [k, v.name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
		</>
	)
}
