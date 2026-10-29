// Watch › Up next's lists: /watch/not-started, /watching, /on-hold, /dropped (the chips under To watch) and
// /watch/seen (Seen shows, latest watch first). Shows only. Another slug is not found. A guest is asked to sign up.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useParams,
} from "@remix-run/react"
import { WATCH_SHOW_LISTS } from "~/domain/member-paths"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"

export { pageHeaders as headers } from "~/utils/headers"

const NAME: Record<string, string> = {
	"not-started": "Not started",
	watching: "Watching",
	"on-hold": "On hold",
	dropped: "Dropped",
	seen: "Seen shows",
}

export const meta: MetaFunction = ({ params }) => [
	{ title: `${NAME[params.list ?? ""] ?? "My shows"} | GoodWatch` },
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
	return (
		<LibraryListBody
			loaded={loaded}
			name={NAME[list ?? ""] ?? "Shows"}
			guest={{
				title: "Sign up to keep track of your shows",
				detail:
					"The shows you start, watch, set aside and finish, with every episode you mark, on every device.",
			}}
		/>
	)
}
