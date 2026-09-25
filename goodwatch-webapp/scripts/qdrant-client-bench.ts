// Measures the client overhead of the Qdrant calls that live pages make today, to see whether undici's stall on
// small responses (see docs/implementation/search-ranking/README.md) or JSON and protobuf conversion slows them.
//
//   node scripts/qdrant-client-bench.ts [--live=<calls.jsonl>] [--related=<titles>] [--passes=2]
//
// --live:    replays recorded requests of the search's reading retrieval (combined-search/reading-retrieval.server.ts:
//            one `query` and one `retrieve` per call, JSON lines of { method, collection, body }) through
//            @qdrant/js-client-rest (undici, as the search does) and through node:http with keep-alive.
// --related: runs the related-titles requests of app/utils/qdrant.ts (the seed vector read, then `recommend` with
//            100 results and the related-titles payload) for that many popular titles, through
//            @qdrant/js-client-grpc (as the pages do) and through node:http.
//
// Client overhead is wall time minus the time Qdrant reports for the request. Read-only. Qdrant settings come from
// QDRANT_URL and QDRANT_API_KEY, as in the webapp. Prints one JSON object.
import http from "node:http"
import https from "node:https"
import { readFileSync } from "node:fs"
import { QdrantClient as RestClient } from "@qdrant/js-client-rest"
import {
	QdrantClient as GrpcClient,
	RecommendStrategy,
} from "@qdrant/js-client-grpc"

const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const PASSES = Number(arg("passes") ?? "2")
const COLLECTION = "media_fingerprint_v1"

const rest = new URL(process.env.QDRANT_URL || "http://localhost:6333")
if (rest.port === "6334") rest.port = "6333"
const grpc = new URL(rest)
grpc.port = "6334"
const apiKey = process.env.QDRANT_API_KEY

// node:http with keep-alive, as app/server/search-ranking/qdrant-http.server.ts.
const transport = rest.protocol === "https:" ? https : http
const agent = new transport.Agent({
	keepAlive: true,
	maxSockets: 16,
	noDelay: true,
} as http.AgentOptions)
function post(path: string, body: unknown) {
	const text = JSON.stringify(body)
	return new Promise<{ time: number; result: unknown; bytes: number }>(
		(resolve, reject) => {
			const request = transport.request(
				{
					hostname: rest.hostname,
					port: rest.port,
					path,
					method: "POST",
					agent,
					headers: {
						"Content-Type": "application/json",
						"Content-Length": Buffer.byteLength(text),
						...(apiKey ? { "api-key": apiKey } : {}),
					},
				},
				(response) => {
					const chunks: Buffer[] = []
					response.on("data", (c: Buffer) => chunks.push(c))
					response.on("end", () => {
						const raw = Buffer.concat(chunks)
						if (response.statusCode !== 200)
							return reject(
								new Error(
									`HTTP ${response.statusCode}: ${raw.toString().slice(0, 300)}`,
								),
							)
						const parsed = JSON.parse(raw.toString("utf8"))
						resolve({
							time: parsed.time,
							result: parsed.result,
							bytes: raw.length,
						})
					})
					response.on("error", reject)
				},
			)
			request.on("error", reject)
			request.end(text)
		},
	)
}

interface Sample {
	wall: number
	server: number
	bytes?: number
}
const samples = new Map<string, Sample[]>()
async function timed(
	label: string,
	run: () => Promise<{ time: number; bytes?: number }>,
) {
	const started = performance.now()
	const { time, bytes } = await run()
	const wall = performance.now() - started
	const list = samples.get(label) ?? []
	list.push({ wall, server: time * 1000, bytes })
	samples.set(label, list)
}
const pct = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b)
	return (
		Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10
	)
}
function summary() {
	return Object.fromEntries(
		[...samples].map(([label, list]) => {
			const overhead = list.map((s) => s.wall - s.server)
			return [
				label,
				{
					n: list.length,
					responseKbP50:
						list[0].bytes === undefined
							? null
							: pct(
									list.map((s) => (s.bytes ?? 0) / 1024),
									0.5,
								),
					wallP50: pct(
						list.map((s) => s.wall),
						0.5,
					),
					wallP95: pct(
						list.map((s) => s.wall),
						0.95,
					),
					serverP50: pct(
						list.map((s) => s.server),
						0.5,
					),
					serverP95: pct(
						list.map((s) => s.server),
						0.95,
					),
					overheadP50: pct(overhead, 0.5),
					overheadP95: pct(overhead, 0.95),
					overheadMax: pct(overhead, 1),
					over30ms: overhead.filter((o) => o > 30).length,
				},
			]
		}),
	)
}

