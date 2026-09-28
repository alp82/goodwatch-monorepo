// PROTOTYPE - throwaway. The phone edition of the TV screens (#224), round 2. See the top of
// ~/ui/prototype-start-living-room/phonetv1.tsx for what each variant tries.
//   /prototype/start-living-room-tv-phone?variant=type-scale|type-scale-rows|type-scale-narrow|small-canvas|type-scale-r1|focus-card|lean-in&as=guest|new|me&force=landscape
// Open it on a phone, or in a desktop browser's device mode (390 x 844, or 844 x 390 with force=landscape).
// The room is the mobile living room's `sideways` variant (#189): portrait couch, or the whole room sideways.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import handGraded from "~/img/prototype-living-room/rooms188/hand-graded.webp"
import roomPhone from "~/img/prototype-living-room/rooms188/r5-phone.webp"
import roomWide from "~/img/prototype-living-room/rooms188/r5-A.webp"
import { type HomeData, getHome } from "~/server/prototype-rec-home.server"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useHome } from "~/ui/prototype-rec-home/model"
import { type FlowT, useFlow } from "~/ui/prototype-start-living-room/flow1"
import { LivingRoomPhone, type PhoneRoom } from "~/ui/prototype-start-living-room/phone1"
import { PHONETV_VARIANTS, PhoneTvScreen, type PhoneTvVariant, phoneTvOpts, useLean } from "~/ui/prototype-start-living-room/phonetv1"
import type { TvSlot } from "~/ui/prototype-start-living-room/r3"
import type { Tv4 } from "~/ui/prototype-start-living-room/r4"

const WIDE: PhoneRoom = {
	src: roomWide,
	w: 1672,
	h: 941,
	tv: { x: 531, y: 90, w: 611, h: 330 },
	alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, Blu-rays and a film camera on the shelves",
}
const TALL: PhoneRoom = {
	src: roomPhone,
	w: 1068,
	h: 1602,
	tv: { x: 229, y: 90, w: 611, h: 330 },
	alt: "The living room at dusk seen from the sofa, a caramel knit blanket over your lap, the TV on the teal wall",
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
export const meta = () => [
	{ title: "Living room prototype: phone TV screens · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
	{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

const ORDER = Object.keys(PHONETV_VARIANTS) as PhoneTvVariant[]

export default function LivingRoomTvPhoneRoute() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params] = useSearchParams()
	const variant = (ORDER.includes(params.get("variant") as PhoneTvVariant) ? params.get("variant") : "type-scale") as PhoneTvVariant
	const force = params.get("force") === "landscape"
	return <Phone key={`${variant}:${home.audience}:${force}`} lr={lr} home={home} variant={variant} force={force} />
}

function Phone({ lr, home, variant, force }: { lr: LRData; home: HomeData; variant: PhoneTvVariant; force: boolean }) {
	const h = useHome(home)
	const [params, setParams] = useSearchParams()
	const tv: TvSlot = {
		use: (z, services) => {
			const f = useFlow(z, h, "ask", services)
			if (variant !== "lean-in") return f as unknown as Tv4
			// Hooks by variant: the route remounts on a variant change, so the order never changes within a mount.
			// biome-ignore lint/correctness/useHookAtTopLevel: see above
			const l = useLean(f)
			return { ...f, back: l.back, leaning: l.leaning } as unknown as Tv4
		},
		screen: (t) => <PhoneTvScreen t={t as unknown as FlowT} v={variant} />,
	}
	const flip = () => {
		const p = new URLSearchParams(params)
		if (force) p.delete("force")
		else p.set("force", "landscape")
		setParams(p, { replace: true })
	}
	return (
		<>
			<LivingRoomPhone variant="sideways" tall={TALL} wide={WIDE} handSrc={handGraded} tvSlot={tv} data={lr} force={force} opts={phoneTvOpts(variant)} />
			<div className="[&>div]:!z-[1002]">
				<PrototypeSwitcher
					variants={Object.fromEntries(ORDER.map((k) => [k, `${PHONETV_VARIANTS[k].name} (${PHONETV_VARIANTS[k].kind})`]))}
					position={force ? "bottom-2 left-2 scale-[0.55] origin-bottom-left max-w-[170vw]" : "top-2 left-1/2 -translate-x-1/2 scale-[0.62] origin-top max-w-[160vw]"}
				/>
			</div>
			<button type="button" onClick={flip} className="fixed right-2 top-2 z-[1003] rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black shadow-2xl ring-2 ring-fuchsia-500">
				{force ? "Portrait" : "Sideways"}
			</button>
		</>
	)
}
