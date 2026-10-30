// Watch › Recommendations › For you (/watch/for-you): picks from the member's taste, steered by mood. A guest gets
// the locked preview (ui/for-you/GuestLock.tsx). A member with a trope profile also gets the switch to By your tropes
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
import { loadMemberTropes } from "~/server/trope-recs/index.server"
import { ForYouPage as ForYouPageView } from "~/ui/for-you/ForYouPage"
import { TropeSwitchContext } from "~/ui/for-you/Heading"
import { getUserIdFromRequest } from "~/utils/auth"
import { buildMeta } from "~/utils/meta"

type ForYouRouteData = ForYouPage & { tropeSwitch?: boolean }

/** The member has top tropes already. Unknown (the profile is still building) or failing: no switch this time. */
async function hasTropeProfile(request: Request) {
	try {
		const userId = await getUserIdFromRequest({ request })
		if (!userId) return false
		const { tropes } = await loadMemberTropes(userId)
		return tropes.length > 0
	} catch (error) {
		console.error("For you: trope profile check failed:", error)
		return false
	}
}

export const loader = presentCatalogLoader(
	async ({ request }: LoaderFunctionArgs) => {
		const [page, tropeSwitch] = await Promise.all([
			loadForYouPage(request),
			hasTropeProfile(request),
		])
		return json<ForYouRouteData>(
			page.kind === "member" ? { ...page, tropeSwitch } : page,
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
		<TropeSwitchContext.Provider value={!!data.tropeSwitch}>
			<ForYouPageView data={data} />
		</TropeSwitchContext.Provider>
	)
}
