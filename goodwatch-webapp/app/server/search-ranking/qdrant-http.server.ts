// A small Qdrant REST client for search: one POST /collections/{c}/points/query/batch per ranking round, and
// `retrievePoints` for the display fields of the ranked titles (describeTitles in
// combined-search/reading-retrieval.server.ts).
//
// Why not the existing clients:
// - @qdrant/js-client-rest converts every JSON value and costs about 10 ms per batch, against about 1.4 ms of
//   Qdrant time.
// - undici and Node's fetch stall about 40 ms on Qdrant responses of 1.1 to 5.5 KB. node:http with keep-alive
//   doesn't.
// - On large responses (200 KB to 1 MB), @qdrant/js-client-rest's JSON reviver cost about 70 ms per query and 36 ms
//   per retrieve at the median on the webapp host (#147).
import { BackendTimeoutError } from "../../utils/backend-timeout.ts"
import { randomUUID } from "node:crypto"
import http from "node:http"
import https from "node:https"

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

interface HttpPhases {
	socketMs: number | null
	dnsMs: number | null
	connectMs: number | null
	secureConnectMs: number | null
	headersMs: number | null
	responseEndMs: number | null
	reusedSocket: boolean
}

function post(
	path: string,
	body: string,
	timeoutMs: number,
	phases?: HttpPhases,
	started = performance.now(),
) {
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
				if (phases) phases.headersMs = performance.now() - started
				const chunks: Buffer[] = []
				response.on("data", (chunk: Buffer) => chunks.push(chunk))
				response.on("end", () => {
					if (phases) phases.responseEndMs = performance.now() - started
					resolve({
						status: response.statusCode ?? 0,
						body: Buffer.concat(chunks),
					})
				})
				response.on("error", reject)
			},
		)
		if (phases)
			request.on("socket", (socket) => {
				phases.socketMs = performance.now() - started
				phases.reusedSocket = request.reusedSocket
				if (!request.reusedSocket && socket.connecting) {
					socket.once("lookup", () => {
						phases.dnsMs = performance.now() - started
					})
					socket.once("connect", () => {
						phases.connectMs = performance.now() - started
					})
					socket.once("secureConnect", () => {
						phases.secureConnectMs = performance.now() - started
					})
				}
			})
		request.setTimeout(timeoutMs, () =>
			request.destroy(
				new BackendTimeoutError(
					"Qdrant",
					timeoutMs,
					`Qdrant request timed out after ${timeoutMs} ms`,
				),
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
	const started = performance.now()
	const phases: HttpPhases = {
		socketMs: null,
		dnsMs: null,
		connectMs: null,
		secureConnectMs: null,
		headersMs: null,
		responseEndMs: null,
		reusedSocket: false,
	}
	let status: "completed" | "failed" = "failed"
	let reason:
		| "none"
		| "transport"
		| "timeout"
		| "http_status"
		| "invalid_response" = "transport"
	let httpStatus: number | null = null
	let parseMs: number | null = null
	let serverMs: number | null = null
	let responseBytes = 0
	const id = randomUUID()
	try {
		const response = await post(
			`/collections/${encodeURIComponent(collection)}/points/query/batch`,
			JSON.stringify({ searches: queries }),
			options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			phases,
			started,
		)
		httpStatus = response.status
		responseBytes = response.body.length
		if (httpStatus !== 200) {
			reason = "http_status"
			throw new Error(
				`Qdrant query batch on ${collection} failed with HTTP ${httpStatus}: ${response.body.toString("utf8", 0, 500)}`,
			)
		}
		reason = "invalid_response"
		const parseStarted = performance.now()
		const parsed = JSON.parse(response.body.toString("utf8")) as {
			result: { points: ScoredPoint[] }[]
			time: number
		}
		const results = parsed.result.map((r) => r.points)
		parseMs = performance.now() - parseStarted
		serverMs =
			Number.isFinite(parsed.time) && parsed.time >= 0
				? parsed.time * 1000
				: null
		status = "completed"
		reason = "none"
		return {
			results,
			serverMs: parsed.time * 1000,
			wallMs: performance.now() - started,
			responseBytes,
		}
	} catch (error) {
		if (error instanceof BackendTimeoutError) reason = "timeout"
		throw error
	} finally {
		try {
			console.info(
				JSON.stringify({
					event: "search.qdrant-http.v1",
					at: new Date().toISOString(),
					id,
					role: process.env.WEBAPP_ROLE === "search" ? "search" : "page",
					commit: /^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? "")
						? process.env.SOURCE_COMMIT
						: null,
					kind: "query_batch",
					status,
					reason,
					httpStatus,
					queryCount: queries.length,
					...phases,
					parseMs,
					serverMs,
					responseBytes,
					totalMs: performance.now() - started,
				}),
			)
		} catch {
			/* Logging must not change a ranking response or rejection. */
		}
	}
}

async function postJson<T>(
	path: string,
	body: unknown,
	timeoutMs: number,
): Promise<T> {
	const { status, body: raw } = await post(
		path,
		JSON.stringify(body),
		timeoutMs,
	)
	if (status !== 200) {
		throw new Error(
			`Qdrant request ${path} failed with HTTP ${status}: ${raw.toString("utf8", 0, 500)}`,
		)
	}
	return (JSON.parse(raw.toString("utf8")) as { result: T }).result
}

/** Points by id: POST /collections/{c}/points. Returns what @qdrant/js-client-rest's `retrieve` returns. */
export function retrievePoints(
	collection: string,
	request: {
		ids: (number | string)[]
		with_payload?: boolean | string[]
		with_vector?: boolean | string[]
	},
	options: { timeoutMs?: number } = {},
): Promise<
	{
		id: number | string
		payload?: Record<string, unknown> | null
		vector?: unknown
	}[]
> {
	return postJson(
		`/collections/${encodeURIComponent(collection)}/points`,
		// The default of @qdrant/js-client-rest's `retrieve`.
		{ with_payload: true, ...request },
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	)
}
