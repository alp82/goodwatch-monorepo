// PROTOTYPE - throwaway. The living room's TV screens and user flow (#187), round 1. See the top of
// ~/ui/prototype-start-living-room/flow1.tsx for the open points and what each flow tries.
//   /prototype/start-living-room-tv?variant=ask|launcher|tonight&as=guest|new|me
// `as` picks the audience like the old start page prototype did: a first-visit guest, a new member (5 ratings,
// three services, 3 on the Wishlist), or you (the default when signed in). The remote is round 8's `grid`
// (?remote= picks another round 8 layout). Keyboard: up and down turn the wheel, Enter is OK, Escape is Back.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tealA from "~/img/prototype-living-room/room-teal-a.webp"
import { type HomeData, getHome } from "~/server/prototype-rec-home.server"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { AudienceBar } from "~/ui/prototype-rec-home/kit"
import { type Home, useHome } from "~/ui/prototype-rec-home/model"
import { FLOWS, type Flow, FlowScreen, type FlowT, useFlow } from "~/ui/prototype-start-living-room/flow1"
import { LivingRoom3, type Room3, type TvSlot } from "~/ui/prototype-start-living-room/r3"
import type { Tv4 } from "~/ui/prototype-start-living-room/r4"
import { LR5_CSS } from "~/ui/prototype-start-living-room/r5"
import { LR6_CSS } from "~/ui/prototype-start-living-room/r6"
import { LAYOUTS7, type Layout7, Remote7 } from "~/ui/prototype-start-living-room/r7"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"

const ROOM: Room3 = {
	name: "Teal moonlight, amber lantern",
	src: tealA,
	w: 1672,
	h: 941,
	tv: { x: 529, y: 90, w: 614, h: 333 },
	alt: "Moonlight through a window and a warm paper lantern, a knitted blanket and one cup",
}

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const [lr, home] = await Promise.all([getLivingRoom(request), getHome(request)])
	return json({ lr, home })
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room prototype: TV screens and flow · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Switching flows must not re-run the loader; switching audience or country must.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => ["as", "country"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

const ORDER: Flow[] = ["ask", "launcher", "tonight"]

export default function LivingRoomTv() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params] = useSearchParams()
	const flow = (ORDER.includes(params.get("variant") as Flow) ? params.get("variant") : "ask") as Flow
	const layout = ((params.get("remote") as Layout7) in LAYOUTS7 ? params.get("remote") : "grid") as Layout7
	// Remount on every switch, so each flow and audience starts from a fresh TV.
	return <Room key={`${flow}:${home.audience}:${home.who.label}`} lr={lr} home={home} flow={flow} layout={layout} />
}

function Room({ lr, home, flow, layout }: { lr: LRData; home: HomeData; flow: Flow; layout: Layout7 }) {
	const h = useHome(home)
	const tv: TvSlot = {
		use: (z, services) => useFlow(z, h, flow, services) as unknown as Tv4,
		screen: (t) => <FlowScreen t={t as unknown as FlowT} />,
	}
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3 data={lr} room={ROOM} pose="hand" round4 tvSlot={tv} remote={(p) => <Remote7 layout={layout} {...p} />} />
			<style dangerouslySetInnerHTML={{ __html: `${LR5_CSS} ${LR6_CSS}` }} />
			<PrototypeSwitcher variants={Object.fromEntries(ORDER.map((k) => [k, FLOWS[k].name]))} position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top" />
			<Audience h={h} />
		</>
	)
}

function Audience({ h }: { h: Home }) {
	return (
		<div className="[&_[data-audience]]:!bottom-auto [&_[data-audience]]:!top-[4.75rem] [&_[data-audience]]:!left-4">
			<AudienceBar h={h} />
		</div>
	)
}
