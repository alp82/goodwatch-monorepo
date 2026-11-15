// /stats, "GoodWatch in numbers" (ui/stats/StatsPage.tsx). The loader reads the last daily snapshot
// (server/stats/stats.server.ts) and never computes one: before the first snapshot exists, the page says the numbers
// are being counted, and that answer is never cached.
import { type MetaFunction, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { readStatsSnapshot } from "~/server/stats/stats.server"
import { StatsPage } from "~/ui/stats/StatsPage"
import { buildMeta, ogImageUrl } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

const PAGE_URL = "https://goodwatch.app/stats"

export const loader = async () => {
	const snapshot = await readStatsSnapshot()
	return snapshot
		? json({ snapshot })
		: json({ snapshot }, { headers: INCOMPLETE_PAGE_HEADERS })
}

export const meta: MetaFunction<typeof loader> = () =>
	buildMeta({
		pageMeta: {
			title: "GoodWatch in numbers | GoodWatch",
			description:
				"Every movie and episode back to back, the ratings behind the scores, records, tropes, streaming around the world, awards, trivia and what members watch. Updated every day.",
			url: PAGE_URL,
			image: ogImageUrl(PAGE_URL),
			alt: "GoodWatch in numbers",
		},
	})

export default function Stats() {
	const { snapshot } = useLoaderData<typeof loader>()
	return <StatsPage snapshot={snapshot} />
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/stats")
