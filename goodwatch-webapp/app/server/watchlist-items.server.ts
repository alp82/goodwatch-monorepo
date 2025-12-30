import { query } from "~/utils/crate"
import type { AllRatings } from "~/utils/ratings"

export interface WatchlistItem extends Partial<AllRatings> {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	release_year: string
	poster_path: string
	added_at: string
}

interface GetWatchlistItemsParams {
	userId: string
	limit?: number
}

export async function getWatchlistItems({
	userId,
	limit = 20,
}: GetWatchlistItemsParams): Promise<WatchlistItem[]> {
	// Run movie and show queries in parallel for better performance
	const [movieResults, showResults] = await Promise.all([
		query<WatchlistItem>(`
			SELECT 
				m.tmdb_id,
				'movie' as media_type,
				m.title,
				m.release_year,
				m.poster_path,
				m.goodwatch_overall_score_normalized_percent,
				w.updated_at as added_at
			FROM user_wishlist w
			INNER JOIN movie m ON w.tmdb_id = m.tmdb_id
			WHERE w.user_id = ? AND w.media_type = 'movie' AND m.poster_path IS NOT NULL
			ORDER BY w.updated_at DESC
			LIMIT ?
		`, [userId, limit]),
		query<WatchlistItem>(`
			SELECT 
				s.tmdb_id,
				'show' as media_type,
				s.title,
				s.release_year,
				s.poster_path,
				s.goodwatch_overall_score_normalized_percent,
				w.updated_at as added_at
			FROM user_wishlist w
			INNER JOIN show s ON w.tmdb_id = s.tmdb_id
			WHERE w.user_id = ? AND w.media_type = 'show' AND s.poster_path IS NOT NULL
			ORDER BY w.updated_at DESC
			LIMIT ?
		`, [userId, limit]),
	])

	// Combine and sort by added_at, then limit
	return [...movieResults, ...showResults]
		.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
		.slice(0, limit)
}
