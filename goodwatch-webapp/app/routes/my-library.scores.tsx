// Your scores (My library): every title a member has scored, in one table with the ten scores beside each, to change
// them in place. Search, filters in Discover's design, a two-way sort on every column, groups, and changes to many
// titles at once. A guest is asked to sign up (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { ScoredTitle } from "~/domain/my-scores"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { getMyScores } from "~/server/my-scores.server"
import { GuestPage } from "~/ui/my-pages/bits"
import { MyScoresPage } from "~/ui/my-library/scores/MyScoresPage"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "My scores | My library | GoodWatch" },
	{
		name: "description",
		content: "Every title you have scored, with all ten scores beside it to change at once.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

// The page keeps the scores it changed itself; reading the list again would undo where rescored rows sit.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}) => (currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate)

const headers = { "Cache-Control": "private, no-store" }

type Loaded = { titles: ScoredTitle[] } | null

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId) return json<Loaded>(null, { headers })
	return json<Loaded>({ titles: await getMyScores(userId) }, { headers })
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

export default function MyScoresRoute() {
	const loaded = useLoaderData<typeof loader>() as Loaded
	if (!loaded)
		return (
			<GuestPage
				name="My scores"
				line="Every title you have scored, to change any score in place."
				words={{
					title: "Sign up to keep your scores",
					detail: "Rate titles and change any score later, from every device.",
				}}
			/>
		)
	return <MyScoresPage titles={loaded.titles} />
}
