// Watch › Up next's lists: /watch/shows/watching, /not-started (Start), /on-hold, /dropped, shows only. /watch/seen is the Seen tab,
// every title you watched; the layout's SubNav picks the kind (`?type=`). Another slug is not found. A guest is asked
// to sign up. The status lists are Up next's All shows, with the status filter first in the list's controls.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useLocation,
	useParams,
} from "@remix-run/react"
import { WATCH_SHOW_LISTS } from "~/domain/member-paths"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"
import { StatusFilter } from "~/ui/watch/StatusFilter"
import { useWatchCounts } from "~/ui/watch/useWatchCounts"
import { statusViews, upNextViews } from "~/ui/watch/watch-views"

export { pageHeaders as headers } from "~/utils/headers"

const NAME: Record<string, string> = {
	watching: "Watching",
	"not-started": "Start",
	"on-hold": "On hold",
	dropped: "Dropped",
	seen: "Seen shows",
}

export const meta: MetaFunction = ({ params, data }) => [
	{
		title: `${(data as LibraryListLoaded | undefined)?.status === "seen" && !(data as LibraryListLoaded).kind ? "Seen" : (NAME[params.list ?? ""] ?? "My shows")} | GoodWatch`,
	},
	{
		name: "description",
		content:
			"Your shows: the ones to start, the ones you are watching, and every show you watched.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

// The sort and the search change the URL, not the page: the browser reads /api/my-library for them.
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
	if (!Object.prototype.hasOwnProperty.call(WATCH_SHOW_LISTS, slug))
		throw new Response("Not found", { status: 404 })
	return libraryListLoader(args, WATCH_SHOW_LISTS[slug])
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export default function WatchShowList() {
	const loaded = useLoaderData<typeof loader>() as LibraryListLoaded
	const { list } = useParams()
	const { pathname } = useLocation()
	const counts = useWatchCounts()
	const seen = loaded.status === "seen" && !loaded.kind
	const views = upNextViews(pathname, counts)
	return (
		<LibraryListBody
			loaded={loaded}
			kindControl={!seen}
			filter={views ? <StatusFilter statuses={statusViews(views)} /> : null}
			name={seen ? "Seen" : (NAME[list ?? ""] ?? "Shows")}
			guest={
				seen
					? {
							title: "Sign up to keep a record of what you watched",
							detail:
								"Every movie and show you watched, latest first, with your scores, on every device.",
						}
					: {
							title: "Sign up to keep track of your shows",
							detail:
								"The shows you start, watch, set aside and finish, with every episode you mark, on every device.",
						}
			}
		/>
	)
}
