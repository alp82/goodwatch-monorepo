import type { MediaType } from "~/types/user-data"

// A title's key is its Qdrant point id: movie 1e12 + tmdb_id, show 2e12 + tmdb_id. The same numbers as `makePointId`
// in `utils/qdrant.ts`, without needing a Qdrant client, so browser code can use them too.
export type TitleKey = number

const MOVIE_BASE = 1_000_000_000_000
const SHOW_BASE = 2_000_000_000_000

export const titleKey = (mediaType: MediaType, tmdbId: number): TitleKey =>
	(mediaType === "movie" ? MOVIE_BASE : SHOW_BASE) + tmdbId

export const parseTitleKey = (
	key: TitleKey,
): { mediaType: MediaType; tmdbId: number } =>
	key >= SHOW_BASE
		? { mediaType: "show", tmdbId: key - SHOW_BASE }
		: { mediaType: "movie", tmdbId: key - MOVIE_BASE }
