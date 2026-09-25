// A small Qdrant REST client for search: one POST /collections/{c}/points/query/batch per round.
//
// Why not the existing clients:
// - @qdrant/js-client-rest converts every JSON value and costs about 10 ms per batch, against about 1.4 ms of
//   Qdrant time.
// - undici and Node's fetch stall about 40 ms on Qdrant responses of 1.1 to 5.5 KB. node:http with keep-alive
//   doesn't.
import http from "node:http"
import https from "node:https"
import { assertSearchRankingEnabled } from "./mode.server.ts"

const DEFAULT_TIMEOUT_MS = 8000

/** One query of a batch, in Qdrant's Query API shape (https://api.qdrant.tech/api-reference/search/query-points). */
export type QdrantQuery = Record<string, unknown>

export interface ScoredPoint {
	id: number | string
	score: number
	version?: number
	payload?: Record<string, unknown> | null
	vector?: unknown
}

export interface QueryBatchResult {
	/** One list of points per query, in the order of the queries. */
	results: ScoredPoint[][]
	/** Qdrant's own processing time. */
	serverMs: number
	/** Time from sending the request until the parsed response. */
	wallMs: number
	responseBytes: number
}

interface Connection {
	base: URL
	headers: Record<string, string>
	transport: typeof http | typeof https
	agent: http.Agent
}

let connection: Connection | undefined

function getConnection(): Connection {
	if (!connection) {
		const base = new URL(process.env.QDRANT_URL || "http://localhost:6333")
		// QDRANT_URL names the gRPC port for the gRPC client. REST listens on 6333.
		if (base.port === "6334") base.port = "6333"
		const secure = base.protocol === "https:"
		const transport = secure ? https : http
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}
		if (process.env.QDRANT_API_KEY)
			headers["api-key"] = process.env.QDRANT_API_KEY
		connection = {
			base,
			headers,
			transport,
			agent: new transport.Agent({
				keepAlive: true,
				keepAliveMsecs: 1000,
				maxSockets: 16,
				noDelay: true,
			} as http.AgentOptions),
		}
	}
	return connection
}

function post(path: string, body: string, timeoutMs: number) {
	const { base, headers, transport, agent } = getConnection()
	return new Promise<{ status: number; body: Buffer }>((resolve, reject) => {
		const request = transport.request(
			{
				protocol: base.protocol,
				hostname: base.hostname,
				port: base.port,
				path: `${base.pathname.replace(/\/$/, "")}${path}`,
				method: "POST",
				agent,
				headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
			},
			(response) => {
				const chunks: Buffer[] = []
				response.on("data", (chunk: Buffer) => chunks.push(chunk))
				response.on("end", () =>
					resolve({
						status: response.statusCode ?? 0,
						body: Buffer.concat(chunks),
					}),
				)
				response.on("error", reject)
			},
		)
		request.setTimeout(timeoutMs, () =>
			request.destroy(
				new Error(`Qdrant request timed out after ${timeoutMs} ms`),
			),
		)
		request.on("error", reject)
		request.end(body)
	})
}

/** Runs several queries in one request and returns each query's points. */
export async function queryBatch(
	collection: string,
	queries: QdrantQuery[],
	options: { timeoutMs?: number } = {},
): Promise<QueryBatchResult> {
	assertSearchRankingEnabled("The Qdrant search client")
	const started = performance.now()
	const { status, body } = await post(
		`/collections/${encodeURIComponent(collection)}/points/query/batch`,
		JSON.stringify({ searches: queries }),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	)
	if (status !== 200) {
		throw new Error(
			`Qdrant query batch on ${collection} failed with HTTP ${status}: ${body.toString("utf8", 0, 500)}`,
		)
	}
	const parsed = JSON.parse(body.toString("utf8")) as {
		result: { points: ScoredPoint[] }[]
		time: number
	}
	return {
		results: parsed.result.map((r) => r.points),
		serverMs: parsed.time * 1000,
		wallMs: performance.now() - started,
		responseBytes: body.length,
	}
}
