import { presentCatalogLoader } from "~/server/media-payload.server"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
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
import { TasteQuizPage } from "~/ui/taste-quiz/TasteQuizPage"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "Taste Quiz - GoodWatch",
		description:
			"Rate movies and shows to get instant personalized recommendations. Discover what to watch next based on your unique taste.",
		url: "https://goodwatch.app/taste/quiz",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Build your taste profile on GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
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

export default function TasteQuizRoute() {
	const { isLoggedIn, smartTitles } = useLoaderData<LoaderData>()
	const [params] = useSearchParams()
	return (
		<>
			<ImdbImportEntry member={isLoggedIn} />
			<TasteQuizPage
				titles={smartTitles}
				member={isLoggedIn}
				showPicks={params.get("show") === "picks"}
			/>
		</>
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
