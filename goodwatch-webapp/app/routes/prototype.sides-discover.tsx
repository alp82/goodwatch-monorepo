// PROTOTYPE - throwaway (#658, map #652). How Sides of you appear on Discover: a side filter, a row per side, side
// marks on cards, or side lanes (bolder), beside today's grid. Sides are #657's settled model; inside any grouping the
// list keeps Discover's order (personal order under Best match). ?variant=today|filter|rows|labels|lanes,
// ?as=owner|m1..m5 (members picked at runtime by rating count; "me" when signed in), ?names=1 shows side names (words
// gate, #656), ?places=1 shows each title's place in the whole list. Discover's filters work through the URL.
// Read-only: nothing is written.
import { type LoaderFunctionArgs, json, redirect } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { sidesDiscoverView } from "~/server/prototype-sides-discover/index.server"
import { SidesDiscoverPage } from "~/ui/prototype-sides-discover/page"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const url = new URL(request.url)
	// Best match by default: the order personal order decides.
	if (!url.searchParams.has("sort")) {
		url.searchParams.set("sort", "match")
		return redirect(`${url.pathname}?${url.searchParams}`)
	}
	const view = await sidesDiscoverView(request, url.searchParams.get("as"))
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

// The variant, the names and places toggles, and the chosen side need no new data.
const VIEW_ONLY = new Set(["variant", "names", "places", "side"])
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) => {
	if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate
	const strip = (u: URL) => {
		const p = new URLSearchParams(u.search)
		for (const key of VIEW_ONLY) p.delete(key)
		p.sort()
		return p.toString()
	}
	return strip(currentUrl) !== strip(nextUrl)
}

export const meta = () => [
	{ title: "Sides of you on Discover, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SidesDiscoverPrototype() {
	const { view } = useLoaderData<typeof loader>()
	return <SidesDiscoverPage view={view as never} />
}
