import {
	type GetUserDataResult,
	queryKeyUserData,
} from "~/routes/api.user-data"
import type { StreamingLink } from "~/server/details.server"
import type { Score } from "~/server/scores.server"
import { getUserSettings } from "~/server/user-settings.server"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

interface UserDataRow {
	media_type: string
	tmdb_id: number
	on_wishlist: boolean
	on_watch_history: boolean
	on_favorites: boolean
	on_skipped: boolean
	score: Score | null
	review: string | null
	updated_at_wishlist: Date | null
	updated_at_watch_history: Date | null
	updated_at_favorites: Date | null
	updated_at_scores: Date | null
	updated_at_skipped: Date | null
	title: string
	release_year: number
	poster_path: string
	backdrop_path: string
	aggregated_overall_score_normalized_percent: number | null
	streaming_links: StreamingLink[]
}

type GetUserDataParams = {
	user_id?: string
}

// server call

export const getUserData = async (params: GetUserDataParams) => {
	return await cached<GetUserDataParams, GetUserDataResult>({
		name: "user-data",
		target: _getUserData,
		params,
		ttlMinutes: 10,
		// ttlMinutes: 0,
	})
}

async function _getUserData({
	user_id,
}: GetUserDataParams): Promise<GetUserDataResult> {
	if (!user_id) {
		return {} as GetUserDataResult
	}

	const userSettings = await getUserSettings({ user_id })

	const query = `
WITH combined AS (
    SELECT 
        media_type,
        tmdb_id,
        score,
        review,
        FALSE AS on_wishlist,
        FALSE AS on_watch_history,
        FALSE AS on_favorites,
        FALSE AS on_skipped,
        updated_at AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites,
        NULL::timestamp with time zone AS updated_at_skipped
    FROM user_scores
    WHERE user_id = $1
    
    UNION ALL
    
    SELECT 
        media_type,
        tmdb_id,
        NULL AS score,
        NULL AS review,
        TRUE AS on_wishlist,
        FALSE AS on_watch_history,
        FALSE AS on_favorites,
        FALSE AS on_skipped,
        NULL::timestamp with time zone AS updated_at_scores,
        updated_at AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites,
        NULL::timestamp with time zone AS updated_at_skipped
    FROM user_wishlist
    WHERE user_id = $1
    
    UNION ALL
    
    SELECT 
        media_type,
        tmdb_id,
        NULL AS score,
        NULL AS review,
        FALSE AS on_wishlist,
        TRUE AS on_watch_history,
        FALSE AS on_favorites,
        FALSE AS on_skipped,
        NULL::timestamp with time zone AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        updated_at AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites,
        NULL::timestamp with time zone AS updated_at_skipped
    FROM user_watch_history
    WHERE user_id = $1
    
    UNION ALL
    
    SELECT 
        media_type,
        tmdb_id,
        NULL AS score,
        NULL AS review,
        FALSE AS on_wishlist,
        FALSE AS on_watch_history,
        TRUE AS on_favorites,
        FALSE AS on_skipped,
        NULL::timestamp with time zone AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        updated_at AS updated_at_favorites,
        NULL::timestamp with time zone AS updated_at_skipped
    FROM user_favorites
    WHERE user_id = $1
    
    UNION ALL
    
    SELECT 
        media_type,
        tmdb_id,
        NULL AS score,
        NULL AS review,
        FALSE AS on_wishlist,
        FALSE AS on_watch_history,
        FALSE AS on_favorites,
        TRUE AS on_skipped,
        NULL::timestamp with time zone AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites,
        updated_at AS updated_at_skipped
    FROM user_skipped
    WHERE user_id = $1
)
SELECT 
    combined.media_type,
    combined.tmdb_id,
    MAX(combined.score) AS score,
    MAX(combined.review) AS review,
    MAX(combined.on_wishlist::int)::boolean AS on_wishlist,
    MAX(combined.on_watch_history::int)::boolean AS on_watch_history,
    MAX(combined.on_favorites::int)::boolean AS on_favorites,
    MAX(combined.on_skipped::int)::boolean AS on_skipped,
    MAX(combined.updated_at_scores) AS updated_at_scores,
    MAX(combined.updated_at_wishlist) AS updated_at_wishlist,
    MAX(combined.updated_at_watch_history) AS updated_at_watch_history,
    MAX(combined.updated_at_favorites) AS updated_at_favorites,
    MAX(combined.updated_at_skipped) AS updated_at_skipped,
    COALESCE(movies.title, tv.title, '') AS title,
    COALESCE(movies.release_year, tv.release_year, 0) AS release_year,
    COALESCE(movies.poster_path, tv.poster_path, '') AS poster_path,
    COALESCE(movies.backdrop_path, tv.backdrop_path, '') AS backdrop_path,
    COALESCE(movies.aggregated_overall_score_normalized_percent, tv.aggregated_overall_score_normalized_percent, NULL) AS aggregated_overall_score_normalized_percent,
    COALESCE(
        json_agg(
          json_build_object(
            'provider_id', spl.provider_id,
            'provider_name', sp.name,
            'provider_logo_path', sp.logo_path,
            'stream_type', spl.stream_type
          ) 
        ) FILTER (WHERE spl.provider_id IS NOT NULL), '[]'
    ) AS streaming_links
FROM combined
LEFT JOIN movies ON combined.media_type = 'movie' AND combined.tmdb_id = movies.tmdb_id
LEFT JOIN tv ON combined.media_type = 'tv' AND combined.tmdb_id = tv.tmdb_id
LEFT JOIN streaming_provider_links spl ON spl.tmdb_id = combined.tmdb_id AND spl.media_type = combined.media_type AND spl.country_code = $2
LEFT JOIN streaming_providers sp ON spl.provider_id = sp.id
GROUP BY combined.media_type, combined.tmdb_id, movies.title, tv.title, movies.release_year, tv.release_year, movies.poster_path, tv.poster_path, movies.backdrop_path, tv.backdrop_path, movies.aggregated_overall_score_normalized_percent, tv.aggregated_overall_score_normalized_percent
ORDER BY combined.tmdb_id DESC;
  `

	const params = [user_id, userSettings?.country_default || "US"]
	const result = await executeQuery<UserDataRow>(query, params)

	const userData = {} as GetUserDataResult

	for (const row of result.rows) {
		const {
			media_type,
			tmdb_id,
			on_wishlist,
			on_watch_history,
			on_favorites,
			on_skipped,
			score,
			review,
			updated_at_wishlist,
			updated_at_watch_history,
			updated_at_favorites,
			updated_at_scores,
			updated_at_skipped,
		} = row

		if (!userData[media_type]) {
			userData[media_type] = {}
		}

		const providerTypeKeys = row.streaming_links.map(
			(link) => `${link.provider_id}-${link.streaming_type}`,
		)
		const streaming_links = row.streaming_links.filter(
			(link, index) =>
				index ===
				providerTypeKeys.indexOf(`${link.provider_id}-${link.streaming_type}`),
		)

		userData[media_type][tmdb_id] = {
			onWishList: on_wishlist,
			onWatchHistory: on_watch_history,
			onFavorites: on_favorites,
			onSkipped: on_skipped,
			score,
			review,
			onWishListSince: updated_at_wishlist
				? new Date(updated_at_wishlist)
				: null,
			onWatchHistorySince: updated_at_watch_history
				? new Date(updated_at_watch_history)
				: null,
			onFavoritesSince: updated_at_favorites
				? new Date(updated_at_favorites)
				: null,
			onScoresSince: updated_at_scores ? new Date(updated_at_scores) : null,
			onSkippedSince: updated_at_skipped ? new Date(updated_at_skipped) : null,
			title: row.title,
			release_year: row.release_year,
			poster_path: row.poster_path,
			backdrop_path: row.backdrop_path,
			aggregated_overall_score_normalized_percent:
				row.aggregated_overall_score_normalized_percent,
			streaming_links,
		}
	}

	return userData
}

// cache reset

type ResetUserDataCacheParams = {
	user_id?: string
}

export const resetUserDataCache = async (params: ResetUserDataCacheParams) => {
	if (!params.user_id) {
		return 0
	}

	return await resetCache({
		name: "user-data",
		params,
	})
}

// loader prefetch

export const prefetchUserData = async ({
	queryClient,
	request,
}: PrefetchParams) => {
	await prefetchQuery({
		queryClient,
		queryKey: queryKeyUserData,
		getter: async ({ userId }) => await getUserData({ user_id: userId }),
		request,
	})
}
