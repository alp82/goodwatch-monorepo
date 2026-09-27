// PROTOTYPE - throwaway. The living room background (#188), round 4: the fixed room itself, made clean without
// losing its feel. Round 3 drifted from it (wall color, light, couch, coziness); this round treats `fixed` as
// the reference and measures every candidate against it.
//   /prototype/start-living-room-room-4?variant=round5|faithful|reshoot|reshoot-oat|fixed&hand=graded|raw
//   round5       `faithful` after the owner's round 4 notes: fewer, real-looking Blu-rays, no bowls, a new print,
//                two plants fewer (a film camera instead), a clean basket, brass pulls, the re-shoot's small cup.
//   fixed        round 2's dusk room, the reference.
//   faithful     `fixed` itself: nine-tile detail pass, then local fixes (case, speaker, baskets, rugs, table).
//   reshoot      a one-pass "re-photograph this exact room" edit of `fixed`, then the same loop; camel blanket.
//   reshoot-oat  a second re-shoot with an oatmeal blanket.
// Every candidate is grade-locked to `fixed` (low-frequency Lab correction; mean Delta E under 5 outside the
// blanket, whose color changed on purpose) and reviewed for fidelity, realism, coziness, and invitation.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tvs from "~/img/prototype-living-room/rooms188/r4.json"
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

const FILES = import.meta.glob("/app/img/prototype-living-room/rooms188/r4-*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>
import r5Room from "~/img/prototype-living-room/rooms188/r5-A.webp"
const R5 = r5Room
const TVS = tvs as Record<string, Room3["tv"]>

const ROOMS: Record<string, { name: string; alt: string }> = {
	round5: { name: "Round 5: faithful, owner notes applied", alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, Blu-rays and a film camera on the shelves" },
	fixed: { name: "Fixed (round 2, the reference)", alt: "A living room at dusk with a rust sofa, a paper lantern, and a teal wall" },
	faithful: { name: "Faithful: fixed, cleaned", alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, and a warm knit blanket" },
	reshoot: { name: "Re-shoot, camel blanket", alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, and a camel knit blanket" },
	"reshoot-oat": { name: "Re-shoot, oatmeal blanket", alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, and an oatmeal knit blanket" },
}
const FILE_OF: Record<string, string> = { round5: "A5", faithful: "A", reshoot: "B4", "reshoot-oat": "B3" }

const roomOf = (k: string): Room3 | null => {
	const src = k === "fixed" ? fixedR2 : (k === "round5" ? R5 : FILES[`/app/img/prototype-living-room/rooms188/r4-${FILE_OF[k]}.webp`])
	if (!src) return null
	const tv = k === "fixed" ? (tvs2 as Record<string, Room3["tv"]>).fixed : (k === "round5" ? TVS.A : TVS[FILE_OF[k]])
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
export const meta = () => [{ title: "Living room prototype: the room, round 4 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function LivingRoomRoom4() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params, setParams] = useSearchParams()
	const ready = Object.keys(ROOMS).filter((k) => roomOf(k))
	const key = ready.includes(params.get("variant") ?? "") ? (params.get("variant") as string) : "round5"
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
