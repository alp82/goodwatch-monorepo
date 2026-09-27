// PROTOTYPE - throwaway. Round 5 of the living room: the final Remote (#186). See the top of
// ~/ui/prototype-start-living-room/r5.tsx for the open points and what each design tries.
//   /prototype/start-living-room-5?variant=refined|softkeys|screenless|essentials|r4[&wheel=knurl|detent|touch]
//   /prototype/start-living-room-5?bench=1   all designs side by side, out of the hand, each with its own state
// The room is round 4's default (teal-a). Keyboard: up and down turn the wheel, Enter is OK, Escape is Back.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import tealA from "~/img/prototype-living-room/room-teal-a.webp"
import { getLivingRoom, type LRData, type LRServiceButton } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { LivingRoom3, type Room3, useApi } from "~/ui/prototype-start-living-room/r3"
import { useTv4 } from "~/ui/prototype-start-living-room/r4"
import { DESIGNS, type Design, FEELS, type Feel, LR5_CSS, Remote5 } from "~/ui/prototype-start-living-room/r5"
import { LR2_CSS } from "~/ui/prototype-start-living-room/remote2"
import { LR_CSS, useZapper } from "~/ui/prototype-start-living-room/tv"

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
	return json(await getLivingRoom(request))
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room prototype, round 5: the remote · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Switching designs must not re-run the loader (each run costs database queries).
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const ORDER: Design[] = ["refined", "softkeys", "screenless", "essentials", "r4"]

export default function LivingRoomRound5() {
	const data = useLoaderData<typeof loader>() as unknown as LRData
	const [params] = useSearchParams()
	const design = (ORDER.includes(params.get("variant") as Design) ? params.get("variant") : "refined") as Design
	const feel = (params.get("wheel") as Feel) in FEELS ? (params.get("wheel") as Feel) : undefined
	if (params.get("bench")) return <Bench data={data} feel={feel} />
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3 data={data} room={ROOM} pose="hand" round4 remote={(p) => <Remote5 design={design} feel={feel} {...p} />} />
			<style dangerouslySetInnerHTML={{ __html: LR5_CSS }} />
			<PrototypeSwitcher
				variants={Object.fromEntries(ORDER.map((k) => [k, DESIGNS[k].name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
			<WheelPicker design={design} feel={feel} />
		</>
	)
}

// The wheel's feel is its own choice: each design has a default, and this overrides it.
function WheelPicker({ design, feel }: { design: Design; feel?: Feel }) {
	const [params, setParams] = useSearchParams()
	const current = feel ?? DESIGNS[design].wheel
	const pick = (f: Feel) => {
		const p = new URLSearchParams(params)
		p.set("wheel", f)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return (
		<div className="fixed right-4 top-[4.5rem] z-50 flex flex-col gap-1 rounded-2xl bg-white/95 p-2 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500">
			<span className="px-2 pt-1 text-[10px] uppercase tracking-wider text-neutral-500">Wheel</span>
			{(Object.keys(FEELS) as Feel[]).map((f) => (
				<button key={f} type="button" onClick={() => pick(f)} className={`rounded-lg px-2 py-1 text-left ${f === current ? "bg-fuchsia-100 text-fuchsia-900" : "hover:bg-neutral-100"}`} title={FEELS[f]}>
					{f}
				</button>
			))}
		</div>
	)
}

// All designs next to each other at the same scale, out of the hand, each one working on its own.
function Bench({ data, feel }: { data: LRData; feel?: Feel }) {
	const { data: services } = useApi<LRServiceButton[]>({ op: "services" })
	return (
		<div className="min-h-screen bg-[#0d1113] px-6 pb-16 pt-24 text-white">
			<style dangerouslySetInnerHTML={{ __html: `${LR_CSS} ${LR2_CSS} .lr3-body { width: 312px; } ${LR5_CSS}` }} />
			<h1 className="mb-1 text-2xl font-bold">The remote, round 5</h1>
			<p className="mb-8 max-w-2xl text-sm text-white/60">Every design keeps the round 4 look. Each one works: press OK to turn it on, then try the wheel and keys. The screen and key states follow each remote's own TV, which isn't shown here.</p>
			<div className="flex flex-wrap items-start gap-x-10 gap-y-12">
				{ORDER.map((d) => (
					<BenchItem key={d} design={d} data={data} services={services ?? []} feel={feel} />
				))}
			</div>
		</div>
	)
}

function BenchItem({ design, data, services, feel }: { design: Design; data: LRData; services: LRServiceButton[]; feel?: Feel }) {
	const z = useZapper(0)
	const t = useTv4(z, data.country)
	return (
		<div className="w-[312px]">
			<div className="mb-1 text-sm font-bold">
				{DESIGNS[design].name} <span className="font-normal text-white/40">· {design}</span>
			</div>
			<p className="mb-4 min-h-[60px] text-xs text-white/60">{DESIGNS[design].idea}</p>
			<Remote5 design={design} feel={feel} z={z} t={t} services={services} pointing={false} grip={866} />
		</div>
	)
}