// --- Search: reading retrieval ------------------------------------------------------------------------------------

const restClient = new RestClient({
	url: rest.toString().replace(/\/$/, ""),
	apiKey,
	checkCompatibility: false,
	timeout: 8000,
})
const openApi = restClient.api()
type LiveCall = {
	method: "query" | "retrieve"
	collection: string
	body: Record<string, unknown>
}
async function live(file: string) {
	const calls = readFileSync(file, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l) as LiveCall)
	const viaRest = (c: LiveCall) =>
		c.method === "query"
			? openApi.queryPoints({
					collection_name: c.collection,
					...c.body,
				} as never)
			: openApi.getPoints({ collection_name: c.collection, ...c.body } as never)
	const viaHttp = (c: LiveCall) =>
		post(
			`/collections/${c.collection}/points${c.method === "query" ? "/query" : ""}`,
			c.body,
		)
	for (const c of calls.slice(0, 10))
		await Promise.all([viaRest(c), viaHttp(c)])
	for (let pass = 0; pass < PASSES; pass++)
		for (const [i, c] of calls.entries()) {
			// Alternate which client goes first, so neither always meets a warm Qdrant cache.
			const runs = [
				() =>
					timed(`search ${c.method} js-client-rest`, async () => {
						const r = await viaRest(c)
						return { time: (r.data as { time: number }).time }
					}),
				() => timed(`search ${c.method} node:http`, () => viaHttp(c)),
			]
			for (const run of (i + pass) % 2 ? runs.reverse() : runs) await run()
		}
}

// --- Related titles ------------------------------------------------------------------------------------------------

