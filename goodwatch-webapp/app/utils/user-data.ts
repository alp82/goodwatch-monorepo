import type { StreamingLink } from "~/server/details.server"
import type { GetUserDataResult } from "~/server/userData.server"

export type UserDataItem = {
	media_type: string
	tmdb_id: string
	onFavorites: boolean
	onFavoritesSince: Date | null
	onWishList: boolean
	onWishListSince: Date | null
	onSkipped: boolean
	onSkippedSince: Date | null
	score: number | null
	onScoresSince: Date | null
	title: string
	poster_path: string
	aggregated_overall_score_normalized_percent: number | null
	streaming_links?: StreamingLink[]
}

export const convertUserData = (
	userDataResult: GetUserDataResult | undefined,
	filterKeys: (
		| "onFavoritesSince"
		| "onWishListSince"
		| "onScoresSince"
		| "onSkippedSince"
	)[],
): UserDataItem[] => {
	const result: UserDataItem[] = []

	for (const media_type in userDataResult) {
		if (userDataResult.hasOwnProperty(media_type)) {
			for (const tmdb_id in userDataResult[media_type]) {
				if (userDataResult[media_type].hasOwnProperty(tmdb_id)) {
					const entry = userDataResult[media_type][tmdb_id]
					if (filterKeys.some((filterKey) => entry[filterKey])) {
						result.push({
							media_type,
							tmdb_id,
							...entry,
						})
					}
				}
			}
		}
	}

	return result
}

export const getSortedUserData = (
	userDataResult: GetUserDataResult | undefined,
	sortKeys: (
		| "onFavoritesSince"
		| "onWishListSince"
		| "onScoresSince"
		| "onSkippedSince"
	)[],
): UserDataItem[] => {
	const convertedList = convertUserData(userDataResult, sortKeys)

	convertedList.sort((a, b) => {
		let latestA = null
		let latestB = null

		// Find the latest date for each object based on sortKeys
		for (const sortKey of sortKeys) {
			if (a[sortKey]) {
				const dateA = new Date(a[sortKey]).getTime()
				latestA = latestA ? Math.max(latestA, dateA) : dateA
			}
			if (b[sortKey]) {
				const dateB = new Date(b[sortKey]).getTime()
				latestB = latestB ? Math.max(latestB, dateB) : dateB
			}
		}

		// Compare the latest dates found
		if (latestA && latestB) {
			return latestB - latestA
		}
		if (latestA && !latestB) {
			return -1
		}
		if (!latestA && latestB) {
			return 1
		}
		return 0
	})

	return convertedList
}
