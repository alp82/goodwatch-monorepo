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
import { isEnabled } from "~/server/features.server"
import {
	type TasteTabData,
	loadTasteTab,
} from "~/server/taste-portrait/page.server"
import { prefetchUserSettings } from "~/server/user-settings.server"
import TasteProfile from "~/ui/taste/TasteProfile"
import { SidesOfYou } from "~/ui/taste/tabs/SidesOfYou"
import { TasteTabFrame } from "~/ui/taste/tabs/TasteTabFrame"
import { getUserFromRequest } from "~/utils/auth"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const tabs = (data as LoaderData | undefined)?.kind === "tabs"
	const pageMeta: PageMeta = tabs
		? {
				title: "Your taste - GoodWatch",
				description:
					"The sides of your movie and TV taste, the places just past them, and more of what you love on your services.",
				url: "https://goodwatch.app/taste",
				image: "https://goodwatch.app/images/heroes/hero-movies.png",
				alt: "Your taste on GoodWatch",
			}
		: {
				title: "Your Taste Profile - GoodWatch",
				description:
					"View your complete taste profile with personalized insights about your movie and TV preferences.",
				url: "https://goodwatch.app/taste",
				image: "https://goodwatch.app/images/heroes/hero-movies.png",
				alt: "Your taste profile on GoodWatch",
			}

	return buildMeta({ pageMeta, items: [] })
}

// The unlock-ladder profile, served while REC_TASTE_PAGE hides the Taste tabs from the viewer.
type ProfileData = {
	kind: "profile"
	userId: string
	dehydratedState: DehydratedState
}

type LoaderData = ProfileData | TasteTabData<"sides">

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const user = await getUserFromRequest({ request })
	const userId = user?.id ?? null

	if (isEnabled("tastePage", { userId }))
		return loadTasteTab(request, "sides", userId)

	if (!user) {
		return redirect("/taste/quiz")
	}

	const queryClient = new QueryClient()
	await prefetchUserSettings({ queryClient, request })

	return json<ProfileData>({
		kind: "profile",
		userId: user.id,
		dehydratedState: dehydrate(queryClient),
	})
}

export default function TasteRoute() {
	const data = useLoaderData<LoaderData>()

	if (data.kind === "tabs")
		return (
			<TasteTabFrame tab="sides" memberView={data.view}>
				{(view) => <SidesOfYou view={view} />}
			</TasteTabFrame>
		)

	return (
		<div className="relative">
			<TasteProfile userId={data.userId} />
		</div>
	)
}
