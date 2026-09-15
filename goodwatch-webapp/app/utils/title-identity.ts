// Verified against TMDB and matching IMDb identities on 2026-09-15.
// These retired movie IDs must never affect the TV namespace.
export const retiredMovieIds: Readonly<Record<number, number>> = {
	5338654: 658039,
	3635601: 872517,
	162483: 10679,
}

export function canonicalTitleId(mediaType: string, tmdbId: number): number {
	return mediaType === "movie" ? retiredMovieIds[tmdbId] ?? tmdbId : tmdbId
}
