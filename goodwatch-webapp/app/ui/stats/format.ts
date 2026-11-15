// How /stats writes its numbers and links its titles. Plain Node runs the tests that import this file, so its imports
// are relative with the extension.
import { episodeLinkSearch } from "../../domain/episode-link.ts"
import type { StatsEpisode, StatsTitle } from "../../domain/stats/snapshot.ts"
import { titlePath } from "../../utils/helpers.ts"

export const MINUTES_PER_DAY = 60 * 24
export const MINUTES_PER_YEAR = MINUTES_PER_DAY * 365
export const SECONDS_PER_YEAR = 60 * 60 * 24 * 365.25

/** A count with separators: "1,278,749". */
export const count = (n: number) => Math.round(n).toLocaleString("en-US")

/** "1.57 billion", "16.7 million", or the count below a million. */
export const big = (n: number, digits = 2) =>
	n >= 1e9
		? `${(n / 1e9).toFixed(digits)} billion`
		: n >= 1e6
			? `${(n / 1e6).toFixed(1)} million`
			: count(n)

/** A brand card's number: "1.57B", "16.7M", or the count below a million. */
export const short = (n: number) =>
	n >= 1e9
		? `${(n / 1e9).toFixed(2)}B`
		: n >= 1e6
			? `${(n / 1e6).toFixed(1)}M`
			: count(n)

const compact = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumSignificantDigits: 3,
})

/** "364K" as "364" and "K", for a brand card's number and its small unit. */
export const splitCompact = (n: number) => {
	const text = compact.format(n)
	const m = /^([\d.]+)([A-Z]?)$/.exec(text)
	return m ? { n: m[1], unit: m[2] } : { n: text, unit: "" }
}

/** Hours and minutes: "16 h 24 min", "12 h". */
export const hoursMinutes = (minutes: number) =>
	`${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim()

export const oneDecimal = (n: number) => n.toFixed(1)

/** A two-digit position: "01". */
export const rank = (n: number) => String(n).padStart(2, "0")

export const titleHref = (t: Pick<StatsTitle, "type" | "tmdbId" | "title">) =>
	titlePath(t.type, t.tmdbId, t.title)

export const titleKey = (t: Pick<StatsTitle, "type" | "tmdbId">) =>
	`${t.type}-${t.tmdbId}`

/** The show page with this episode open in its episode grid. */
export const episodeHref = (e: StatsEpisode) =>
	`${titlePath("show", e.showId, e.show)}?${episodeLinkSearch(e.season, e.episode, e.name)}#episodes`

/** "Episode #1.12" is IMDb's placeholder name: say the number instead. */
export const episodeName = (e: Pick<StatsEpisode, "name" | "episode">) =>
	/^Episode #/.test(e.name) ? `Episode ${e.episode}` : e.name

export const episodeCode = (e: Pick<StatsEpisode, "season" | "episode">) =>
	`S${e.season} E${e.episode}`

/** The snapshot's day, as the page says it: "November 15, 2026". */
export const asOfDate = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	})
