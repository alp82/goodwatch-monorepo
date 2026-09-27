// PROTOTYPE - throwaway. Start page as a cozy living room (#178): a big TV, a remote in the foreground, and
// channels that each show one thing GoodWatch does (tonight's pick, taste matches, scores, fingerprint,
// where to watch, search). Three variants on one route:
//   /prototype/start-living-room?variant=room|lean-in|couch[&country=DE]
// On the remote or keyboard: up and down change the channel, 1 to 6 jump, G opens the guide. In lean-in,
// L leans in and back. Left and right stay with the variant switcher. Swipe the screen sideways to zap.
// Real data, read-only: the curated lineup, your recommendations when signed in, four canned searches.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { getLivingRoom, type LRData } from "~/server/prototype-start-living-room.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"
import { CouchVariant, LeanInVariant, RoomVariant } from "~/ui/prototype-start-living-room/variants"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getLivingRoom(request))
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap" },
]
export const meta = () => [{ title: "Living room start page prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const VARIANTS = {
	room: { name: "The room (existing look)", C: RoomVariant },
	"lean-in": { name: "Lean in, live guide (bolder)", C: LeanInVariant },
	couch: { name: "Couch, scroll to zap (existing look)", C: CouchVariant },
} as const

export default function LivingRoomPrototype() {
	const data = useLoaderData<typeof loader>() as unknown as LRData
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "room") as keyof typeof VARIANTS
	const V = VARIANTS[key] ?? VARIANTS.room
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<V.C key={key} data={data} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
		</>
	)
}
