// My library's hub: one tile per page under it (Your scores, Want to see, Seen, Shows in progress, Not rated, then
// lists, imports and hidden titles), each showing what is inside now. An old link that named a list with `?status=`
// goes to that list's page. A guest is asked to sign up (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { pageOfOldLink } from "~/domain/my-library"
import { type LibraryHub, getLibraryHub } from "~/server/my-library-hub.server"
import { LibraryHubPage } from "~/ui/my-library/hub/LibraryHubPage"
import { GuestPage } from "~/ui/my-pages/bits"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "My library | GoodWatch" },
	{
		name: "description",
		content:
			"Everything you have marked, rated and brought in: what you want to see, what you have seen, your scores and the shows you are watching.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	const old = pageOfOldLink(new URL(request.url).searchParams)
	if (old) return redirect(old, { status: 301, headers })
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId) return json<LibraryHub | null>(null, { headers })
	return json<LibraryHub | null>(await getLibraryHub(userId), { headers })
}

export default function MyLibraryHubRoute() {
	const hub = useLoaderData<typeof loader>() as LibraryHub | null
	if (!hub)
		return (
			<GuestPage
				name="My library"
				line="What you want to see, what you have seen, your scores and the shows you are watching, in one place."
				words={{
					title: "Sign up to keep everything you marked in one place",
					detail:
						"Your Wishlist, what you have seen and your scores come with you to every device.",
				}}
			/>
		)
	return <LibraryHubPage hub={hub} />
}
