import { QdrantClient } from "@qdrant/js-client-rest"
import pc from "picocolors"

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
		const startTime = performance.now()
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

			const duration = performance.now() - startTime
			const vectorName = typeof params.vector === 'object' && 'name' in params.vector ? params.vector.name : 'default'
			const summary = `SEARCH ${params.collectionName} (${vectorName})`
			const formattedLog = this.formatLog(summary, duration, result.length)
			console.log(formattedLog)

			if (duration >= 300) {
				this.logSlowQueryDetails('search', params, duration, result.length)
			}

			return result.map((point: any) => ({
				id: point.id,
				score: point.score,
				payload: point.payload as T,
				vector: point.vector,
			}))
		} catch (error) {
			const duration = performance.now() - startTime
			const vectorName = typeof params.vector === 'object' && 'name' in params.vector ? params.vector.name : 'default'
			const summary = `SEARCH ${params.collectionName} (${vectorName})`
			const formattedLog = this.formatLog(summary, duration, 0, true)
			console.error("====================")
			console.error(formattedLog)
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
		const startTime = performance.now()
		try {
			const result = await this.client.retrieve(params.collectionName, {
				ids: params.ids,
				with_payload: params.withPayload ?? true,
				with_vector: params.withVector ?? false,
			})

			const duration = performance.now() - startTime
			const summary = `RETRIEVE ${params.collectionName}`
			const formattedLog = this.formatLog(summary, duration, result.length)
			console.log(formattedLog)

			if (duration >= 300) {
				this.logSlowQueryDetails('retrieve', params, duration, result.length)
			}

			return result.map((point: any) => ({
				id: point.id,
				payload: point.payload as T,
				vector: point.vector,
			}))
		} catch (error) {
			const duration = performance.now() - startTime
			const summary = `RETRIEVE ${params.collectionName}`
			const formattedLog = this.formatLog(summary, duration, 0, true)
			console.error("====================")
			console.error(formattedLog)
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
		const startTime = performance.now()
		try {
			const result = await this.client.scroll(params.collectionName, {
				filter: params.filter,
				limit: params.limit ?? 10,
				offset: params.offset,
				with_payload: params.withPayload ?? true,
				with_vector: params.withVector ?? false,
			})

			const duration = performance.now() - startTime
			const summary = `SCROLL ${params.collectionName}`
			const formattedLog = this.formatLog(summary, duration, result.points.length)
			console.log(formattedLog)

			if (duration >= 300) {
				this.logSlowQueryDetails('scroll', params, duration, result.points.length)
			}

			return {
				points: result.points.map((point: any) => ({
					id: point.id,
					payload: point.payload as T,
					vector: point.vector,
				})),
				nextOffset: result.next_page_offset,
			}
		} catch (error) {
			const duration = performance.now() - startTime
			const summary = `SCROLL ${params.collectionName}`
			const formattedLog = this.formatLog(summary, duration, 0, true)
			console.error("====================")
			console.error(formattedLog)
			console.error("Collection:", params.collectionName)
			console.error("Params:", JSON.stringify(params, null, 2))
			console.error("Error:", error)
			console.error("Stack trace:")
			console.trace()
			throw error
		}
	}

	private formatLog(summary: string, duration: number, resultCount: number, failed = false): string {
		const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
		const coloredDuration = this.colorDuration(duration, failed)
		const label = pc.dim(`[${pc.magentaBright('Qdrant')}]`)
		const status = failed ? pc.red('FAILED') : ''
		const count = !failed ? pc.dim(`(${resultCount} results)`) : ''
		return `${pc.dim(timestamp)} ${label} ${summary} ${count} ${status} ${coloredDuration}`
	}

	private colorDuration(duration: number, failed = false): string {
		const formatted = `${duration.toFixed(2)}ms`
		
		if (failed) {
			return pc.red(formatted)
		}
		
		if (duration < 50) {
			return pc.green(pc.bold(formatted))
		}
		if (duration < 100) {
			return pc.green(formatted)
		}
		if (duration < 300) {
			return pc.yellow(formatted)
		}
		if (duration < 1000) {
			return pc.red(formatted)
		}
		return pc.red(pc.bold(formatted))
	}

	private logSlowQueryDetails(operation: string, params: any, duration: number, resultCount: number): void {
		console.warn(pc.yellow('  ⚠ Slow query details:'))
		console.warn(pc.dim('  Operation:'), operation.toUpperCase())
		console.warn(pc.dim('  Collection:'), params.collectionName)
		
		if (operation === 'search') {
			const vectorName = typeof params.vector === 'object' && 'name' in params.vector ? params.vector.name : 'default'
			console.warn(pc.dim('  Vector:'), vectorName)
			if (params.limit) {
				console.warn(pc.dim('  Limit:'), params.limit)
			}
			if (params.filter) {
				console.warn(pc.dim('  Filter:'), JSON.stringify(params.filter).substring(0, 100))
			}
		} else if (operation === 'retrieve') {
			console.warn(pc.dim('  IDs count:'), params.ids.length)
		} else if (operation === 'scroll') {
			if (params.filter) {
				console.warn(pc.dim('  Filter:'), JSON.stringify(params.filter).substring(0, 100))
			}
			if (params.limit) {
				console.warn(pc.dim('  Limit:'), params.limit)
			}
		}
		
		console.warn(pc.dim('  Results:'), resultCount)
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
