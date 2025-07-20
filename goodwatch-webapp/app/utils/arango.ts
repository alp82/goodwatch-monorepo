import http from "node:http"

interface ArangoQueryResponse<T> {
	id: string
	result: T[]
	code: number
	cached: boolean
	error: boolean
	count: number
	hasMore: boolean
	extra: {
		warnings: string[]
		stats: {
			writesExecuted: number
			writesIgnored: number
			documentLookups: number
			seeks: number
			scannedFull: number
			scannedIndex: number
			cursorsCreated: number
			cursorsRearmed: number
			cacheHits: number
			filtered: number
			httpRequests: number
			executionTime: number
			peakMemoryUsage: number
			intermediateCommits: number
		}
	}
}

class ArangoClient {
	private clusterUrls: string[]
	private auth: string
	private database: string

	constructor(config: {
		urls: string[]
		username: string
		password: string
		database: string
	}) {
		this.clusterUrls = config.urls
		this.auth = Buffer.from(`${config.username}:${config.password}`).toString(
			"base64",
		)
		this.database = config.database
	}

	private async request(
		path: string,
		method = "GET",
		data?: Record<string, unknown>,
	) {
		const randomUrl =
			this.clusterUrls[Math.floor(Math.random() * this.clusterUrls.length)]
		const url = new URL(randomUrl)
		const fullPath =
			this.database !== "_system" ? `/_db/${this.database}${path}` : path

		return new Promise((resolve, reject) => {
			const postData = data ? JSON.stringify(data) : ""

			const options = {
				hostname: url.hostname,
				port: Number(url.port) || 8529,
				path: fullPath,
				method: method,
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(postData),
					Authorization: `Basic ${this.auth}`,
				},
			}

			const req = http.request(options, (res) => {
				let responseData = ""
				res.on("data", (chunk) => {
					responseData += chunk
				})
				res.on("end", () => {
					try {
						const parsed = JSON.parse(responseData)
						if (parsed.error) {
							reject(
								new Error(
									`ArangoDB Error ${parsed.errorNum}: ${parsed.errorMessage}`,
								),
							)
						} else {
							resolve(parsed)
						}
					} catch (e) {
						resolve(responseData)
					}
				})
			})

			req.on("error", reject)
			if (postData) req.write(postData)
			req.end()
		})
	}

	async query<T extends Record<string, unknown>>(
		aql: string,
		bindVars?: Record<string, unknown>,
	): Promise<ArangoQueryResponse<T>> {
		return (await this.request("/_api/cursor", "POST", {
			query: aql,
			bindVars: bindVars || {},
			count: true,
			batchSize: 100,
		})) as ArangoQueryResponse<T>
	}

	async version() {
		return this.request("/_api/version", "GET")
	}
}

let client: ArangoClient | null = null

export const getArangoClient = () => {
	if (!client) {
		client = new ArangoClient({
			urls: (process.env.ARANGO_URLS || "").split(","),
			username: process.env.ARANGO_USER || "",
			password: process.env.ARANGO_PASS || "",
			database: process.env.ARANGO_DB || "",
		})
	}
	return client
}

export const query = async <T extends {}>(
	query: string,
	bindVars?: Record<string, unknown>,
): Promise<T[]> => {
	const client = getArangoClient()
	const response = await client.query<T>(query, bindVars)
	return response.result
}
