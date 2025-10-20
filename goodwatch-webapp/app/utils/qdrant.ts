import { QdrantClient } from "@qdrant/js-client-rest"

type MediaType = "movie" | "show"

const MOVIE_BASE = 1_000_000_000_000
const SHOW_BASE = 2_000_000_000_000

class QdrantClientWrapper {
	private client: QdrantClient

	constructor(url: string, apiKey?: string) {
		this.client = new QdrantClient({
			url,
			apiKey,
		})
	}

	makePointId(mediaType: MediaType, tmdbId: number): number {
		const tid = Number(tmdbId)
		if (tid < 0) {
			throw new Error("tmdb_id must be non-negative")
		}
		if (mediaType === "movie") {
			return MOVIE_BASE + tid
		}
		if (mediaType === "show") {
			return SHOW_BASE + tid
		}
		throw new Error(`unknown media_type: ${mediaType}`)
	}

	parsePointId(pointId: number): { mediaType: MediaType; tmdbId: number } {
		if (pointId >= SHOW_BASE) {
			return { mediaType: "show", tmdbId: pointId - SHOW_BASE }
		}
		return { mediaType: "movie", tmdbId: pointId - MOVIE_BASE }
	}

	async search<T = Record<string, any>>(params: {
		collectionName: string
		vector: number[] | { name: string; vector: number[] }
		filter?: Record<string, any>
		limit?: number
		offset?: number
		withPayload?: boolean | string[]
		withVector?: boolean | string[]
		scoreThreshold?: number
	}) {
		try {
			const result = await this.client.search(params.collectionName, {
				vector: params.vector,
				filter: params.filter,
				limit: params.limit ?? 10,
				offset: params.offset,
				with_payload: params.withPayload ?? true,
				with_vector: params.withVector ?? false,
				score_threshold: params.scoreThreshold,
			})

			return result.map((point: any) => ({
				id: point.id,
				score: point.score,
				payload: point.payload as T,
				vector: point.vector,
			}))
		} catch (error) {
			console.error("====================")
			console.error("Qdrant Search Error:")
			console.error("Collection:", params.collectionName)
			console.error("Params:", JSON.stringify(params, null, 2))
			console.error("Error:", error)
			console.error("Stack trace:")
			console.trace()
			throw error
		}
	}

	async retrieve<T = Record<string, any>>(params: {
		collectionName: string
		ids: (number | string)[]
		withPayload?: boolean | string[]
		withVector?: boolean | string[]
	}) {
		try {
			const result = await this.client.retrieve(params.collectionName, {
				ids: params.ids,
				with_payload: params.withPayload ?? true,
				with_vector: params.withVector ?? false,
			})

			return result.map((point: any) => ({
				id: point.id,
				payload: point.payload as T,
				vector: point.vector,
			}))
		} catch (error) {
			console.error("====================")
			console.error("Qdrant Retrieve Error:")
			console.error("Collection:", params.collectionName)
			console.error("IDs:", params.ids)
			console.error("Error:", error)
			console.error("Stack trace:")
			console.trace()
			throw error
		}
	}

	async scroll<T = Record<string, any>>(params: {
		collectionName: string
		filter?: Record<string, any>
		limit?: number
		offset?: number | string
		withPayload?: boolean | string[]
		withVector?: boolean | string[]
	}) {
		try {
			const result = await this.client.scroll(params.collectionName, {
				filter: params.filter,
				limit: params.limit ?? 10,
				offset: params.offset,
				with_payload: params.withPayload ?? true,
				with_vector: params.withVector ?? false,
			})

			return {
				points: result.points.map((point: any) => ({
					id: point.id,
					payload: point.payload as T,
					vector: point.vector,
				})),
				nextOffset: result.next_page_offset,
			}
		} catch (error) {
			console.error("====================")
			console.error("Qdrant Scroll Error:")
			console.error("Collection:", params.collectionName)
			console.error("Params:", JSON.stringify(params, null, 2))
			console.error("Error:", error)
			console.error("Stack trace:")
			console.trace()
			throw error
		}
	}

	getClient() {
		return this.client
	}
}

let client: QdrantClientWrapper | null = null

export const getQdrantClient = () => {
	if (!client) {
		const url = process.env.QDRANT_URL || "http://localhost:6333"
		const apiKey = process.env.QDRANT_API_KEY
		client = new QdrantClientWrapper(url, apiKey)
	}
	return client
}

export const search = async <T = Record<string, any>>(params: {
	collectionName: string
	vector: number[] | { name: string; vector: number[] }
	filter?: Record<string, any>
	limit?: number
	offset?: number
	withPayload?: boolean | string[]
	withVector?: boolean | string[]
	scoreThreshold?: number
}) => {
	const client = getQdrantClient()
	return await client.search<T>(params)
}

export const retrieve = async <T = Record<string, any>>(params: {
	collectionName: string
	ids: (number | string)[]
	withPayload?: boolean | string[]
	withVector?: boolean | string[]
}) => {
	const client = getQdrantClient()
	return await client.retrieve<T>(params)
}

export const scroll = async <T = Record<string, any>>(params: {
	collectionName: string
	filter?: Record<string, any>
	limit?: number
	offset?: number | string
	withPayload?: boolean | string[]
	withVector?: boolean | string[]
}) => {
	const client = getQdrantClient()
	return await client.scroll<T>(params)
}

export const makePointId = (mediaType: MediaType, tmdbId: number): number => {
	const client = getQdrantClient()
	return client.makePointId(mediaType, tmdbId)
}

export const parsePointId = (
	pointId: number,
): { mediaType: MediaType; tmdbId: number } => {
	const client = getQdrantClient()
	return client.parsePointId(pointId)
}
