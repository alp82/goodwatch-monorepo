// My library (#385): every title a member has marked, one status at a time. Behind REC_TRACKING: not found while
// the flag hides tracking from the viewer. A guest is asked to sign up
// (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { libraryChoiceOf } from "~/domain/my-library"
import { isEnabled } from "~/server/features.server"
import { type LibraryPage, getLibraryPage } from "~/server/my-library.server"
import { MyLibraryPage } from "~/ui/my-library/MyLibraryPage"
import { GuestPage } from "~/ui/my-pages/GuestPage"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "My library | GoodWatch" },
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

type Loaded = { page: LibraryPage; now: number; viewer: string } | null

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("tracking", { userId }))
		throw new Response("Not found", { status: 404 })
	if (!userId) return json<Loaded>(null, { headers })
	const choice = libraryChoiceOf(new URL(request.url).searchParams)
	const page = await getLibraryPage(userId, choice)
	return json<Loaded>({ page, now: Date.now(), viewer: userId }, { headers })
}

export default function MyLibraryRoute() {
	const loaded = useLoaderData<typeof loader>() as Loaded
	if (!loaded)
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
		<MyLibraryPage
			initial={loaded.page}
			now={loaded.now}
			viewer={loaded.viewer}
		/>
	)
}
