// Scores › Not rated: /u/:handle/scores/not-rated. What the owner has seen without a score, to rate it in place. Only the
// owner has this page; anyone else goes to Scores.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { moveResponse, tastePath } from "~/domain/member-paths"
import {
	type LibraryListLoaded,
	libraryListLoader,
} from "~/server/library-list-route.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileShell } from "~/server/profile/page.server"
import { LibraryListBody } from "~/ui/my-library/MyLibraryPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = ({ params }) => [
	{ title: `Not rated · @${params.handle} · GoodWatch` },
	// Personal: only the owner sees it.
	{ name: "robots", content: "noindex, nofollow" },
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
	const loaded = await loadProfileShell(args.request, args.params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const { shell } = loaded
	if (shell.viewer !== "owner") {
		const visitor = new URL(args.request.url).searchParams.get("as")
		throw moveResponse({
			to: tastePath(shell.handle, "scores", { as: visitor }),
			status: 302,
			private: true,
		})
	}
	return libraryListLoader(args, { status: "unrated" })
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export default function ProfileNotRated() {
	const loaded = useLoaderData<typeof loader>() as LibraryListLoaded
	return (
		<LibraryListBody
			loaded={loaded}
			name="Not rated"
			guest={{
				title: "Sign up to keep your scores",
				detail: "Rate titles and change any score later, from every device.",
			}}
		/>
	)
}
