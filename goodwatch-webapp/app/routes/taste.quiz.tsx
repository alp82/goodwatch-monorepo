import {
	getInterestDiscovery,
	type DiscoveryResult,
} from "~/server/interest-discovery.server"
import { getUserData } from "~/server/userData.server"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import {
	getSmartTitlesForGuest,
	getSmartTitlesForUser,
} from "~/server/smart-titles.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import TasteQuiz from "~/ui/taste/TasteQuiz"
import type { ScoringMedia } from "~/ui/scoring/types"
import { getUserFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { GuestShareListEntry } from "~/ui/share-lists/ShareTopFiveCard"

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
	userId?: string
	smartTitles: ScoringMedia[]
	discovery: DiscoveryResult
	dehydratedState: DehydratedState
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	const isLoggedIn = !!user

	const { locale } = getLocaleFromRequest(request)

	const smartTitles = isLoggedIn
		? await getSmartTitlesForUser({
				userId: user!.id,
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
		userId: user?.id,
		smartTitles,
		discovery: await getInterestDiscovery(
			user ? await getUserData({ user_id: user.id }) : undefined,
		),
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteQuizRoute() {
	const { isLoggedIn, userId, smartTitles } = useLoaderData<LoaderData>()
	const navigate = useNavigate()

	const handleSignUp = () => {
		navigate("/sign-up/?redirectTo=/taste/quiz")
	}

	return (
		<div className="relative">
			{!isLoggedIn && (
				<div className="px-4">
					<GuestShareListEntry />
				</div>
			)}
			<TasteQuiz
				availableTitles={smartTitles}
				onSignUp={handleSignUp}
				isAuthenticated={isLoggedIn}
				userId={userId}
			/>
		</div>
	)
}
