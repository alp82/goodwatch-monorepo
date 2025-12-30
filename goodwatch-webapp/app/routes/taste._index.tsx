import type {
	HeadersFunction,
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { json, redirect } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import { prefetchUserSettings } from "~/server/user-settings.server"
import { prefetchUserData, getUserData } from "~/server/userData.server"
import TasteProfile from "~/ui/taste/TasteProfile"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export const headers: HeadersFunction = () => {
	return {
		"Cache-Control":
			"max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = () => {
	const pageMeta: PageMeta = {
		title: "Your Taste Profile - GoodWatch",
		description:
			"View your complete taste profile with personalized insights about your movie and TV preferences.",
		url: "https://goodwatch.app/taste",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Your taste profile on GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

type LoaderData = {
	userId: string
	ratingsCount: number
	dehydratedState: DehydratedState
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	
	if (!user) {
		return redirect("/taste/quiz")
	}

	const queryClient = new QueryClient()
	await Promise.all([
		prefetchUserData({ queryClient, request }),
		prefetchUserSettings({ queryClient, request }),
	])

	const userData = await getUserData({ user_id: user.id })
	const ratingsCount = userData ? Object.keys(userData.scores).length : 0

	return json<LoaderData>({
		userId: user.id,
		ratingsCount,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteProfileRoute() {
	const { userId, ratingsCount } = useLoaderData<LoaderData>()

	return (
		<div className="relative">
			<TasteProfile 
				userId={userId}
				ratingsCount={ratingsCount}
			/>
		</div>
	)
}
