import { presentCatalogLoader } from "~/server/media-payload.server"
// My movies (#385): the page for choosing a movie. It is the Watch next page for the Wishlist's movies, with "How
// long?" as a fourth choice and one group for what does not fit tonight. For members; it reads /api/watch-next with
// `kind=movie`. A guest is sent to Watch next (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { LandedTitle } from "~/domain/newly-available-words"
import { getRecentlyLanded } from "~/server/newly-available.server"
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

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	const url = new URL(request.url)
	// A guest has Watch next.
	if (!userId)
		return redirect(`/watch-next${url.search}`, {
			headers: { ...headers, Vary: "Cookie" },
		})
	const choice = pageChoiceOf(url.searchParams, true)
	const query = apiQuery(choice)
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		// The movies that landed on the member's services in the last 14 days (#489), for the row above the movies and
		// the mark on their posters. Nothing is written here: the page stores the visit that clears the signal (#456)
		// once it is on screen (useMyMoviesVisit), and the row does not depend on it.
		const [data, landed] = await Promise.all([
			getWatchNext(ctx, { ...choice, kind: "movie" }),
			getRecentlyLanded(ctx)
				.then((recent) => recent.movies)
				// The row is an addition: without it the page is still the member's movies.
				.catch((error): LandedTitle[] => {
					console.error("My movies: reading what landed failed:", error)
					return []
				}),
		])
		return json({ query, data: data as WatchNext | null, landed }, { headers })
	} catch (error) {
		// The page asks /api/watch-next again from the browser.
		console.error("My movies: the first view failed", error)
		return json(
			{ query, data: null as WatchNext | null, landed: [] as LandedTitle[] },
			{ headers },
		)
	}
}

export default function MyMoviesRoute() {
	const { landed, ...initial } = useLoaderData<typeof loader>() as {
		query: string
		data: WatchNext | null
		landed: LandedTitle[]
	}
	return <MyMoviesPage initial={initial} landed={landed} />
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
