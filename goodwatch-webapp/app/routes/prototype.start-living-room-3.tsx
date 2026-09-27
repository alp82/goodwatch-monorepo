// PROTOTYPE - throwaway. Round 3 of the living room start page (#178). See the top of
// ~/ui/prototype-start-living-room/r3.tsx for what changed and why. Variants are rooms.
//   /prototype/start-living-room-3?variant=seat-a|seat-b|seat-c|seat-d|seat-e|original-b|loft-cozy[&look=current|aluminum|solar|pebble][&country=DE]
// Keyboard: up and down change the channel, 1 to 7 jump, G opens the guide, Enter is OK, Escape is Back.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import loftCozy from "~/img/prototype-living-room/loft-cozy.webp"
import originalB from "~/img/prototype-living-room/original-b.webp"
import seatA from "~/img/prototype-living-room/seat-a.webp"
import seatB from "~/img/prototype-living-room/seat-b.webp"
import seatC from "~/img/prototype-living-room/seat-c.webp"
import seatD from "~/img/prototype-living-room/seat-d.webp"
import seatE from "~/img/prototype-living-room/seat-e.webp"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { LivingRoom3, type Look, type Room3 } from "~/ui/prototype-start-living-room/r3"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"

const W = 1672
const H = 941
// Seated rooms: you're on the couch, the coffee table in front of you, everything in focus.
const ROOMS: Record<string, Room3> = {
	"seat-b": { name: "Seated, blanket on the lap", src: seatB, w: W, h: H, tv: { x: 516, y: 84, w: 640, h: 345 }, alt: "Sitting on the sofa under a knitted blanket, mugs and a candle on the coffee table" },
	"seat-a": { name: "Seated, popcorn and tea", src: seatA, w: W, h: H, tv: { x: 549, y: 93, w: 596, h: 321 }, alt: "Sitting on the sofa, popcorn, a mug, and a candle on the coffee table" },
	"seat-c": { name: "Seated, feet up, teal and amber", src: seatC, w: W, h: H, tv: { x: 523, y: 69, w: 624, h: 345 }, alt: "Feet in wool socks on the coffee table, a board game and snacks, teal and amber light" },
	"seat-d": { name: "Seated, brick loft, pizza night", src: seatD, w: W, h: H, tv: { x: 535, y: 85, w: 592, h: 319 }, alt: "Leather sofa arms, pizza and drinks on the table, brick wall and skyline" },
	"seat-e": { name: "Seated, tea by the lantern", src: seatE, w: W, h: H, tv: { x: 527, y: 89, w: 618, h: 335 }, alt: "A round oak table with tea and clementines, a paper lantern glowing" },
	"original-b": { name: "Round 3 room, blue night (reference)", src: originalB, w: W, h: H, tv: { x: 494, y: 92, w: 687, h: 362 }, alt: "A dark blue-grey living room with shelves, candles, and Edison bulbs" },
	"loft-cozy": { name: "Round 3 loft (reference)", src: loftCozy, w: W, h: H, tv: { x: 377, y: 89, w: 669, h: 353 }, alt: "A cozy brick loft at night with string lights and a skyline window" },
}

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getLivingRoom(request))
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room start page prototype, round 3 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

export default function LivingRoomRound3() {
	const data = useLoaderData<typeof loader>() as unknown as LRData
	const [params, setParams] = useSearchParams()
	const room = ROOMS[params.get("variant") ?? "seat-b"] ?? ROOMS["seat-b"]
	// The remote is held in a hand (owner, round 3). Which design: after Apple, Samsung, Google, or ours.
	const look: Look = (["current", "aluminum", "solar", "pebble"] as const).find((l) => l === params.get("look")) ?? "current"
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3 data={data} room={room} pose="hand" look={look} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(ROOMS).map(([k, v]) => [k, v.name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
			<LookBar
				look={look}
				onLook={(l) => {
					const next = new URLSearchParams(params)
					if (l === "current") next.delete("look")
					else next.set("look", l)
					setParams(next, { replace: true, preventScrollReset: true })
				}}
			/>
		</>
	)
}

// Prototype chrome: the remote design and a list of things to try. Hidden in production like the switcher.
const LOOKS: { key: Look; label: string }[] = [
	{ key: "current", label: "Current" },
	{ key: "aluminum", label: "Aluminum" },
	{ key: "solar", label: "Solar" },
	{ key: "pebble", label: "Pebble" },
]
const TRY = [
	"Point at any poster on the TV to open it; More like this tunes the mix.",
	"Press a streaming button to see only that service; press it again to clear.",
	"Mood: turn the wheel (drag around it or scroll over it) to change the mood.",
	"Tune: turn to an attribute, press SET for more, again for none.",
	"Search: type on the remote's screen and press Enter or GO.",
	"Get my picks: point at three titles you loved, then See my picks.",
	"Guide button, or G. Back is Escape. Up and down change the channel; 1 to 7 jump.",
]

function LookBar({ look, onLook }: { look: Look; onLook: (l: Look) => void }) {
	const [open, setOpen] = useState(false)
	if (process.env.NODE_ENV === "production") return null
	return (
		<div className="fixed left-1/2 top-[7.2rem] z-50 flex -translate-x-1/2 flex-col items-center gap-2">
			<div className="flex items-center gap-1 rounded-full bg-white px-1.5 py-1 text-[13px] font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
				<span className="px-2 text-neutral-500">Remote</span>
				{LOOKS.map((p) => (
					<button
						key={p.key}
						type="button"
						aria-pressed={look === p.key}
						onClick={() => onLook(p.key)}
						className={`rounded-full px-3 py-1 ${look === p.key ? "bg-fuchsia-600 text-white" : "hover:bg-neutral-200"}`}
					>
						{p.label}
					</button>
				))}
				<span className="mx-1 h-4 w-px bg-neutral-300" />
				<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-full px-3 py-1 hover:bg-neutral-200">
					{open ? "Hide tips" : "What to try"}
				</button>
			</div>
			{open && (
				<ul className="w-[420px] max-w-[92vw] space-y-1.5 rounded-2xl bg-white p-4 text-[13px] text-neutral-800 shadow-2xl ring-2 ring-fuchsia-500">
					{TRY.map((t) => (
						<li key={t} className="flex gap-2">
							<span className="text-fuchsia-600">•</span>
							{t}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
