import { START_AFTER_PAINT } from "~/utils/start-after-paint"
// Rate more, the owner's Profile tab after Scores: /u/:handle/scores/rate. The rating flow, one title at a time, or Quick list's table with
// `?mode=quick`; `?view=taste` opens its taste view. Only the owner has this page; anyone else goes to Scores.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { useCallback } from "react"
import { moveResponse, tastePath } from "~/domain/member-paths"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadProfileShell } from "~/server/profile/page.server"
import {
	type RatingFlowPageData,
	loadRatingFlowPage,
} from "~/server/rating-flow-page.server"
import { ModeSwitch } from "~/ui/quick-list/parts"
import { QuickList } from "~/ui/quick-list/QuickList"
import { RatingFlow } from "~/ui/rating-flow/RatingFlow"
import { type FlowView, viewOf } from "~/ui/rating-flow/flow"

export const handle = START_AFTER_PAINT

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = ({ params }) => [
	{ title: `Rate more · @${params.handle} · GoodWatch` },
	// Personal rating flow, kept out of search results.
	{ name: "robots", content: "noindex, nofollow" },
]

async function canonicalLoader({ request, params }: LoaderFunctionArgs) {
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	const { shell } = loaded
	if (shell.viewer !== "owner") {
		const visitor = new URL(request.url).searchParams.get("as")
		throw moveResponse({
			to: tastePath(shell.handle, "scores", { as: visitor }),
			status: 302,
			private: true,
		})
	}
	const response = await loadRatingFlowPage(request)
	response.headers.set("Cache-Control", "private, no-store")
	return response
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })

/**
 * The rating flow. `?view=taste` opens its taste view. `?mode=quick` is its Quick list mode: the titles in a table,
 * many answered in a row. One at a time stays the default.
 */
export default function ProfileRateMore() {
	const { isLoggedIn, smartTitles } = useLoaderData() as RatingFlowPageData
	const [params, setParams] = useSearchParams()
	const view = viewOf(params)
	// Each view is its own history entry, so Back from the taste view returns to rating.
	const onView = useCallback(
		(next: FlowView) =>
			setParams(next === "taste" ? { view: "taste" } : {}, {
				preventScrollReset: true,
			}),
		[setParams],
	)
	if (view === "rate" && params.get("mode") === "quick")
		return <QuickList titles={smartTitles} member={isLoggedIn} />
	return (
		<RatingFlow
			titles={smartTitles}
			member={isLoggedIn}
			view={view}
			onView={onView}
			top={
				view === "rate" ? (
					<div className="mb-3">
						<ModeSwitch mode="one" />
					</div>
				) : undefined
			}
		/>
	)
}
