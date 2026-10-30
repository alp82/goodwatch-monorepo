// Watch › Recommendations › By your tropes (/watch/for-you/tropes): unseen picks ranked by the member's top tropes,
// and with ?trope= the picks for one of them (ui/trope-recs). The picks load in the browser from /api/trope-recs; the
// page itself is the member's own and never stored.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import type { ShouldRevalidateFunction } from "@remix-run/react"
import { TropeRecsPage } from "~/ui/trope-recs/TropeRecsPage"
import { buildMeta } from "~/utils/meta"
export { pageHeaders as headers } from "~/utils/headers"

export function loader(_: LoaderFunctionArgs) {
	return json(null, { headers: { "Cache-Control": "private, no-store" } })
}

export const meta: MetaFunction = () =>
	buildMeta({
		pageMeta: {
			title: "By your tropes - GoodWatch",
			url: "https://goodwatch.app/watch/for-you/tropes",
			description:
				"Unseen movies and shows ranked by the TV Tropes you love most.",
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: "By your tropes on GoodWatch",
		},
		items: [],
		robots: "noindex, follow",
	})

// The trope and the kind live in the query and load in the browser: nothing to reload for them.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && currentUrl.pathname === nextUrl.pathname
		? false
		: defaultShouldRevalidate

export default function TropeRecsRoute() {
	return <TropeRecsPage />
}