const PAYLOAD = [
	"tmdb_id",
	"media_type",
	"title",
	"release_year",
	"poster_path",
	"backdrop_path",
	"goodwatch_overall_score_voting_count",
	"goodwatch_overall_score_normalized_percent",
	"tmdb_user_score_normalized_percent",
	"tmdb_user_score_rating_count",
	"imdb_user_score_normalized_percent",
	"imdb_user_score_rating_count",
	"metacritic_user_score_normalized_percent",
	"metacritic_user_score_rating_count",
	"metacritic_meta_score_normalized_percent",
	"metacritic_meta_score_review_count",
	"rotten_tomatoes_audience_score_normalized_percent",
	"rotten_tomatoes_audience_score_rating_count",
	"rotten_tomatoes_tomato_score_normalized_percent",
	"rotten_tomatoes_tomato_score_review_count",
	"goodwatch_user_score_normalized_percent",
	"goodwatch_user_score_rating_count",
	"goodwatch_official_score_normalized_percent",
	"goodwatch_official_score_review_count",
	"streaming_availability",
]
async function related(titles: number) {
	const grpcClient = new GrpcClient({
		url: grpc.toString().replace(/\/$/, ""),
		apiKey,
		timeout: 10_000,
	})
	const points = grpcClient.api("points")
	const seeds = (
		(
			await post(`/collections/${COLLECTION}/points/scroll`, {
				limit: titles,
				with_payload: ["media_type", "tmdb_id"],
				filter: {
					must: [
						{
							key: "goodwatch_overall_score_voting_count",
							range: { gte: 20000 },
						},
					],
				},
			})
		).result as {
			points: { id: number; payload: { media_type: string; tmdb_id: number } }[]
		}
	).points
	// The filter of app/server/related.server.ts for a title without a fingerprint key or streaming filter.
	const filterOf = (seed: (typeof seeds)[number]) => ({
		must: [
			{ key: "goodwatch_overall_score_voting_count", range: { gte: 10000 } },
			{ key: "goodwatch_overall_score_normalized_percent", range: { gte: 60 } },
			{ key: "media_type", match: { value: seed.payload.media_type } },
		],
		mustNot: [
			{ key: "tmdb_id", match: { value: seed.payload.tmdb_id } },
			{ has_id: [seed.id] },
		],
	})
	const grpcField = (key: string, match: unknown, range?: unknown) => ({
		conditionOneOf: {
			case: "field",
			value: { key, ...(match ? { match } : {}), ...(range ? { range } : {}) },
		},
	})
	const grpcFilter = (seed: (typeof seeds)[number]) => ({
		must: [
			grpcField("goodwatch_overall_score_voting_count", null, { gte: 10000 }),
			grpcField("goodwatch_overall_score_normalized_percent", null, {
				gte: 60,
			}),
			grpcField("media_type", {
				matchValue: { case: "keyword", value: seed.payload.media_type },
			}),
		],
		mustNot: [
			grpcField("tmdb_id", {
				matchValue: { case: "integer", value: seed.payload.tmdb_id },
			}),
			{
				conditionOneOf: {
					case: "hasId",
					value: {
						hasId: [
							{ pointIdOptions: { case: "num", value: BigInt(seed.id) } },
						],
					},
				},
			},
		],
	})
	const viaGrpc = async (seed: (typeof seeds)[number]) => {
		let vector: number[] = []
		await timed("related seed read js-client-grpc", async () => {
			const r = await points.get({
				collectionName: COLLECTION,
				ids: [{ pointIdOptions: { case: "num", value: BigInt(seed.id) } }],
				withPayload: { selectorOptions: { case: "enable", value: false } },
				withVectors: {
					selectorOptions: {
						case: "include",
						value: { names: ["fingerprint_v1"] },
					},
				},
			} as never)
			const v = (r.result[0]?.vectors?.vectorsOptions as any)?.value?.vectors
				?.fingerprint_v1
			vector = v?.vector?.case === "dense" ? v.vector.value.data : v?.data
			return { time: r.time }
		})
		await timed("related recommend js-client-grpc", async () => {
			const r = await points.recommend({
				collectionName: COLLECTION,
				positiveVectors: [{ data: vector }],
				negativeVectors: [],
				using: "fingerprint_v1",
				strategy: RecommendStrategy.AverageVector,
				filter: grpcFilter(seed),
				limit: BigInt(100),
				withPayload: {
					selectorOptions: { case: "include", value: { fields: PAYLOAD } },
				},
				params: { hnswEf: BigInt(64), exact: false },
			} as never)
			// The pages decode every payload value, which is part of the client's cost.
			for (const p of r.result) void Object.keys(p.payload ?? {})
			return { time: r.time }
		})
	}
	const viaHttp = async (seed: (typeof seeds)[number]) => {
		let vector: number[] = []
		await timed("related seed read node:http", async () => {
			const r = await post(`/collections/${COLLECTION}/points`, {
				ids: [seed.id],
				with_payload: false,
				with_vector: ["fingerprint_v1"],
			})
			vector = (r.result as { vector: { fingerprint_v1: number[] } }[])[0]
				.vector.fingerprint_v1
			return r
		})
		await timed("related recommend node:http", () =>
			post(`/collections/${COLLECTION}/points/recommend`, {
				positive: [vector],
				using: "fingerprint_v1",
				strategy: "average_vector",
				filter: { must: filterOf(seed).must, must_not: filterOf(seed).mustNot },
				limit: 100,
				with_payload: PAYLOAD,
				params: { hnsw_ef: 64, exact: false },
			}),
		)
	}
	for (const seed of seeds.slice(0, 10)) {
		await viaGrpc(seed)
		await viaHttp(seed)
	}
	samples.clear()
	for (let pass = 0; pass < PASSES; pass++)
		for (const [i, seed] of seeds.entries()) {
			const runs = [() => viaGrpc(seed), () => viaHttp(seed)]
			for (const run of (i + pass) % 2 ? runs.reverse() : runs) await run()
		}
	return samples
}

const liveFile = arg("live")
const relatedTitles = Number(arg("related") ?? "0")
const out: Record<string, unknown> = {
	passes: PASSES,
	startedAt: new Date().toISOString(),
}
if (relatedTitles) {
	await related(relatedTitles)
	out.related = summary()
	samples.clear()
}
if (liveFile) {
	await live(liveFile)
	out.search = summary()
}
out.finishedAt = new Date().toISOString()
console.log(JSON.stringify(out, null, 1))
process.exit(0)
