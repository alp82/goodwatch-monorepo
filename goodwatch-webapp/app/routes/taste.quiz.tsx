import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react"
import ConnectedJourneyPrototype from "~/ui/taste/ConnectedJourneyPrototype"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { getSmartTitlesForGuest, getSmartTitlesForUser } from "~/server/smart-titles.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import TasteQuiz from "~/ui/taste/TasteQuiz"
import type { ScoringMedia } from "~/ui/scoring/types"
import { getUserFromRequest } from "~/utils/auth"
import { getLocaleFromRequest } from "~/utils/locale"
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
	userId?: string
	smartTitles: ScoringMedia[]
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
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteQuizRoute() {
	const { isLoggedIn, userId, smartTitles } = useLoaderData<LoaderData>()
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()

	const handleSignUp = () => {
		navigate('/sign-up/?redirectTo=/taste/quiz')
	}

	if (process.env.NODE_ENV !== "production" && searchParams.get("prototype") === "journey") {
		return <ConnectedJourneyPrototype titles={smartTitles} />
	}

	return (
		<div className="relative">
			<TasteQuiz 
				availableTitles={smartTitles} 
				onSignUp={handleSignUp}
				isAuthenticated={isLoggedIn}
				userId={userId}
			/>
		</div>
	)
}
