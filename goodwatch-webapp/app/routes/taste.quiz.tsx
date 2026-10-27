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
import { ImdbImportEntry } from "~/ui/imports/ImdbImportEntry"
import type { ScoringMedia } from "~/ui/scoring/types"
import { type FlowView, viewOf } from "~/ui/rating-flow/flow"
import { RatingFlow } from "~/ui/rating-flow/RatingFlow"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

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

	// Personal: a guest's server HTML is an empty shell, the page fills from the browser.
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
	const isLoggedIn = !!user

	const { locale } = getLocaleFromRequest(request)

	const smartTitles = user
		? await getSmartTitlesForUser({
				userId: user.id,
				count: 300,
				locale,
			})
		: await getSmartTitlesForGuest({
				count: 300,
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

/** The rating flow. `?view=taste` opens its taste view, where sign-up from "Save your taste" returns. */
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
	return (
		<>
			<ImdbImportEntry member={isLoggedIn} />
			<RatingFlow
				titles={smartTitles}
				member={isLoggedIn}
				view={view}
				onView={onView}
			/>
		</>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
