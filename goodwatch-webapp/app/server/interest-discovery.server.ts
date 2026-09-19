import {
	MEDIA_COLLECTION,
	makePointId,
	recommend,
	scroll,
} from "~/utils/qdrant"
import {
	buildBaseFilterConditions,
	buildPayloadFields,
	getStringValue,
	type QdrantMediaPayload,
} from "~/server/utils/recommend"
import type { UserData, MediaKey } from "~/types/user-data"
import type { Recommendation } from "~/ui/taste/types"

export type DiscoveryResult = {
	recommendations: Recommendation[]
	basis: "general" | "personalized"
}
const pointId = (key: string) => {
	const [type, id] = key.split("-")
	return makePointId(type as "movie" | "show", Number(id))
}

/** Availability never participates in interest discovery. Composite point IDs preserve movie/show identity. */
export async function getInterestDiscovery(
	data?: UserData,
	genre = "",
): Promise<DiscoveryResult> {
	const excluded = [
		...new Set(
			["scores", "skipped", "watched", "wishlist"].flatMap((key) =>
				Object.keys(data?.[key] || {}),
			),
		),
	]
	const positive = [
		...new Set([
			...Object.entries(data?.scores || {})
				.filter(([, value]) => value.score >= 6)
				.map(([key]) => key),
			...Object.keys(data?.wishlist || {}).filter(
				(key) =>
					!data?.skipped[key as MediaKey] &&
					!((data?.scores[key as MediaKey]?.score ?? 10) < 6),
			),
		]),
	].slice(0, 50)
	const negative = Object.entries(data?.scores || {})
		.filter(([, value]) => value.score < 6)
		.map(([key]) => key)
		.slice(0, 50)
	const filter = buildBaseFilterConditions({
		minVotingCount: 10000,
		minScore: 60,
		additionalMust: genre ? [{ key: "genres", match: { value: genre } }] : [],
		additionalMustNot: excluded.length
			? [{ has_id: excluded.map(pointId) }]
			: [],
	})
	const payload = buildPayloadFields({
		includeRatings: false,
		additionalFields: ["genres"],
	})
	let basis: DiscoveryResult["basis"] = "general"
	let results: { payload: QdrantMediaPayload; score?: number }[] = []
	if (positive.length) {
		results = await recommend<QdrantMediaPayload>({
			collectionName: MEDIA_COLLECTION,
			using: "fingerprint_v1",
			positive: positive.map(pointId),
			negative: negative.map(pointId),
			filter,
			limit: 40,
			withPayload: payload,
		})
		if (results.length) basis = "personalized"
	}

	if (!results.length) {
		const groups = await Promise.all(
			["movie", "show"].map((type) =>
				scroll<QdrantMediaPayload>({
					collectionName: MEDIA_COLLECTION,
					filter: {
						...filter,
						must: [
							...filter.must,
							{ key: "media_type", match: { value: type } },
						],
					},
					limit: 20,
					withPayload: payload,
				}),
			),
		)
		results = Array.from({ length: 20 }, (_, index) =>
			groups.flatMap((group) => (group[index] ? [group[index]] : [])),
		).flat()
	}
	return {
		basis,
		recommendations: results.map(({ payload: item, score }) => ({
			tmdb_id: item.tmdb_id,
			media_type: item.media_type,
			title: getStringValue(item.title),
			poster_path: getStringValue(item.poster_path),
			backdrop_path: getStringValue(item.backdrop_path),
			release_year: String(item.release_year || ""),
			genres: item.genres || [],
			matchPercentage: score ? Math.round(score * 100) : 0,
		})),
	}
}
