import { QdrantClient } from "@qdrant/js-client-grpc"
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

	private convertFilterToGrpc(filter: any): any {
		if (!filter) return undefined

		const grpcFilter: any = {}

		// Convert 'must' conditions
		if (filter.must && Array.isArray(filter.must)) {
			grpcFilter.must = filter.must.map((condition: any) => this.convertConditionToGrpc(condition))
		}

		// Convert 'should' conditions
		if (filter.should && Array.isArray(filter.should)) {
			grpcFilter.should = filter.should.map((condition: any) => this.convertConditionToGrpc(condition))
		}

		// Convert 'must_not' conditions
		if (filter.must_not && Array.isArray(filter.must_not)) {
			grpcFilter.mustNot = filter.must_not.map((condition: any) => this.convertConditionToGrpc(condition))
		}

		return grpcFilter
	}

	private convertConditionToGrpc(condition: any): any {
		// Handle field conditions (match, range, etc.)
		if (condition.key) {
			const fieldCondition: any = {
				key: condition.key,
			}

			// Handle match condition
			if (condition.match) {
				if (condition.match.value !== undefined) {
					fieldCondition.match = {
						matchValue: { case: 'keyword', value: String(condition.match.value) },
					}
				}
			}

			// Handle range condition
			if (condition.range) {
				fieldCondition.range = {}
				if (condition.range.gte !== undefined) {
					fieldCondition.range.gte = condition.range.gte
				}
				if (condition.range.lte !== undefined) {
					fieldCondition.range.lte = condition.range.lte
				}
				if (condition.range.gt !== undefined) {
					fieldCondition.range.gt = condition.range.gt
				}
				if (condition.range.lt !== undefined) {
					fieldCondition.range.lt = condition.range.lt
				}
			}

			return {
				conditionOneOf: {
					case: 'field',
					value: fieldCondition,
				},
			}
		}

		// If it's already in gRPC format, return as-is
		return condition
	}


	async recommend<T = Record<string, any>>(params: {
		collectionName: string
		positive: (number | string)[]
		negative?: (number | string)[]
		using?: string
		filter?: any
		limit?: number
		offset?: number
		withPayload?: boolean | string[] | { include?: string[]; exclude?: string[] }
		withVector?: boolean | string[]
		scoreThreshold?: number
		hnswEf?: number
		exact?: boolean
	}) {
		const startTime = performance.now()
		try {
			// Convert withPayload to gRPC format
			let withPayloadSelector: any
			if (params.withPayload === true) {
				withPayloadSelector = { selectorOptions: { case: 'enable', value: true } }
			} else if (params.withPayload === false) {
				withPayloadSelector = { selectorOptions: { case: 'enable', value: false } }
			} else if (Array.isArray(params.withPayload)) {
				withPayloadSelector = {
					selectorOptions: {
						case: 'include',
						value: { fields: params.withPayload },
					},
				}
			} else if (params.withPayload && typeof params.withPayload === 'object') {
				if ('include' in params.withPayload && params.withPayload.include) {
					withPayloadSelector = {
						selectorOptions: {
							case: 'include',
							value: { fields: params.withPayload.include },
						},
					}
				}
			}

			// Convert positive IDs to gRPC format
			const positiveIds = params.positive.map(id => ({
				pointIdOptions: { case: 'num' as const, value: typeof id === 'bigint' ? id : BigInt(Number(id)) },
			}))

			// Convert negative IDs to gRPC format if provided
			const negativeIds = params.negative?.map(id => ({
				pointIdOptions: { case: 'num' as const, value: typeof id === 'bigint' ? id : BigInt(Number(id)) },
			}))

			// Convert filter from REST format to gRPC format
			let grpcFilter: any = undefined
			if (params.filter) {
				grpcFilter = this.convertFilterToGrpc(params.filter)
			}

			const response = await this.client.api('points').recommend({
				collectionName: params.collectionName,
				positive: positiveIds,
				negative: negativeIds,
				using: params.using,
				filter: grpcFilter,
				limit: params.limit ? BigInt(params.limit) : BigInt(10),
				offset: params.offset ? BigInt(params.offset) : undefined,
				withPayload: withPayloadSelector,
				withVectors: params.withVector ? { selectorOptions: { case: 'enable', value: true } } : undefined,
				scoreThreshold: params.scoreThreshold,
				params: {
					hnswEf: params.hnswEf ? BigInt(params.hnswEf) : BigInt(64),
					exact: params.exact ?? false,
				},
			})

			const result = response.result
			const duration = performance.now() - startTime
			const vectorName = params.using ?? 'default'
			const summary = `RECOMMEND ${params.collectionName} (${vectorName})`
			const formattedLog = this.formatLog(summary, duration, result.length)
			console.log(formattedLog)

			if (duration >= 300) {
				this.logSlowQueryDetails('recommend', params, duration, result.length)
			}

			return result.map((point) => {
				const id = point.id?.pointIdOptions?.case === 'num' 
					? Number(point.id.pointIdOptions.value)
					: point.id?.pointIdOptions?.value
				
				// Convert gRPC payload format to simple object
				const payload: any = {}
				if (point.payload) {
					for (const [key, value] of Object.entries(point.payload)) {
						const val = value as any
						if (val.kind) {
							switch (val.kind.case) {
								case 'stringValue':
									payload[key] = val.kind.value
									break
								case 'integerValue':
									payload[key] = Number(val.kind.value)
									break
								case 'doubleValue':
									payload[key] = val.kind.value
									break
								case 'boolValue':
									payload[key] = val.kind.value
									break
								case 'listValue':
									payload[key] = val.kind.value.values?.map((v: any) => {
										if (v.kind?.case === 'stringValue') return v.kind.value
										if (v.kind?.case === 'integerValue') return Number(v.kind.value)
										if (v.kind?.case === 'doubleValue') return v.kind.value
										return v.kind?.value
									})
									break
								case 'structValue':
									payload[key] = val.kind.value
									break
								default:
									payload[key] = val.kind?.value
							}
						}
					}
				}

				return {
					id,
					score: point.score,
					payload: payload as T,
					vector: point.vectors,
				}
			})
		} catch (error) {
			const duration = performance.now() - startTime
			const vectorName = params.using ?? 'default'
			const summary = `RECOMMEND ${params.collectionName} (${vectorName})`
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
		
		if (operation === 'recommend') {
			const vectorName = params.using ?? 'default'
			console.warn(pc.dim('  Vector:'), vectorName)
			console.warn(pc.dim('  Positive IDs:'), params.positive?.length ?? 0)
			if (params.negative?.length) {
				console.warn(pc.dim('  Negative IDs:'), params.negative.length)
			}
			if (params.filter) {
				console.warn(pc.dim('  Filter:'), JSON.stringify(params.filter).substring(0, 150))
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

export const recommend = async <T = Record<string, any>>(params: {
	collectionName: string
	positive: (number | string)[]
	negative?: (number | string)[]
	using?: string
	filter?: any
	limit?: number
	offset?: number
	withPayload?: boolean | string[] | { include?: string[]; exclude?: string[] }
	withVector?: boolean | string[]
	scoreThreshold?: number
	hnswEf?: number
	exact?: boolean
}) => {
	const client = getQdrantClient()
	return await client.recommend<T>(params)
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
