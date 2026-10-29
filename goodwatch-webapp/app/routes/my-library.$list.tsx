import { presentCatalogLoader } from "~/server/media-payload.server"
// A list of My library (#385): /my-library/want, /seen, /not-rated, /watching, /on-hold and /dropped, one status
// each, under the hub (/my-library). Another slug is not found. A guest is asked to sign up
// (docs/implementation/tracking/my-library/README.md).
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { STATUS_LABEL, statusOfSlug } from "~/domain/my-library"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { MyLibraryPage } from "~/ui/my-library/MyLibraryPage"
import { GuestPage } from "~/ui/my-pages/bits"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = ({ params }) => [
	{
		title: `${STATUS_LABEL[statusOfSlug(params.list) ?? "want"]} | My library | GoodWatch`,
	},
	{
		name: "description",
		content:
			"Every title you have marked: what you want to see, what you have seen, and the shows you are watching.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

// The status, sort, filter and search change the URL, not the page: the browser reads /api/my-library for them.
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
	const status = statusOfSlug(args.params.list)
	if (!status) throw new Response("Not found", { status: 404 })
	return libraryListLoader(args, { status })
}

export default function MyLibraryRoute() {
	const loaded = useLoaderData<typeof loader>() as LibraryListLoaded
	if (!loaded.page || !loaded.viewer)
		return (
			<GuestPage
				name="My library"
				line="What you want to see, what you have seen, and the shows you are watching, in one place."
				words={{
					title: "Sign up to keep everything you marked in one place",
					detail:
						"Your Wishlist, what you have seen and your scores come with you to every device.",
				}}
			/>
		)
	return (
		// A page of its own per status: going from Watching to On hold starts the list over.
		<MyLibraryPage
			key={loaded.status}
			status={loaded.status}
			initial={loaded.page}
			now={loaded.now}
			viewer={loaded.viewer}
		/>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
