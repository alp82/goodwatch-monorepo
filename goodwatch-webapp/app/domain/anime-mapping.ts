/** A tracker entry is a cour, never an assertion that the whole TMDB show is Seen. */
export interface AnimeEntry {
	source: "anidb" | "myanimelist" | "anilist" | "kitsu"
	id: number
	/** Adapters repeat the full reported progress on every expanded episode row. */
	progress?: number
	/** The source's total when known; never guessed from the TMDB season. */
	episodeCount?: number
}
/** Placement: Anime-Lists/anime-lists; tracker identity crosswalk: Fribb/anime-lists. */
export interface AnimeMapping {
	anidbId: number
	showId: number
	season: number | "a" | null
	offset: number
	ranges: { start: number; end: number; season: number; offset: number }[]
	ids: { myanimelist: number[]; anilist: number[]; kitsu: number[] }
	unsupportedReason?: string
}
