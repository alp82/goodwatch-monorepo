// The episode grid as the show page's loader sends it: tuples instead of objects, so the
// long shows (The Simpsons has about 800 episodes) do not repeat every key per episode.
// The server packs, the page unpacks once, and the grid components read the full shape.
import type {
	EpisodeGrid,
	GridSeason,
	ProviderScore,
	SeasonScores,
} from "~/server/episode-grid.server"

/** [number, name, score, votes] */
type WireEpisode =
	| [number, string, number, number]
	| [number, string, number, number, boolean, string | null]
/** [name, score, votes] */
type WireSpecial = [string, number, number] | [string, number, number, boolean]
/** [score, count] or [score, count, url], or null when the provider has no score. */
type WireScore =
	| [number, number | null]
	| [number, number | null, string]
	| null
/** [imdb, tmdb, tomatometer, popcornmeter, metascore, metacriticUser] */
type WireScores = [
	WireScore,
	WireScore,
	WireScore,
	WireScore,
	WireScore,
	WireScore,
]
/** [number, maxEpisodeNumber, episodes, scores] */
type WireSeason =
	| [number, number, WireEpisode[], WireScores]
	| [
			number,
			number,
			WireEpisode[],
			WireScores,
			NonNullable<GridSeason["coverage"]>,
	  ]

export type EpisodeGridWire = Omit<EpisodeGrid, "seasons" | "specials"> & {
	episodeIds?: Record<string, number>
	episodeLanguages?: Record<string, string>
	seasons: WireSeason[]
	specials: WireSpecial[]
}

const packScore = (score: ProviderScore | null): WireScore =>
	score
		? score.url
			? [score.score, score.count, score.url]
			: [score.score, score.count]
		: null

const unpackScore = (score: WireScore): ProviderScore | null =>
	score
		? {
				score: score[0],
				count: score[1],
				...(score.length === 3 ? { url: score[2] } : {}),
			}
		: null

const packScores = (s: SeasonScores): WireScores => [
	packScore(s.imdb),
	packScore(s.tmdb),
	packScore(s.tomatometer),
	packScore(s.popcornmeter),
	packScore(s.metascore),
	packScore(s.metacriticUser),
]

const unpackScores = ([
	imdb,
	tmdb,
	tomatometer,
	popcornmeter,
	metascore,
	metacriticUser,
]: WireScores): SeasonScores => ({
	imdb: unpackScore(imdb),
	tmdb: unpackScore(tmdb),
	tomatometer: unpackScore(tomatometer),
	popcornmeter: unpackScore(popcornmeter),
	metascore: unpackScore(metascore),
	metacriticUser: unpackScore(metacriticUser),
})

export const packEpisodeGrid = (grid: EpisodeGrid): EpisodeGridWire => ({
	...grid,
	...(grid.seasons.some(s => s.episodes.some(e => e.tmdbId)) || grid.specials.some(e => e.tmdbId) ? { episodeIds: Object.fromEntries([...grid.seasons.flatMap(s => s.episodes.filter(e => e.tmdbId).map(e => [`${s.number}:${e.number}`, e.tmdbId!])), ...grid.specials.filter(e => e.tmdbId).map((e, i) => [`special:${i}`, e.tmdbId!])]) } : {}),
	...(grid.seasons.some(s => s.episodes.some(e => e.nameLanguage)) || grid.specials.some(e => e.nameLanguage) ? { episodeLanguages: Object.fromEntries([...grid.seasons.flatMap(s => s.episodes.filter(e => e.nameLanguage).map(e => [`${s.number}:${e.number}`, e.nameLanguage!])), ...grid.specials.filter(e => e.nameLanguage).map((e, i) => [`special:${i}`, e.nameLanguage!])]) } : {}),
	seasons: grid.seasons.map((season): WireSeason => {
		const base: [number, number, WireEpisode[], WireScores] = [
			season.number,
			season.maxEpisodeNumber,
			season.episodes.map(
				(e): WireEpisode =>
					e.unrated || e.canonicalLabel
						? [
								e.number,
								e.name,
								e.score,
								e.votes,
								Boolean(e.unrated),
								e.canonicalLabel ?? null,
							]
						: [e.number, e.name, e.score, e.votes],
			),
			packScores(season.scores),
		]
		return season.coverage ? [...base, season.coverage] : base
	}),
	specials: grid.specials.map(
		(s): WireSpecial =>
			s.unrated ? [s.name, s.score, s.votes, true] : [s.name, s.score, s.votes],
	),
})

export const unpackEpisodeGrid = (wire: EpisodeGridWire): EpisodeGrid => ({
	...(({ episodeIds, episodeLanguages, ...metadata }) => metadata)(wire),
	seasons: wire.seasons.map(
		([seasonNumber, maxEpisodeNumber, episodes, scores, coverage]): GridSeason => ({
			number: seasonNumber,
			...(coverage ? { coverage } : {}),
			maxEpisodeNumber,
			episodes: episodes.map(
				([number, name, score, votes, unrated, canonicalLabel]) => ({
					number,
					name,
					...(wire.episodeIds?.[`${seasonNumber}:${number}`] ? { tmdbId: wire.episodeIds[`${seasonNumber}:${number}`] } : {}),
					...(wire.episodeLanguages?.[`${seasonNumber}:${number}`] ? { nameLanguage: wire.episodeLanguages[`${seasonNumber}:${number}`] } : {}),
					score,
					votes,
					...(unrated ? { unrated } : {}),
					...(canonicalLabel ? { canonicalLabel } : {}),
				}),
			),
			scores: unpackScores(scores),
		}),
	),
	specials: wire.specials.map(([name, score, votes, unrated], index) => ({
		...(wire.episodeIds?.[`special:${index}`] ? { tmdbId: wire.episodeIds[`special:${index}`] } : {}),
		...(wire.episodeLanguages?.[`special:${index}`] ? { nameLanguage: wire.episodeLanguages[`special:${index}`] } : {}),
		name,
		score,
		votes,
		...(unrated ? { unrated } : {}),
	})),
})
