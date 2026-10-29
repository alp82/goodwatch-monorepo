import { member, oldToNew, moveResponse } from "~/domain/member-paths"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { useCallback } from "react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import {
	getSmartTitlesForGuest,
	getSmartTitlesForUser,
} from "~/server/smart-titles.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import { type FlowView, viewOf } from "~/ui/rating-flow/flow"
import { RatingFlow } from "~/ui/rating-flow/RatingFlow"
import { ModeSwitch } from "~/ui/quick-list/parts"
import { QuickList } from "~/ui/quick-list/QuickList"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"

export const handle = START_AFTER_PAINT

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "Rate titles - GoodWatch",
		description:
			"Rate movies and shows to get instant personalized recommendations. Discover what to watch next based on your unique taste.",
		url: "https://goodwatch.app/taste/quiz",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Build your taste profile on GoodWatch",
	}

	// Personal rating flow, kept out of search results. The first title is server-rendered.
	return buildMeta({ pageMeta, items: [], robots: "noindex, follow" })
}

type LoaderData = {
	isLoggedIn: boolean
	smartTitles: ScoringMedia[]
	dehydratedState: DehydratedState
}

const canonicalLoader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	if (user) {
		const profile = await getCachedProfileByUserId(user.id)
		const url = new URL(request.url)
		const move = oldToNew(
			url.pathname,
			url.search,
			member(profile?.handle ?? null),
		)
		if (move) return moveResponse(move)
	}
	const isLoggedIn = !!user

	const { locale } = getLocaleFromRequest(request)

	// Quick list renders a table; one-at-a-time needs only a short queue and fetches more near its end.
	const count =
		new URL(request.url).searchParams.get("mode") === "quick" ? 300 : 20
	const smartTitles = user
		? await getSmartTitlesForUser({
				userId: user.id,
				count,
				locale,
			})
		: await getSmartTitlesForGuest({
				count,
				locale,
				ratingsCount: 0,
			})

	const queryClient = new QueryClient()
	if (isLoggedIn) {
		await prefetchUserSettings({ queryClient, request })
	}

	return json<LoaderData>({
		isLoggedIn,
		smartTitles,
		dehydratedState: dehydrate(queryClient),
	})
}

/**
 * The rating flow. `?view=taste` opens its taste view, where sign-up from "Save your taste" returns. `?mode=quick` is
 * its Quick list mode: the titles in a table, many answered in a row. One at a time stays the default.
 */
export default function TasteQuizRoute() {
	const { isLoggedIn, smartTitles } = useLoaderData<LoaderData>()
	const [params, setParams] = useSearchParams()
	const view = viewOf(params)
	// Each view is its own history entry, so Back from the taste view returns to rating. Other parameters (the old
	// quiz's `?resume=1` and `?show=picks`) go.
	const onView = useCallback(
		(next: FlowView) =>
			setParams(next === "taste" ? { view: "taste" } : {}, {
				preventScrollReset: true,
			}),
		[setParams],
	)
	if (view === "rate" && params.get("mode") === "quick")
		return <QuickList titles={smartTitles} member={isLoggedIn} />
	return (
		<RatingFlow
			titles={smartTitles}
			member={isLoggedIn}
			view={view}
			onView={onView}
			top={
				view === "rate" ? (
					<div className="mb-3">
						<ModeSwitch mode="one" />
					</div>
				) : undefined
			}
		/>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
