// Colour scale, thresholds and provider formatting for the episode grid.
//
// Fixed thresholds, never a scale per show, so a 9.0 looks the same on every page. The
// cut points sit on the distribution of IMDb episodes with at least 1,000 votes
// (2026-09-25: 10th percentile 7.1, median 8.0, 90th percentile 9.0).
//
// Both palettes are one lightness ramp from dark (worst) to light (best) with a grey
// midpoint, so the order survives any colour vision and greyscale. Checked against the
// page surface (gray-900 #111827) with the dataviz validator:
// - every fill is at least 3.15:1 against the surface (WCAG 1.4.11);
// - every number printed on a fill is at least 4.8:1 (WCAG 1.4.3), with the ink below;
// - adjacent steps are at least 0.06 apart in OKLCH lightness.
// "Standard" runs red to green like the GoodWatch score colours; "Colour-blind safe"
// runs orange to blue.
import type { ProviderScore, SeasonScores } from "~/server/episode-grid.server"

export interface ScoreBucket {
	/** Lowest displayed score (one decimal) in the bucket. */
	min: number
	label: string
	range: string
}

export const SCORE_BUCKETS: ScoreBucket[] = [
	{ min: 0, label: "Poor", range: "below 6" },
	{ min: 6, label: "Weak", range: "6 to 6.9" },
	{ min: 7, label: "Fair", range: "7 to 7.4" },
	{ min: 7.5, label: "Decent", range: "7.5 to 7.9" },
	{ min: 8, label: "Good", range: "8 to 8.4" },
	{ min: 8.5, label: "Great", range: "8.5 to 8.9" },
	{ min: 9, label: "Superb", range: "9 and up" },
]

export type PaletteName = "standard" | "colorblind"

export const PALETTES: Record<PaletteName, { label: string; fills: string[] }> = {
	standard: {
		label: "Standard",
		fills: ["#bc3732", "#c95d2f", "#cb862e", "#adae9f", "#9ed66c", "#8ef29e", "#bcffda"],
	},
	colorblind: {
		label: "Colour-blind safe",
		fills: ["#aa4e2c", "#be6731", "#c7864b", "#a7adb4", "#84cbfd", "#a8deff", "#d4f0ff"],
	},
}

/** Ink per bucket: white on the darkest fill, near-black on the rest. */
export const BUCKET_INK = ["#ffffff", "#0a0a0a", "#0a0a0a", "#0a0a0a", "#0a0a0a", "#0a0a0a", "#0a0a0a"]

/** Episodes with fewer IMDb votes than this are drawn hollow. The dataset's floor is 5 votes. */
export const LOW_VOTE_THRESHOLD = 50

/** Rounds to the one decimal shown, so the colour always matches the printed number. */
export const displayScore = (score: number) => Math.round(score * 10) / 10

export const bucketIndex = (score: number) => {
	const shown = displayScore(score)
	let index = 0
	SCORE_BUCKETS.forEach((bucket, i) => {
		if (shown >= bucket.min) index = i
	})
	return index
}

/** CSS variables for a palette; cells read `var(--eg-fill-N)` and `var(--eg-ink-N)`. */
export const paletteVars = (palette: PaletteName): Record<string, string> =>
	Object.fromEntries(
		PALETTES[palette].fills.flatMap((fill, i) => [
			[`--eg-fill-${i}`, fill],
			[`--eg-ink-${i}`, BUCKET_INK[i]],
		]),
	)

export const cellColors = (score: number) => {
	const i = bucketIndex(score)
	return { background: `var(--eg-fill-${i})`, color: `var(--eg-ink-${i})`, bucket: i }
}

export const formatScore = (score: number) => displayScore(score).toFixed(1)

export const formatCount = (count: number) => count.toLocaleString("en-US")

export const formatVotesShort = (count: number) => {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
	if (count >= 10_000) return `${Math.round(count / 1000)}k`
	if (count >= 1_000) return `${(count / 1000).toFixed(1)}k`
	return String(count)
}

export type ProviderKey = keyof SeasonScores

export interface ProviderMeta {
	/** Short name for tight headers. */
	short: string
	/** Full name for labels and screen readers. */
	name: string
	site: "imdb" | "tmdb" | "rotten" | "metacritic"
	audience: "critics" | "audience"
	/** Highest possible score, for bars. */
	max: number
	format: (score: number) => string
	countNoun: string | null
}

export const PROVIDERS: Record<ProviderKey, ProviderMeta> = {
	imdb: { short: "IMDb", name: "IMDb average", site: "imdb", audience: "audience", max: 10, format: (s) => s.toFixed(1), countNoun: "votes" },
	tmdb: { short: "TMDB", name: "TMDB", site: "tmdb", audience: "audience", max: 10, format: (s) => s.toFixed(1), countNoun: null },
	tomatometer: { short: "Critics", name: "Tomatometer", site: "rotten", audience: "critics", max: 100, format: (s) => `${Math.floor(s)}%`, countNoun: "reviews" },
	popcornmeter: { short: "Audience", name: "Popcornmeter", site: "rotten", audience: "audience", max: 100, format: (s) => `${Math.floor(s)}%`, countNoun: "ratings" },
	metascore: { short: "Critics", name: "Metascore", site: "metacritic", audience: "critics", max: 100, format: (s) => String(Math.floor(s)), countNoun: "reviews" },
	metacriticUser: { short: "Users", name: "Metacritic user score", site: "metacritic", audience: "audience", max: 10, format: (s) => s.toFixed(1), countNoun: "ratings" },
}

export const describeProviderScore = (key: ProviderKey, value: ProviderScore) => {
	const meta = PROVIDERS[key]
	const count = value.count && meta.countNoun ? ` from ${formatCount(value.count)} ${meta.countNoun}` : ""
	return `${meta.name} ${meta.format(value.score)}${count}`
}

export const episodeCode = (season: number, episode: number) => `S${season} E${episode}`
