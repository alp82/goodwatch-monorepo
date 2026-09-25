// Colours, thresholds and provider formatting for the episode grid.
//
// Colours come from the site's shared vibe scale (`goodwatchVibeIndex` and the
// `--color-vibe-N` tokens), so an episode reads like every other score on GoodWatch. An
// IMDb score maps onto it the way the data flows normalise it: 0-10 times 10 gives the
// 0-100 percent (see imdb_crawl_ratings/fetch.py, `user_score_normalized_percent`), and the
// vibe step is that percent floored to the ten. So 8.7 is vibe-80, "Great".
//
// The colour is never the only signal: the number is printed in the cell, and it is in the
// cell's accessible name and in the hover or tap tip.
import type { EpisodeGrid, ProviderScore, SeasonScores } from "~/server/episode-grid.server"
import { goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"

/**
 * Whether a show gets the episode grid, and with it the link to the grid in the score bar.
 * Movies have no grid; a show needs at least one season with a rated episode.
 */
export const hasEpisodeGrid = (grid: EpisodeGrid | null | undefined): grid is EpisodeGrid => !!grid && grid.seasons.length > 0

/** The anchor of the episode grid section on a show page. */
export const EPISODE_GRID_ANCHOR = "episode-ratings"

/** Episodes with fewer IMDb votes than this get the few-votes mark. The dataset's floor is 5 votes. */
export const LOW_VOTE_THRESHOLD = 50

export const isLowVotes = (votes: number) => votes < LOW_VOTE_THRESHOLD

/** An IMDb score as the one decimal shown. */
export const formatScore = (score: number) => (Math.round(score * 10) / 10).toFixed(1)

/**
 * The vibe step (0, 10, ... 100) of an IMDb 0-10 score. Rounds to the shown decimal first,
 * so the colour always matches the printed number (8.96 prints 9.0 and is vibe-90).
 */
export const imdbVibe = (score: number) => goodwatchVibeIndex(Math.round(score * 10))

/** The site's word for a vibe step: vibe-80 is "Great". */
export const vibeLabel = (vibe: number) => scoreLabels[Math.max(1, vibe / 10)]

/**
 * How far each vibe step is darkened for an episode tile, as its share in an oklab mix with
 * black. Numbers on tiles are always white, and the middle steps (amber to mid green) are
 * too light for white text as they are: white on vibe-60 is 2.7:1. Each of those steps is
 * darkened just enough to reach WCAG AA (4.5:1). vibe-90 is darkened a little too, so it
 * stays a visible step apart from the darkened vibe-80. The red end and vibe-100 already
 * pass and keep their colour.
 */
const TILE_SHADE: Record<number, number> = { 40: 86, 50: 83, 60: 80, 70: 85, 80: 93, 90: 94 }

/** The background of a tile coloured by vibe step, dark enough for a white number. */
export const vibeTileColor = (vibe: number) => {
	const share = TILE_SHADE[vibe]
	return share ? `color-mix(in oklab, var(--color-vibe-${vibe}) ${share}%, black)` : `var(--color-vibe-${vibe})`
}

/** A vibe colour washed into the grid surface, for few-vote tiles. White on it stays above 10:1. */
export const vibeWash = (vibe: number) => `color-mix(in oklab, var(--color-vibe-${vibe}) 22%, #141923)`

/**
 * A vibe colour lifted towards white, for words on the dark page. The darkest vibe steps
 * are too dark to read on gray-900 as they are; this keeps the hue order.
 */
export const vibeTextColor = (vibe: number) => `color-mix(in oklab, var(--color-vibe-${vibe}) 72%, white)`

export const formatCount = (count: number) => count.toLocaleString("en-US")

export type ProviderKey = keyof SeasonScores

export interface ProviderMeta {
	/** Short name for tight labels. */
	short: string
	/** Full name for labels and screen readers. */
	name: string
	site: "imdb" | "tmdb" | "rotten" | "metacritic"
	format: (score: number) => string
	countNoun: string | null
}

export const PROVIDERS: Record<ProviderKey, ProviderMeta> = {
	imdb: { short: "IMDb", name: "IMDb average", site: "imdb", format: formatScore, countNoun: "votes" },
	tmdb: { short: "TMDB", name: "TMDB", site: "tmdb", format: (s) => s.toFixed(1), countNoun: null },
	tomatometer: { short: "Critics", name: "Tomatometer", site: "rotten", format: (s) => `${Math.floor(s)}%`, countNoun: "reviews" },
	popcornmeter: { short: "Audience", name: "Popcornmeter", site: "rotten", format: (s) => `${Math.floor(s)}%`, countNoun: "ratings" },
	metascore: { short: "Critics", name: "Metascore", site: "metacritic", format: (s) => String(Math.floor(s)), countNoun: "reviews" },
	metacriticUser: { short: "Users", name: "Metacritic user score", site: "metacritic", format: (s) => s.toFixed(1), countNoun: "ratings" },
}

export const describeProviderScore = (key: ProviderKey, value: ProviderScore) => {
	const meta = PROVIDERS[key]
	const count = value.count && meta.countNoun ? ` from ${formatCount(value.count)} ${meta.countNoun}` : ""
	return `${meta.name} ${meta.format(value.score)}${count}`
}
