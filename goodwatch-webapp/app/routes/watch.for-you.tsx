// Watch › Recommendations › For you (/watch/for-you): picks from the member's taste, steered by mood. A guest gets
// the locked preview (ui/for-you/GuestLock.tsx). Every member also gets the switch to By your tropes
// (/watch/for-you/tropes, ui/trope-recs).
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { ForYouPage } from "~/domain/for-you-page/contract"
import { loadForYouPage } from "~/server/for-you-page/page.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { ForYouPage as ForYouPageView } from "~/ui/for-you/ForYouPage"
import { TropeSwitchContext } from "~/ui/for-you/Heading"
import { buildMeta } from "~/utils/meta"

type ForYouRouteData = ForYouPage

export const loader = presentCatalogLoader(
	async ({ request }: LoaderFunctionArgs) => {
		const page = await loadForYouPage(request)
		return json<ForYouRouteData>(
			page,
			page.kind === "member"
				? { headers: { "Cache-Control": "private, no-store" } }
				: undefined,
		)
	},
	{ live: true },
)

export const meta: MetaFunction = () =>
	buildMeta({
		pageMeta: {
			title: "For you - GoodWatch",
			url: "https://goodwatch.app/watch/for-you",
			description: "Recommendations from your taste, steered by mood.",
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: "For you on GoodWatch",
		},
		items: [],
		robots: "noindex, follow",
	})

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (
		formMethod ||
		currentUrl.pathname !== nextUrl.pathname ||
		currentUrl.searchParams.get("recipe") === nextUrl.searchParams.get("recipe")
	)
		return defaultShouldRevalidate
	const current = new URL(currentUrl)
	const next = new URL(nextUrl)
	current.searchParams.delete("recipe")
	next.searchParams.delete("recipe")
	return current.search === next.search ? false : defaultShouldRevalidate
}

export default function ForYouRoute() {
	const data = useLoaderData<typeof loader>() as unknown as ForYouRouteData
	return (
		<TropeSwitchContext.Provider value={data.kind === "member"}>
			<ForYouPageView data={data} />
		</TropeSwitchContext.Provider>
	)
}
