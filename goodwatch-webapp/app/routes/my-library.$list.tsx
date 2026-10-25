import { presentCatalogLoader } from "~/server/media-payload.server"
// A list of My library (#385): /my-library/want, /seen, /not-rated, /watching, /on-hold and /dropped, one status
// each, under the hub (/my-library). Another slug is not found. A guest is asked to sign up
// (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import {
	type LibraryStatus,
	STATUS_LABEL,
	libraryChoiceOf,
	statusOfSlug,
} from "~/domain/my-library"
import {
	type LibraryPage,
	getLibraryPage,
	withRowServices,
} from "~/server/my-library.server"
import { newOnForLibrary } from "~/server/newly-available.server"
import { MyLibraryPage } from "~/ui/my-library/MyLibraryPage"
import { GuestPage } from "~/ui/my-pages/bits"
import { getUserIdFromRequest } from "~/utils/auth"

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

const headers = { "Cache-Control": "private, no-store" }

type Loaded = {
	status: LibraryStatus
	page: LibraryPage | null
	now: number
	viewer: string | null
}

async function canonicalLoader({ request, params }: LoaderFunctionArgs) {
	const status = statusOfSlug(params.list)
	if (!status) throw new Response("Not found", { status: 404 })
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId)
		return json<Loaded>(
			{ status, page: null, now: Date.now(), viewer: null },
			{ headers },
		)
	// The page names the status; a `status` left in the query doesn't count.
	const choice = {
		...libraryChoiceOf(new URL(request.url).searchParams),
		status,
	}
	const page = await withRowServices(
		await getLibraryPage(
			userId,
			choice,
			0,
			await newOnForLibrary(request, userId, choice.status),
		),
		request,
		userId,
	)
	return json<Loaded>(
		{ status, page, now: Date.now(), viewer: userId },
		{ headers },
	)
}

export default function MyLibraryRoute() {
	const loaded = useLoaderData<typeof loader>() as Loaded
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
