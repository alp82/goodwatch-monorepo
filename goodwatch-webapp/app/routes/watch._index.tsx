// Watch › Up next › Next episodes (/watch, once My shows, #385): a member's shows for tonight. A guest has no watch state: their page is the Wishlist's shows to
// start, read from their browser, under a sign-up card for tracking (ui/my-shows/GuestMyShows.tsx).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { Arrival } from "~/domain/new-episodes"
import type { LandedTitle } from "~/domain/newly-available-words"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { type MyShows, getMyShows } from "~/server/my-shows.server"
import { getNewShows } from "~/server/new-episodes.server"
import { getRecentlyLanded } from "~/server/newly-available.server"
import { type RowServices, ownServicesOf } from "~/server/row-services.server"
import { loadTaste } from "~/server/taste/index.server"
import { getViewerContext } from "~/server/viewer.server"
import { GuestMyShows } from "~/ui/my-shows/GuestMyShows"
import { MyShowsPage } from "~/ui/my-shows/MyShowsPage"
import { getUserIdFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Up next | GoodWatch" },
	{
		name: "description",
		content:
			"Your shows to watch next: the next episode of each show you are watching, then the shows you want to start.",
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
				services: {} as RowServices,
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
				language: ctx.language,
				country: ctx.country,
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
	// The member's own services per show, for the logos in the rows.
	const services = await ownServicesOf(
		ctx,
		[
			...data.continue,
			...data.pickUp,
			...data.start,
			...data.onHold,
			...data.dropped,
		].map((show) => ({ mediaType: "show" as const, tmdbId: show.id })),
	)
	const arrival: Arrival | null = fresh && {
		since: fresh.since,
		announcements: fresh.shows,
		titles: fresh.shows.map((show) => show.title),
	}
	return json(
		{ data: data as MyShows | null, now, arrival, landed, services },
		{ headers },
	)
}

export default function MyShowsRoute() {
	const { data, now, arrival, landed, services } = useLoaderData<
		typeof loader
	>() as {
		data: MyShows | null
		now: number
		arrival: Arrival | null
		landed: LandedTitle[]
		services: RowServices
	}
	if (!data) return <GuestMyShows />
	return (
		<MyShowsPage
			data={data}
			now={now}
			arrival={arrival}
			landed={landed}
			services={services}
		/>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, {
	live: true,
	hint: "show",
})
