// PROTOTYPE - throwaway (#660, map #652). How Sides of you appear on Home, the Living room's TV home for members:
// four variants on the real room and Remote, fed by the better-sides engine the owner chose on #657 and the member's
// real home. ?variant=tiles|rows|tonight|channels, ?as=owner|m1..m5 (members picked at runtime by rating count; "me"
// when signed in), ?names=on shows the side names (the words gate, #656), ?fit=screen draws the TV's canvas over the
// whole window, ?bar=off hides the prototype bar. Read-only: nothing is written.
import { type LinksFunction, type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { sidesHomeView } from "~/server/prototype-sides-home/index.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import type { SidesHomeView } from "~/ui/prototype-sides-home/model"
import { SidesHomePage } from "~/ui/prototype-sides-home/page"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const view = await sidesHomeView(request, new URL(request.url).searchParams.get("as"))
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

// Only another member reads again; the variant, the names and the frame are the page's own.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("as") !== nextUrl.searchParams.get("as")

export const links: LinksFunction = () => [{ rel: "stylesheet", href: livingRoomCss }]

export const meta = () => [
	{ title: "Sides of you on Home, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SidesHomePrototype() {
	const { view } = useLoaderData<typeof loader>()
	return <SidesHomePage view={view as SidesHomeView | null} />
}
