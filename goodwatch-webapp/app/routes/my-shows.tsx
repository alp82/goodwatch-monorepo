import { presentCatalogLoader } from "~/server/media-payload.server"
// My shows (#385): a member's shows for tonight. A guest has no watch state, so they are asked to sign up
// (docs/implementation/tracking/my-library/README.md).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { Arrival } from "~/domain/new-episodes"
import type { LandedTitle } from "~/domain/newly-available-words"
import { type MyShows, getMyShows } from "~/server/my-shows.server"
import { getNewShows } from "~/server/new-episodes.server"
import { getRecentlyLanded } from "~/server/newly-available.server"
import { loadTaste } from "~/server/taste/index.server"
import { getViewerContext } from "~/server/viewer.server"
import { GuestPage } from "~/ui/my-pages/bits"
import { MyShowsPage } from "~/ui/my-shows/MyShowsPage"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "My shows | GoodWatch" },
	{
		name: "description",
		content:
			"Your shows for tonight: the next episode of each show you are watching, then the shows you want to start.",
	},
	// Personal to each viewer.
	{ name: "robots", content: "noindex, follow" },
]

const headers = { "Cache-Control": "private, no-store" }

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId)
		return json(
			{
				data: null as MyShows | null,
				now: 0,
				arrival: null as Arrival | null,
				landed: [] as LandedTitle[],
			},
			{ headers },
		)
	const ctx = await getViewerContext(request, undefined, userId)
	const now = Date.now()
	// What was new is read here and never written: a prefetch of this page is not a visit. The page records the
	// visit once it is on screen (useMyShowsVisit).
	const [data, fresh, landed] = await Promise.all([
		getMyShows(
			{
				userId,
				language: ctx.language,				country: ctx.country,
				services: ctx.services,
				taste: await loadTaste(ctx.viewer),
			},
			{ now },
		),
		// The line above the list is an addition: without it the page is still the member's shows.
		getNewShows(userId, { now }).catch((error) => {
			console.error("My shows: reading what is new failed:", error)
			return null
		}),
		// The shows that landed on the member's services in the last 14 days (#489): the row above the list, and
		// the mark on their rows. It does not depend on the visit.
		getRecentlyLanded(ctx, now)
			.then((recent) => recent.shows)
			.catch((error): LandedTitle[] => {
				console.error("My shows: reading what landed failed:", error)
				return []
			}),
	])
	const arrival: Arrival | null = fresh && {
		since: fresh.since,
		announcements: fresh.shows,
		titles: fresh.shows.map((show) => show.title),
	}
	return json(
		{ data: data as MyShows | null, now, arrival, landed },
		{ headers },
	)
}

export default function MyShowsRoute() {
	const { data, now, arrival, landed } = useLoaderData<typeof loader>() as {
		data: MyShows | null
		now: number
		arrival: Arrival | null
		landed: LandedTitle[]
	}
	if (!data)
		return (
			<GuestPage
				name="My shows"
				line="The next episode of each show you are watching, then the shows you want to start."
				words={{
					title: "Sign up to keep track of your shows",
					detail:
						"Mark the episodes you watched and pick up where you left off, on every device.",
				}}
			/>
		)
	return <MyShowsPage data={data} now={now} arrival={arrival} landed={landed} />
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true, hint: "show" })
