// My movies (#385): the page for choosing a movie. It is the Watch next page for the Wishlist's movies, with "How
// long?" as a fourth choice and one group for what does not fit tonight. For members, behind REC_TRACKING; it reads
// /api/watch-next with `kind=movie`, so it needs REC_WATCH_NEXT too. Anyone else is sent to Watch next, which is
// what they have today (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { lineOf } from "~/domain/newly-available"
import type { LandedLine } from "~/domain/newly-available-signal"
import { isEnabled } from "~/server/features.server"
import { getNewlyAvailable } from "~/server/newly-available.server"
import { getViewerContext } from "~/server/viewer.server"
import { type WatchNext, getWatchNext } from "~/server/watch-next.server"
import { MyMoviesPage } from "~/ui/my-movies/MyMoviesPage"
import { apiQuery, pageChoiceOf } from "~/ui/watch-next/useWatchNext"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "My movies | GoodWatch" },
	{
		name: "description",
		content:
			"The movies you want to see, for tonight: sorted your way, narrowed by mood, your streaming services and the time you have.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

// The sort, moods, services and time change the URL, not the page: the browser reads /api/watch-next for them.
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
	const url = new URL(request.url)
	if (!isEnabled("watchNext", { userId }))
		throw new Response("Not found", { status: 404 })
	// A guest, and a member the flag hides tracking from, have Watch next.
	if (!userId || !isEnabled("tracking", { userId }))
		return redirect(`/watch-next${url.search}`, {
			headers: { ...headers, Vary: "Cookie" },
		})
	const choice = pageChoiceOf(url.searchParams, true)
	const query = apiQuery(choice)
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		// What landed on the member's services (#456) is read here and never written: a prefetch of this page is not
		// a visit. The page stores the visit once it is on screen (useMyMoviesVisit).
		const [data, landed] = await Promise.all([
			getWatchNext(ctx, { ...choice, kind: "movie" }),
			getNewlyAvailable(ctx)
				.then((news) => lineOf(news.movies))
				// The line above the movies is an addition: without it the page is still the member's movies.
				.catch((error) => {
					console.error("My movies: reading what landed failed:", error)
					return null
				}),
		])
		return json({ query, data: data as WatchNext | null, landed }, { headers })
	} catch (error) {
		// The page asks /api/watch-next again from the browser.
		console.error("My movies: the first view failed", error)
		return json(
			{ query, data: null as WatchNext | null, landed: null },
			{ headers },
		)
	}
}

export default function MyMoviesRoute() {
	const { landed, ...initial } = useLoaderData<typeof loader>() as {
		query: string
		data: WatchNext | null
		landed: LandedLine | null
	}
	return <MyMoviesPage initial={initial} landed={landed} />
}
