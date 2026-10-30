// Watch movie list: Want to Watch. Unknown slugs are 404.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useParams,
} from "@remix-run/react"
import {
	WATCH_MOVIE_LISTS,
} from "~/domain/member-paths"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"

export { pageHeaders as headers } from "~/utils/headers"

const NAME: Record<string, string> = {
	want: "Want to Watch",
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
	if (!Object.prototype.hasOwnProperty.call(WATCH_MOVIE_LISTS, slug))
		throw new Response("Not found", { status: 404 })
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
