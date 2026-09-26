// The episode grid as the show page's loader sends it: tuples instead of objects, so the
// long shows (The Simpsons has about 800 episodes) do not repeat every key per episode.
// The server packs, the page unpacks once, and the grid components read the full shape.
import type { EpisodeGrid, GridSeason, ProviderScore, SeasonScores } from "~/server/episode-grid.server"

/** [number, name, score, votes] */
type WireEpisode = [number, string, number, number]
/** [name, score, votes] */
type WireSpecial = [string, number, number]
/** [score, count] or [score, count, url], or null when the provider has no score. */
type WireScore = [number, number | null] | [number, number | null, string] | null
/** [imdb, tmdb, tomatometer, popcornmeter, metascore, metacriticUser] */
type WireScores = [WireScore, WireScore, WireScore, WireScore, WireScore, WireScore]
/** [number, maxEpisodeNumber, episodes, scores] */
type WireSeason = [number, number, WireEpisode[], WireScores]

export type EpisodeGridWire = Omit<EpisodeGrid, "seasons" | "specials"> & {
	seasons: WireSeason[]
	specials: WireSpecial[]
}

const packScore = (score: ProviderScore | null): WireScore =>
	score ? (score.url ? [score.score, score.count, score.url] : [score.score, score.count]) : null

const unpackScore = (score: WireScore): ProviderScore | null =>
	score ? { score: score[0], count: score[1], ...(score.length === 3 ? { url: score[2] } : {}) } : null

const packScores = (s: SeasonScores): WireScores => [
	packScore(s.imdb),
	packScore(s.tmdb),
	packScore(s.tomatometer),
	packScore(s.popcornmeter),
	packScore(s.metascore),
	packScore(s.metacriticUser),
]

const unpackScores = ([imdb, tmdb, tomatometer, popcornmeter, metascore, metacriticUser]: WireScores): SeasonScores => ({
	imdb: unpackScore(imdb),
	tmdb: unpackScore(tmdb),
	tomatometer: unpackScore(tomatometer),
	popcornmeter: unpackScore(popcornmeter),
	metascore: unpackScore(metascore),
	metacriticUser: unpackScore(metacriticUser),
})

export const packEpisodeGrid = (grid: EpisodeGrid): EpisodeGridWire => ({
	...grid,
	seasons: grid.seasons.map((season) => [
		season.number,
		season.maxEpisodeNumber,
		season.episodes.map((e) => [e.number, e.name, e.score, e.votes]),
		packScores(season.scores),
	]),
	specials: grid.specials.map((s) => [s.name, s.score, s.votes]),
})

export const unpackEpisodeGrid = (wire: EpisodeGridWire): EpisodeGrid => ({
	...wire,
	seasons: wire.seasons.map(
		([number, maxEpisodeNumber, episodes, scores]): GridSeason => ({
			number,
			maxEpisodeNumber,
			episodes: episodes.map(([number, name, score, votes]) => ({ number, name, score, votes })),
			scores: unpackScores(scores),
		}),
	),
	specials: wire.specials.map(([name, score, votes]) => ({ name, score, votes })),
})
