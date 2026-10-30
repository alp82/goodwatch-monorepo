import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	libraryListLoader,
	type LibraryListLoaded,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"
export { pageHeaders as headers } from "~/utils/headers"
export { shouldRevalidate } from "./watch.shows.$list"
export const meta: MetaFunction = () => [
	{ title: "Seen | GoodWatch" },
	{
		name: "description",
		content: "Every movie and show you watched, with your scores.",
	},
	{ name: "robots", content: "noindex, follow" },
]
export const loader = presentCatalogLoader(
	(args: LoaderFunctionArgs) =>
		libraryListLoader(args, { status: "seen", kind: "all" }),
	{ live: true },
)
export default function Seen() {
	const loaded = useLoaderData<typeof loader>() as LibraryListLoaded
	return (
		<LibraryListBody
			loaded={loaded}
			kindControl={false}
			name="Seen"
			guest={{
				title: "Sign up to keep a record of what you watched",
				detail:
					"Every movie and show you watched, latest first, with your scores, on every device.",
			}}
		/>
	)
}
