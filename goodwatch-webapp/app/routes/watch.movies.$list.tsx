// Watch › Ready to watch's lists: /watch/movies/wishlist (Want to Watch: the Wishlist's movies; its shows are Up
// next's Start) and /seen (Seen movies, latest watch first). Another slug is not found. A guest is asked to sign up.
// /seen goes to the Seen tab with Movies picked; /recent (once Recently added) goes to Want to Watch, newest first.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useParams,
} from "@remix-run/react"
import {
	WATCH_MOVIE_LISTS,
	moveResponse,
	recentMove,
} from "~/domain/member-paths"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"
import { moviesSeenMove } from "~/ui/watch/watch-views"

export { pageHeaders as headers } from "~/utils/headers"

const NAME: Record<string, string> = {
	wishlist: "Want to Watch",
	seen: "Seen movies",
}

export const meta: MetaFunction = ({ params }) => [
	{ title: `${NAME[params.list ?? ""] ?? "My movies"} | GoodWatch` },
	{
		name: "description",
		content:
			"Your movies: the ones you want to watch, and every movie you watched.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

// The sort, filter and search change the URL, not the page: the browser reads /api/my-library for them.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	currentUrl.pathname === nextUrl.pathname && !formMethod
		? false
		: defaultShouldRevalidate

async function canonicalLoader(args: LoaderFunctionArgs) {
	const slug = args.params.list ?? ""
	if (slug === "recent")
		throw moveResponse(recentMove(new URL(args.request.url).search))
	if (!Object.prototype.hasOwnProperty.call(WATCH_MOVIE_LISTS, slug))
		throw new Response("Not found", { status: 404 })
	if (slug === "seen")
		throw moveResponse({
			to: moviesSeenMove(new URL(args.request.url).search),
			status: 302,
			private: true,
		})
	return libraryListLoader(args, WATCH_MOVIE_LISTS[slug])
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export default function WatchMovieList() {
	const loaded = useLoaderData<typeof loader>() as LibraryListLoaded
	const { list } = useParams()
	return (
		<LibraryListBody
			loaded={loaded}
			name={NAME[list ?? ""] ?? "Movies"}
			guest={{
				title: "Sign up to keep your movies in one place",
				detail:
					"Your Wishlist and every movie you watched, with your scores, on every device.",
			}}
		/>
	)
}
