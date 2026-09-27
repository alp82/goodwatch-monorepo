// PROTOTYPE - throwaway. The living room background (#188), round 3: the dusk room, rebuilt to pass a strict defect review.
// real photograph rather than a staged render. Round 1's verdict: dusk + `hifi` upscale is the baseline.
//   /prototype/start-living-room-room-3?variant=fixed|popcorn|citrus|tea&hand=graded|raw
//   fixed    round 2's dusk room (the owner's favorite for coziness and color), as the baseline.
//   popcorn, citrus, tea   fresh generations in its palette, each run through the defect loop: a strict
//            vision review of 12 zoomed crops, local crop edits pasted back into the untouched original, a
//            nine-tile detail pass that re-renders every region at 2.6x, and a final review.
// Rooms are encoded at 2560 px with Lanczos (the GAN upscalers invented worm textures). TV rects: rooms188/r3.json.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tvs from "~/img/prototype-living-room/rooms188/r3.json"
import fixedR2 from "~/img/prototype-living-room/rooms188/r2-fixed.webp"
import tvs2 from "~/img/prototype-living-room/rooms188/r2.json"
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

const FILES = import.meta.glob("/app/img/prototype-living-room/rooms188/r3-*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>
const TVS = tvs as Record<string, Room3["tv"]>

const ROOMS: Record<string, { name: string; alt: string }> = {
	fixed: { name: "Dusk, fixed (round 2)", alt: "A living room at dusk with a small dark coffee table, Blu-rays on the shelves, and a rust sofa" },
	popcorn: { name: "Popcorn and wine", alt: "A dim teal living room at dusk, popcorn and two glasses of wine on an oval table, a paper lantern glowing" },
	citrus: { name: "Clementines and candle", alt: "A dim teal living room at dusk, clementines and a candle on a stone-topped table, window shadows on the wall" },
	tea: { name: "Tea tray", alt: "A dim teal living room at dusk, a teapot on a tray and a book on a walnut table, a paper lantern glowing" },
}
const FILE_OF: Record<string, string> = { popcorn: "e3", citrus: "e2", tea: "e4" }

const roomOf = (k: string): Room3 | null => {
	const src = k === "fixed" ? fixedR2 : FILES[`/app/img/prototype-living-room/rooms188/r3-${FILE_OF[k]}.webp`]
	if (!src) return null
	const tv = k === "fixed" ? (tvs2 as Record<string, Room3["tv"]>).fixed : TVS[FILE_OF[k]]
	return { name: ROOMS[k].name, alt: ROOMS[k].alt, src, w: 1672, h: 941, tv }
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
export const meta = () => [{ title: "Living room prototype: the room, round 3 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function LivingRoomRoom3() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params, setParams] = useSearchParams()
	const ready = Object.keys(ROOMS).filter((k) => roomOf(k))
	const key = ready.includes(params.get("variant") ?? "") ? (params.get("variant") as string) : ready.includes("popcorn") ? "popcorn" : ready[0]
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
