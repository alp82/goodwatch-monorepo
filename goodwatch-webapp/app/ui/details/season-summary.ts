// A show's seasons and standout episodes in short, from its whole episode grid, with what the questions section says
// about them: which season is best, and a weak season worth naming in "Is it worth watching?". The show page builds
// it on the server and sends it with the title, because a long grid comes to the page only in part (see
// episode-grid/window.ts), and so the text costs no script on the page.
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { list } from "~/ui/fingerprint/fingerprintText"

export interface SeasonSummaryEpisode {
	season: number
	episode: number
	name: string
	score: number
}

export interface SeasonSummary {
	/** The numbered seasons with a season score: the vote-weighted mean of their rated IMDb episodes. */
	seasons: { number: number; score: number }[]
	/** The highest and lowest rated episodes among those with at least half the show's median votes. */
	best: SeasonSummaryEpisode | null
	worst: SeasonSummaryEpisode | null
	/** The season question and its answer, or null when fewer than three seasons have a score or they're too close. */
	question: { q: string; a: string } | null
	/** The sentence "Is it worth watching?" adds about a weak season, or null when no season is far below the best. */
	weakSpot: string | null
}

/** Seasons this far apart (IMDb, 0-10) make "which season is best" worth asking. */
export const SEASON_SPREAD = 0.5
/** A season this far (IMDb, 0-10) below the best one makes "worth watching" say so. */
export const WEAK_SEASON_GAP = 1.5

const round1 = (n: number) => Math.round(n * 10) / 10
/** An IMDb score with one decimal: "4.0", "9.4". */
const imdb = (score: number) => score.toFixed(1)
/** Seasons named in a sentence: "Season 4", "Seasons 4 and 6". */
const seasonWords = (numbers: number[]) =>
	`${numbers.length === 1 ? "Season" : "Seasons"} ${list(numbers.map(String))}`

/** The summary of a show's grid; `title` is the show's title as the page names it. */
export function seasonSummary(grid: EpisodeGrid | null | undefined, title: string): SeasonSummary | null {
	if (!grid) return null
	const numbered = grid.seasons.filter((season) => season.number > 0)
	const seasons = numbered.flatMap((season) =>
		season.scores.imdb ? [{ number: season.number, score: round1(season.scores.imdb.score) }] : [],
	)
	if (!seasons.length) return null
	const episodes = numbered.flatMap((season) =>
		season.episodes
			.filter((ep) => !ep.unrated && ep.number > 0)
			.map((ep) => ({ season: season.number, episode: ep.number, name: ep.name, score: ep.score, votes: ep.votes })),
	)
	// Episodes with few votes swing far; they don't count as the best or the lowest.
	const votes = episodes.map((ep) => ep.votes).sort((a, b) => a - b)
	const median = votes.length ? votes[Math.floor(votes.length / 2)] : 0
	const counted = episodes.filter((ep) => ep.votes >= median / 2)
	const pick = (better: (a: number, b: number) => boolean) =>
		counted.reduce<(typeof counted)[number] | null>((found, ep) => (!found || better(ep.score, found.score) ? ep : found), null)
	const strip = (ep: (typeof counted)[number] | null): SeasonSummaryEpisode | null =>
		ep && { season: ep.season, episode: ep.episode, name: ep.name, score: ep.score }
	const best = strip(pick((a, b) => a > b))
	const worst = strip(pick((a, b) => a < b))
	return { seasons, best, worst, question: seasonQuestion(seasons, best, worst, title), weakSpot: weakSpot(seasons) }
}

function weakSpot(seasons: SeasonSummary["seasons"]) {
	if (seasons.length < 2) return null
	const best = Math.max(...seasons.map((s) => s.score))
	const weakest = seasons.reduce((low, s) => (s.score < low.score ? s : low))
	return best - weakest.score >= WEAK_SEASON_GAP
		? `Season ${weakest.number} is the weak spot, with an IMDb average of ${imdb(weakest.score)} against ${imdb(best)} for the best season.`
		: null
}

/** Which season is best, or, when the first season is the weakest, whether the show gets better. */
function seasonQuestion(
	seasons: SeasonSummary["seasons"],
	best: SeasonSummaryEpisode | null,
	worst: SeasonSummaryEpisode | null,
	title: string,
): SeasonSummary["question"] {
	if (seasons.length < 3) return null
	const scores = seasons.map((s) => s.score)
	const top = Math.max(...scores)
	const low = Math.min(...scores)
	if (top - low < SEASON_SPREAD) return null
	const bestSeasons = seasons.filter((s) => s.score === top).map((s) => s.number).slice(0, 3)
	const weakSeasons = seasons.filter((s) => s.score === low).map((s) => s.number).slice(0, 3)
	const episode = (ep: SeasonSummaryEpisode) => `${ep.name} (season ${ep.season}, episode ${ep.episode}) at ${imdb(ep.score)}`
	const episodes = [
		best ? `The highest-rated episode is ${episode(best)}` : "",
		worst && best && worst.score < best.score ? `the lowest is ${episode(worst)}` : "",
	].filter(Boolean)
	const episodeSentence = episodes.length ? ` ${episodes.join(", and ")}.` : ""
	const first = seasons[0]
	if (first.number === 1 && first.score === low)
		return {
			q: `Does ${title} get better after season 1?`,
			a: `Yes: season 1 has an IMDb average of ${imdb(first.score)}, and ${seasonWords(bestSeasons).toLowerCase()} ${bestSeasons.length === 1 ? "peaks" : "peak"} at ${imdb(top)}.${episodeSentence}`,
		}
	return {
		q: `Which season of ${title} is best?`,
		a: `${seasonWords(bestSeasons)}, with an IMDb average of ${imdb(top)}. ${seasonWords(weakSeasons)} ${weakSeasons.length === 1 ? "is" : "are"} the weakest at ${imdb(low)}.${episodeSentence}`,
	}
}
