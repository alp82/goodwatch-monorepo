import type { CatalogEpisode } from "./episode-resolver.server.ts"

// Synthetic episode IDs and names. Counts/placements are the Money Heist measurements
// in https://github.com/alp82/goodwatch-monorepo/blob/research/episode-numbering/docs/research/imports/episode-numbering.md
export const moneyHeist: CatalogEpisode[] = [22, 15, 16, 10].flatMap(
	(count, season) =>
		Array.from({ length: count }, (_, i) => ({
			tmdb_id: 1000 + season * 100 + i + 1,
			show_id: 71446,
			season_number: season,
			episode_number: i + 1,
			name: `Episode ${season}-${i + 1}`,
			tvdb_id: null,
		})),
)
export const netflixParts = {
	id: "netflix-parts",
	episode_count: 48,
	group_count: 5,
	groups: [
		moneyHeist.filter((e) => e.season_number === 0 && e.episode_number <= 13),
		moneyHeist.filter((e) => e.season_number === 0 && e.episode_number > 13),
		moneyHeist.filter((e) => e.season_number === 2 && e.episode_number <= 8),
		moneyHeist.filter((e) => e.season_number === 2 && e.episode_number > 8),
		moneyHeist.filter((e) => e.season_number === 3),
	].map((episodes, i) => ({
		name: `Part ${i + 1}`,
		order: i + 1,
		episodes: episodes.map((e, order) => ({ id: e.tmdb_id, order })),
	})),
}

// TMDB S4 has 23 Friends episodes versus TVDB's 24; The Office has 14 versus 19.
// IDs are synthetic; the finale names identify the rows used by the regression tests.
export const friends: CatalogEpisode[] = Array.from({ length: 23 }, (_, i) => ({
	tmdb_id: i === 22 ? 101 : 2000 + i,
	show_id: 1668,
	season_number: 4,
	episode_number: i + 1,
	name: i === 22 ? "The One with Ross's Wedding" : `Friends episode ${i + 1}`,
	tvdb_id: null,
}))
export const office: CatalogEpisode[] = Array.from({ length: 14 }, (_, i) => ({
	tmdb_id: i === 13 ? 201 : 3000 + i,
	show_id: 2316,
	season_number: 4,
	episode_number: i + 1,
	name: i === 13 ? "Goodbye, Toby" : `The Office episode ${i + 1}`,
	tvdb_id: null,
}))
