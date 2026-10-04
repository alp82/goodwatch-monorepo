// Watch next: the top of the Wishlist under the person's chosen sort and moods, then the rest of the Wishlist in a
// stepped grid. Not found while REC_WATCH_NEXT hides it from the viewer.
// A member's first view is computed here; after that, and for guests (whose Wishlist lives in their browser), the
// page reads /api/watch-next as the sort, moods, and On my services change.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { isEnabled } from "~/server/features.server"
import { getViewerContext } from "~/server/viewer.server"
import { type WatchNext, getWatchNext } from "~/server/watch-next.server"
import gabaritoCss from "~/fonts/gabarito.css?url"
import { WatchNextPage } from "~/ui/watch-next/WatchNextPage"
import { apiQuery, choiceFromParams } from "~/ui/watch-next/useWatchNext"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Watch next | GoodWatch" },
	{
		name: "description",
		content:
			"The top of your Wishlist for tonight: sorted your way, narrowed by mood, on your streaming services.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: gabaritoCss },
]

// The sort, moods, and services change the URL, not the page: the browser reads /api/watch-next for them.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	currentUrl.pathname === nextUrl.pathname && !formMethod
		? false
		: defaultShouldRevalidate

const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("watchNext", { userId }))
		throw new Response("Not found", { status: 404 })
	const choice = choiceFromParams(new URL(request.url).searchParams)
	const query = apiQuery(choice)
	if (!userId)
		return json({ query, data: null as WatchNext | null }, { headers })
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		const data = await getWatchNext(ctx, choice)
		return json({ query, data: data as WatchNext | null }, { headers })
	} catch (error) {
		// The page asks /api/watch-next again from the browser.
		console.error("Watch next: the first view failed", error)
		return json({ query, data: null as WatchNext | null }, { headers })
	}
}

export default function WatchNextRoute() {
	const initial = useLoaderData<typeof loader>() as {
		query: string
		data: WatchNext | null
	}
	return <WatchNextPage initial={initial} />
}
