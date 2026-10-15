import type { CatalogEpisode } from "./episode-resolver.server.ts"

// Synthetic episode IDs and names. Counts/placements are the Money Heist measurements
// in docs/research/imports/episode-numbering.md on research/episode-numbering.
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
