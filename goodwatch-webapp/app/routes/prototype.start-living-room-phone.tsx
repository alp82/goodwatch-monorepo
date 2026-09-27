// PROTOTYPE - throwaway. The mobile living room (#189), round 1. See the top of
// ~/ui/prototype-start-living-room/phone1.tsx for what each variant tries.
//   /prototype/start-living-room-phone?variant=couch|remote|touch|sideways&as=guest|new|me&force=landscape
// Open it on a phone, or in a desktop browser's device mode (390 x 844). The room is the locked round 5 room;
// the portrait variants use it extended down over the lap (`rooms188/r5-phone.webp`, 1300 x 1950, 115 KB).
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import handGraded from "~/img/prototype-living-room/rooms188/hand-graded.webp"
import roomPhone from "~/img/prototype-living-room/rooms188/r5-phone.webp"
import roomWide from "~/img/prototype-living-room/rooms188/r5-A.webp"
import { type HomeData, getHome } from "~/server/prototype-rec-home.server"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useHome } from "~/ui/prototype-rec-home/model"
import { FlowScreen, type FlowT, useFlow } from "~/ui/prototype-start-living-room/flow1"
import { LivingRoomPhone, PHONE_VARIANTS, type PhoneRoom, type PhoneVariant } from "~/ui/prototype-start-living-room/phone1"
import type { TvSlot } from "~/ui/prototype-start-living-room/r3"
import type { Tv4 } from "~/ui/prototype-start-living-room/r4"

const WIDE: PhoneRoom = {
	src: roomWide,
	w: 1672,
	h: 941,
	tv: { x: 531, y: 90, w: 611, h: 330 },
	alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, Blu-rays and a film camera on the shelves",
}
// The same room, cropped around the TV (x 302 to 1370 of 1672) and extended down over the lap under the blanket.
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
	{ title: "Living room prototype: phone · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
	{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

const ORDER = Object.keys(PHONE_VARIANTS) as PhoneVariant[]

export default function LivingRoomPhoneRoute() {
	const { lr, home } = useLoaderData<typeof loader>() as unknown as { lr: LRData; home: HomeData }
	const [params] = useSearchParams()
	const variant = (ORDER.includes(params.get("variant") as PhoneVariant) ? params.get("variant") : "couch") as PhoneVariant
	return <Phone key={`${variant}:${home.audience}`} lr={lr} home={home} variant={variant} force={params.get("force") === "landscape"} />
}

function Phone({ lr, home, variant, force }: { lr: LRData; home: HomeData; variant: PhoneVariant; force: boolean }) {
	const h = useHome(home)
	const tv: TvSlot = {
		use: (z, services) => useFlow(z, h, "ask", services) as unknown as Tv4,
		screen: (t) => <FlowScreen t={t as unknown as FlowT} />,
	}
	return (
		<>
			<LivingRoomPhone variant={variant} tall={TALL} wide={WIDE} handSrc={handGraded} tvSlot={tv} data={lr} force={force} />
			<div className="[&>div]:!z-[1002]">
				<PrototypeSwitcher
					variants={Object.fromEntries(ORDER.map((k) => [k, `${PHONE_VARIANTS[k].name} (${PHONE_VARIANTS[k].kind})`]))}
					position="top-2 left-1/2 -translate-x-1/2 scale-[0.62] origin-top max-w-[160vw]"
				/>
			</div>
		</>
	)
}
