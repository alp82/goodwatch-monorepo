// PROTOTYPE - throwaway. The living room background (#188), round 1: which room, and how it gets sharp enough.
//   /prototype/start-living-room-room?variant=native|ultrasharp|hifi|tiled|grain&room=teal|dusk|late|rain|clock&hand=raw|graded
// The image tool caps out at 1672 x 941, so every sharper room is derived from that size:
//   native      the 1672 x 941 generation as it is today.
//   ultrasharp  4x upscale with the 4x-UltraSharp model (Real-ESRGAN runner), resized to 2560 wide.
//   hifi        4x upscale with Upscayl's high-fidelity model, resized to 2560 wide (softer, fewer artifacts).
//   tiled       the photo cut into four overlapping quarters, each re-rendered by the image tool at full size
//               and stitched back (about 3100 wide); only the teal room has it.
//   grain       `hifi` plus a static film grain and vignette drawn at screen resolution, to hide the softness.
// `room` swaps the light of the same room (same camera, same TV rectangle): teal (moonlight, today's teal-a),
// dusk, late, rain, and `clock`, which picks by the visitor's local time. `hand` swaps the hand photo for one
// graded to the room's light. The panel in the corner shows how many screen pixels each image pixel covers.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import tealA from "~/img/prototype-living-room/room-teal-a.webp"
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

// Every file in rooms188 is `<room>-<quality>.webp` (or hand-graded.webp); missing ones fall back to native.
const FILES = import.meta.glob("/app/img/prototype-living-room/rooms188/*.{webp,png}", { eager: true, query: "?url", import: "default" }) as Record<string, string>
const file = (name: string) => FILES[`/app/img/prototype-living-room/rooms188/${name}`]

const QUALITIES = { native: "Native 1672 px", ultrasharp: "UltraSharp upscale, 2560 px", hifi: "High-fidelity upscale, 2560 px", tiled: "Tiled re-render", grain: "High-fidelity + grain" } as const
type Quality = keyof typeof QUALITIES
const ROOMS = { teal: "Moonlight (teal-a)", dusk: "Dusk", late: "Late night", rain: "Rain", clock: "By your clock" } as const
type RoomKey = keyof typeof ROOMS

function clockRoom(h: number): Exclude<RoomKey, "clock"> {
	if (h >= 17 && h < 20) return "dusk"
	if (h >= 23 || h < 5) return "late"
	return "teal"
}

function roomSrc(room: Exclude<RoomKey, "clock">, q: Quality) {
	const native = room === "teal" ? tealA : file(`${room}-native.webp`)
	const want = q === "grain" ? "hifi" : q
	if (want === "native") return { src: native, used: "native" }
	const up = file(`${room}-${want}.webp`)
	return up ? { src: up, used: want } : { src: native, used: "native (no render yet)" }
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
export const meta = () => [{ title: "Living room prototype: the room · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Only the audience needs the loader; room, quality, and hand are client-side.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export default function LivingRoomRoom() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params] = useSearchParams()
	const q = ((params.get("variant") ?? "") in QUALITIES ? params.get("variant") : "native") as Quality
	const roomKey = ((params.get("room") ?? "") in ROOMS ? params.get("room") : "teal") as RoomKey
	const graded = params.get("hand") === "graded"
	const [hour, setHour] = useState(21)
	useEffect(() => setHour(new Date().getHours()), [])
	const resolved = roomKey === "clock" ? clockRoom(hour) : roomKey
	const { src, used } = roomSrc(resolved, q)
	const room: Room3 = {
		name: ROOMS[resolved],
		src,
		// Logical coordinates stay the native ones: the image fills the frame at any pixel size.
		w: 1672,
		h: 941,
		tv: { x: 529, y: 90, w: 614, h: 333 },
		alt: "Moonlight through a window and a warm paper lantern, a knitted blanket and one cup",
	}
	const h = useHome(home)
	const tv: TvSlot = {
		use: (z, services) => useFlow(z, h, "ask", services) as unknown as Tv4,
		screen: (t) => <FlowScreen t={t as unknown as FlowT} />,
	}
	const grain = q === "grain" ? file("grain.png") : undefined
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3
				data={lr}
				room={room}
				pose="hand"
				round4
				tvSlot={tv}
				remote={(p) => <Remote7 layout="grid" {...p} />}
				handSrc={graded ? file("hand-graded.webp") : undefined}
				roomOverlay={
					grain && (
						<>
							<div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 70% at 50% 40%, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />
							<div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `url("${grain}")`, backgroundSize: "128px 128px" }} />
						</>
					)
				}
			/>
			<style dangerouslySetInnerHTML={{ __html: `${LR5_CSS} ${LR6_CSS}` }} />
			<PrototypeSwitcher variants={QUALITIES} position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top" />
			<RoomBar roomKey={roomKey} resolved={resolved} graded={graded} used={used} alt={room.alt} />
		</>
	)
}

function RoomBar({ roomKey, resolved, graded, used, alt }: { roomKey: RoomKey; resolved: string; graded: boolean; used: string; alt: string }) {
	const [params, setParams] = useSearchParams()
	const set = (k: string, v: string) => {
		const p = new URLSearchParams(params)
		p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const stats = useImageStats(alt)
	const chip = (on: boolean) => `rounded-full px-2.5 py-1 ${on ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"}`
	return (
		<div className="fixed left-4 top-[4.75rem] z-[60] w-[300px] space-y-2 rounded-xl bg-black/80 p-3 text-xs text-white shadow-xl ring-1 ring-white/15">
			<div className="flex flex-wrap gap-1">
				{(Object.keys(ROOMS) as RoomKey[]).map((k) => (
					<button key={k} type="button" className={chip(k === roomKey)} onClick={() => set("room", k)}>
						{ROOMS[k]}
					</button>
				))}
			</div>
			<div className="flex gap-1">
				<button type="button" className={chip(!graded)} onClick={() => set("hand", "raw")}>
					Hand as is
				</button>
				<button type="button" className={chip(graded)} onClick={() => set("hand", "graded")}>
					Hand graded to the room
				</button>
			</div>
			<div className="font-mono leading-5 text-white/70">
				<div>room: {resolved}{roomKey === "clock" ? " (from your clock)" : ""}</div>
				<div>image: {used}</div>
				{stats && (
					<>
						<div>
							size: {stats.nw} x {stats.nh}, {stats.kb ? `${stats.kb} KB` : "? KB"}
						</div>
						<div className={stats.ratio > 1.25 ? "text-amber-300" : "text-emerald-300"}>
							1 image px = {stats.ratio.toFixed(2)} device px {stats.ratio > 1.25 ? "(soft)" : "(sharp)"}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

// How many device pixels each image pixel covers right now: above ~1.25 the room looks soft.
function useImageStats(alt: string) {
	const [s, setS] = useState<{ nw: number; nh: number; ratio: number; kb: number } | null>(null)
	useEffect(() => {
		const read = () => {
			const imgs = [...document.querySelectorAll<HTMLImageElement>(`img[alt="${alt}"]`)]
			const img = imgs[imgs.length - 1]
			if (!img?.naturalWidth) return
			const entry = performance.getEntriesByName(img.currentSrc)[0] as PerformanceResourceTiming | undefined
			const kb = entry ? Math.round((entry.encodedBodySize || entry.transferSize) / 1024) : 0
			setS({ nw: img.naturalWidth, nh: img.naturalHeight, ratio: (img.getBoundingClientRect().width * devicePixelRatio) / img.naturalWidth, kb })
		}
		const id = window.setInterval(read, 800)
		read()
		return () => window.clearInterval(id)
	}, [alt])
	return s
}
