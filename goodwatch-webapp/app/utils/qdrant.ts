import { QdrantClient, RecommendStrategy, type Value } from "@qdrant/js-client-grpc"
import pc from "picocolors"

function decodeValue(value: Value): unknown {
	switch (value.kind.case) {
		case 'integerValue': return Number(value.kind.value)
		case 'nullValue': return null
		case 'listValue': return value.kind.value.values.map(decodeValue)
		case 'structValue': return Object.fromEntries(
			Object.entries(value.kind.value.fields).map(([key, child]) => [key, decodeValue(child)]),
		)
		default: return value.kind.value
	}
}

export const MEDIA_COLLECTION = "media_fingerprint_v1"

const QDRANT_TIMEOUT_MS = 10_000

type MediaType = "movie" | "show"

const MOVIE_BASE = 1_000_000_000_000
const SHOW_BASE = 2_000_000_000_000

class QdrantClientWrapper {
	private client: QdrantClient

	constructor(url: string, apiKey?: string) {
		this.client = new QdrantClient({
			url,
			apiKey,
			// The client's default is 300 s, which let a stalled call hold a page
			// render for minutes. Recommendation calls take about 40 ms in Qdrant.
			timeout: QDRANT_TIMEOUT_MS,
		})
	}

	makePointId(mediaType: MediaType, tmdbId: number): number {
		const tid = Number(tmdbId)
		if (!Number.isSafeInteger(tid) || tid < 0) {
			throw new Error("tmdb_id must be a non-negative safe integer")
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
		if (condition.is_empty) {
			return { conditionOneOf: { case: 'isEmpty', value: { key: condition.is_empty.key } } }
		}
		if (condition.has_id) {
			return { conditionOneOf: { case: 'hasId', value: {
				hasId: condition.has_id.map((id: number) => ({ pointIdOptions: { case: 'num', value: BigInt(id) } })),
			} } }
		}
		// Convert nested filters recursively.
		if (condition.should || condition.must || condition.must_not) {
			return { conditionOneOf: { case: 'filter', value: this.convertFilterToGrpc(condition) } }
		}

		// Handle field conditions (match, range, etc.)
		if (condition.key) {
			const fieldCondition: any = {
				key: condition.key,
			}

			// Handle match condition
			if (condition.match) {
				if (condition.match.value !== undefined) {
					// Check if the value is a number to use the correct match type
					const value = condition.match.value
					if (typeof value === 'number') {
						fieldCondition.match = {
							matchValue: { case: 'integer', value: value },
						}
					} else if (typeof value === 'boolean') {
						fieldCondition.match = { matchValue: { case: 'boolean', value } }
					} else {
						fieldCondition.match = {
							matchValue: { case: 'keyword', value: String(value) },
						}
					}
				} else if (condition.match.any !== undefined && Array.isArray(condition.match.any)) {
					// Handle "any" match - array of values to match against
					const values = condition.match.any
					if (values.length > 0 && typeof values[0] === 'number') {
						fieldCondition.match = {
							matchValue: { case: 'integers', value: { integers: values } },
						}
					} else {
						fieldCondition.match = {
							matchValue: { case: 'keywords', value: { strings: values.map(String) } },
						}
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
		strategy?: 'average_vector' | 'best_score' | 'sum_scores'
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

			// Read examples from Qdrant itself, rather than inferring their presence
			// from Crate metadata. Send vectors to avoid a lookup/deletion race.
			const using = params.using ?? 'fingerprint_v1'
			const seedIds = [...new Set([...params.positive, ...(params.negative ?? [])].map(Number))]
			if (seedIds.length === 0) return []
			const seeds = await this.client.api('points').get({
				collectionName: params.collectionName,
				ids: seedIds.map(id => ({ pointIdOptions: { case: 'num', value: BigInt(id) } })),
				withPayload: { selectorOptions: { case: 'enable', value: false } },
				withVectors: { selectorOptions: { case: 'include', value: { names: [using] } } },
			})
			const available = new Map<number, number[]>()
			for (const point of seeds.result) {
				const vectors = point.vectors?.vectorsOptions
				if (point.id?.pointIdOptions.case !== 'num' || vectors?.case !== 'vectors') continue
				const vector = vectors.value.vectors[using]
				const data = vector?.vector?.case === 'dense' ? vector.vector.value.data : vector?.data
				if (data?.length === 74 && data.every(Number.isFinite)) {
					available.set(Number(point.id.pointIdOptions.value), data)
				}
			}
			const examples = (ids: (number | string)[]) => ids.flatMap(id => {
				const data = available.get(Number(id))
				return data ? [{ data }] : []
			})
			const positiveVectors = examples(params.positive)
			const negativeVectors = examples(params.negative ?? [])
			const strategy = params.strategy ?? 'average_vector'
			if (positiveVectors.length === 0 && (strategy === 'average_vector' || negativeVectors.length === 0)) return []
			// Explicit vectors don't automatically exclude example points.
			const grpcFilter = this.convertFilterToGrpc({
				...params.filter,
				must_not: [...(params.filter?.must_not ?? []), { has_id: seedIds }],
			})

			const response = await this.client.api('points').recommend({
				collectionName: params.collectionName,
				positiveVectors,
				negativeVectors,
				using,
				strategy: { average_vector: RecommendStrategy.AverageVector, best_score: RecommendStrategy.BestScore, sum_scores: RecommendStrategy.SumScores }[strategy],
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
				
				const payload = Object.fromEntries(
					Object.entries(point.payload ?? {}).map(([key, value]) => [key, decodeValue(value)]),
				)

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

	async scroll<T = Record<string, any>>(params: {
		collectionName: string
		filter?: any
		limit?: number
		withPayload?: boolean | string[] | { include?: string[]; exclude?: string[] }
		withVector?: boolean | string[]
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

			// Convert filter from REST format to gRPC format
			let grpcFilter: any = undefined
			if (params.filter) {
				grpcFilter = this.convertFilterToGrpc(params.filter)
			}

			const response = await this.client.api('points').scroll({
				collectionName: params.collectionName,
				filter: grpcFilter,
				limit: params.limit ?? 100,
				withPayload: withPayloadSelector,
				withVectors: params.withVector ? { selectorOptions: { case: 'enable', value: true } } : undefined,
			})

			const result = response.result
			const duration = performance.now() - startTime
			const summary = `SCROLL ${params.collectionName}`
			const formattedLog = this.formatLog(summary, duration, result.length)
			console.log(formattedLog)

			if (duration >= 300) {
				this.logSlowQueryDetails('scroll', params, duration, result.length)
			}

			return result.map((point) => {
				const id = point.id?.pointIdOptions?.case === 'num' 
					? Number(point.id.pointIdOptions.value)
					: point.id?.pointIdOptions?.value
				
				const payload = Object.fromEntries(
					Object.entries(point.payload ?? {}).map(([key, value]) => [key, decodeValue(value)]),
				)

				return {
					id,
					payload: payload as T,
					vector: point.vectors,
				}
			})
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
	strategy?: 'average_vector' | 'best_score' | 'sum_scores',
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

export const scroll = async <T = Record<string, any>>(params: {
	collectionName: string
	filter?: any
	limit?: number
	withPayload?: boolean | string[] | { include?: string[]; exclude?: string[] }
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
