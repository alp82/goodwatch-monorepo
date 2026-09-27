// PROTOTYPE - throwaway. The living room background (#188), round 2: different rooms at dusk, aiming for a
// real photograph rather than a staged render. Round 1's verdict: dusk + `hifi` upscale is the baseline.
//   /prototype/start-living-room-room-2?variant=dusk|fixed|altbau|nordic|den|city&hand=raw|graded
//   dusk    round 1's dusk room, the baseline.
//   fixed   the dusk room edited one change at a time: a smaller dark coffee table apart from the sofa with a
//           small cup, shelves with Blu-rays and one print, a linen sofa and a moss-green blanket.
//   altbau, nordic, den, city   new rooms, same camera and TV position, written with the photo-prompt research
//           (real-camera language, mixed light, counted objects, lived-in details).
// Every room is a 1672 x 941 generation with a chroma-key screen, measured, painted black, and upscaled to
// 2560 px with the high-fidelity model. The TV rectangle per room is in rooms188/r2.json.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tvs from "~/img/prototype-living-room/rooms188/r2.json"
import duskHifi from "~/img/prototype-living-room/rooms188/dusk-hifi.webp"
import handGraded from "~/img/prototype-living-room/rooms188/hand-graded.webp"
import { type HomeData, getHome } from "~/server/prototype-rec-home.server"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useHome } from "~/ui/prototype-rec-home/model"
import { FlowScreen, type FlowT, useFlow } from "~/ui/prototype-start-living-room/flow1"
import { LivingRoom3, type Room3, type TvSlot } from "~/ui/prototype-start-living-room/r3"
import type { Tv4 } from "~/ui/prototype-start-living-room/r4"
import { LR5_CSS } from "~/ui/prototype-start-living-room/r5"
import { LR6_CSS } from "~/ui/prototype-start-living-room/r6"
import { Remote7 } from "~/ui/prototype-start-living-room/r7"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"

const FILES = import.meta.glob("/app/img/prototype-living-room/rooms188/r2-*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>
const TVS = tvs as Record<string, Room3["tv"]>

const ROOMS: Record<string, { name: string; alt: string }> = {
	dusk: { name: "Dusk (baseline)", alt: "A living room at dusk, a paper lantern, shelves, and a round table" },
	fixed: { name: "Dusk, fixed", alt: "The dusk living room with a small dark coffee table, Blu-rays on the shelves, and a linen sofa" },
	altbau: { name: "Berlin pre-war flat", alt: "A pre-war apartment at dusk with parquet, a tall window, a bookcase of Blu-rays, and a corduroy sofa" },
	nordic: { name: "Copenhagen flat", alt: "A small Scandinavian flat at dusk with a sage wall, an oak media bench, and a travertine table" },
	den: { name: "1970s den", alt: "A walnut-panelled den at dusk with a wall unit of records and Blu-rays and a leather sofa" },
	city: { name: "High-floor city flat", alt: "A city apartment at dusk with a wall of windows, a dark sideboard of Blu-rays, and a boucle sofa" },
}

const roomOf = (k: string): Room3 | null => {
	const src = k === "dusk" ? duskHifi : FILES[`/app/img/prototype-living-room/rooms188/r2-${k}.webp`]
	if (!src) return null
	return { name: ROOMS[k].name, alt: ROOMS[k].alt, src, w: 1672, h: 941, tv: k === "dusk" ? { x: 529, y: 90, w: 614, h: 333 } : TVS[k] }
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
export const meta = () => [{ title: "Living room prototype: the room, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function LivingRoomRoom2() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params, setParams] = useSearchParams()
	const ready = Object.keys(ROOMS).filter((k) => roomOf(k))
	const key = ready.includes(params.get("variant") ?? "") ? (params.get("variant") as string) : "dusk"
	const room = roomOf(key) as Room3
	const graded = params.get("hand") !== "raw"
	const h = useHome(home)
	const tv: TvSlot = {
		use: (z, services) => useFlow(z, h, "ask", services) as unknown as Tv4,
		screen: (t) => <FlowScreen t={t as unknown as FlowT} />,
	}
	const setHand = (v: string) => {
		const p = new URLSearchParams(params)
		p.set("hand", v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const chip = (on: boolean) => `rounded-full px-2.5 py-1 ${on ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"}`
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3 data={lr} room={room} pose="hand" round4 tvSlot={tv} remote={(p) => <Remote7 layout="grid" {...p} />} handSrc={graded ? handGraded : undefined} />
			<style dangerouslySetInnerHTML={{ __html: `${LR5_CSS} ${LR6_CSS}` }} />
			<PrototypeSwitcher variants={Object.fromEntries(ready.map((k) => [k, ROOMS[k].name]))} position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top" />
			<div className="fixed left-4 top-[4.75rem] z-[60] flex gap-1 rounded-xl bg-black/80 p-2 text-xs text-white ring-1 ring-white/15">
				<button type="button" className={chip(graded)} onClick={() => setHand("graded")}>
					Hand graded
				</button>
				<button type="button" className={chip(!graded)} onClick={() => setHand("raw")}>
					Hand as is
				</button>
			</div>
		</>
	)
}
