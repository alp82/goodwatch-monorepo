// The rating flow page's loader: the titles to rate (a short queue for one at a time, a long one for Quick list's
// `?mode=quick`), and for a member their settings. /taste/quiz (guests, and members without a handle) and Rate more on a
// profile (/u/:handle/scores/rate) share it.
import { json } from "@remix-run/node"
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
import { getUserFromRequest } from "~/utils/auth"

export interface RatingFlowPageData {
	isLoggedIn: boolean
	smartTitles: ScoringMedia[]
	dehydratedState: DehydratedState
}

/** Quick list renders a table; one at a time needs only a short queue and fetches more near its end. */
const queueLength = (request: Request) =>
	new URL(request.url).searchParams.get("mode") === "quick" ? 300 : 20

export async function loadRatingFlowPage(request: Request) {
	const user = await getUserFromRequest({ request })
	const isLoggedIn = !!user
	const { locale } = getLocaleFromRequest(request)
	const count = queueLength(request)
	const smartTitles = user
		? await getSmartTitlesForUser({ userId: user.id, count, locale })
		: await getSmartTitlesForGuest({ count, locale, ratingsCount: 0 })

	const queryClient = new QueryClient()
	if (isLoggedIn) await prefetchUserSettings({ queryClient, request })

	return json<RatingFlowPageData>({
		isLoggedIn,
		smartTitles,
		dehydratedState: dehydrate(queryClient),
	})
}
