// What the card of GoodWatch in numbers (/stats) shows (StatsCard.tsx): the movies and shows on GoodWatch, the years it
// would take to watch them all, how many movies share the most common title, and the longest movie. The numbers come
// from the page's daily snapshot (server/stats/), so the card store redraws this card daily (og-image.server.tsx).
// Plain Node runs the test on this file, so its imports are relative with the extension.
import type { StatsSnapshot } from "../../domain/stats/snapshot.ts"
import { STATS_CARD_COPY as COPY } from "../../ui/og-image/copy.ts"
import type {
	OgStatsContent,
	OgStatsLine,
} from "../../ui/og-image/StatsCard.tsx"
import { MINUTES_PER_YEAR, count, short } from "../../ui/stats/format.ts"

export interface StatsCardDeps {
	/** The page's last snapshot, or null while the first one is counted. */
	snapshot: () => Promise<StatsSnapshot | null>
}

/**
 * The card of /stats. Throws before the first snapshot exists, so the generic card isn't stored in its place; a line
 * whose list is empty is left out.
 */
export async function statsCardContent(
	deps: StatsCardDeps,
): Promise<OgStatsContent> {
	const s = await deps.snapshot()
	if (!s) throw new Error("The stats snapshot isn't ready yet")
	const c = s.catalog
	const lines: OgStatsLine[] = [
		{ n: short(c.movies + c.shows), words: COPY.titles },
		// The same total as the page's hero (ui/stats/hero.tsx).
		{
			n: count(
				Math.round((c.movieMinutes + c.episodeMinutes) / MINUTES_PER_YEAR),
			),
			words: COPY.years,
		},
	]
	const common = s.trivia.commonTitles[0]
	if (common)
		lines.push({
			n: count(common.movies),
			words: COPY.commonTitle(common.title),
		})
	const longest = s.records.longest[0]
	if (longest)
		lines.push({
			n: COPY.hours(Math.floor(longest.runtime / 60)),
			words: COPY.longest(longest.title),
			short: COPY.longestShort,
		})
	return { kind: "stats", lines }
}
