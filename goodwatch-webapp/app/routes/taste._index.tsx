import type {
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
import TasteProfile from "~/ui/taste/TasteProfile"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

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
	await prefetchUserSettings({ queryClient, request })

	return json<LoaderData>({
		userId: user.id,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteProfileRoute() {
	const { userId } = useLoaderData<LoaderData>()

	return (
		<div className="relative">
			<TasteProfile userId={userId} />
		</div>
	)
}
