// Loads the search indexes that f/search/build_indexes writes to Crate, and keeps them current.
//
// A build is ten gzipped JSON files in the blob table `search_index_files`, listed by the manifest in the
// `search_index_builds` row `build_id = 'current'`. The loader downloads every file, checks its SHA-1, parses it into
// typed tables, and swaps the new build in only when all files have loaded, so a search never sees two builds at once.
// It checks the current row every few minutes and loads a new build in the background.
//
// Nothing loads while SEARCH_RANKING_MODE is off. Formats: "Index files" in docs/implementation/search-ranking/README.md.
import { createHash } from "node:crypto"
import http from "node:http"
import { promisify } from "node:util"
import { gunzip as gunzipCallback } from "node:zlib"
import { assertSearchRankingEnabled } from "./mode.server.ts"
import { normalized } from "./text-rules.server.ts"

const gunzip = promisify(gunzipCallback)

const CHECK_EVERY_MS = 5 * 60_000
const RETRY_AFTER_MS = 60_000
const REQUEST_TIMEOUT_MS = 60_000
const INDEX_FILES = [
	"title_table",
	"term_statistics",
	"word_frequencies",
	"collocations",
	"name_index",
	"peers",
	"negation_labels",
	"alternate_cuts",
	"intent_examples",
	"mix_vectors",
] as const
type IndexFile = (typeof INDEX_FILES)[number]

// Votes a title needs to be a "like X" reference.
const REFERENCE_TITLE_VOTES = 10_000
// Votes a title needs to belong to a franchise ("like X" pulls in the titles containing X's title).
const FRANCHISE_VOTES = 2000

export interface Manifest {
	format: number
	build_id: string
	created_at: string
	previous_build_id: string | null
	files: Record<string, { sha1: string; bytes: number }>
	profiles: { collection: string; points: number }
}

/** The eligible titles, one row each, in point id order. */
export interface TitleTable {
	size: number
	pointIds: number[]
	titles: string[]
	originalTitles: string[]
	/** 0 when unknown. */
	years: Int32Array
	votes: Float64Array
	/** NaN when unknown. */
	goodwatchScores: Float64Array
	popularity: Float64Array
	imdbIds: (string | null)[]
	flagNames: string[]
	/** Bit i is set when flagNames[i] is true. */
	flags: Int32Array
	productionMethods: (string | null)[]
	rowOf: Map<number, number>
}

export interface TermStatistics {
	/** Eligible titles. */
	n: number
	terms: string[]
	/** The terms_bm25f_v1 index of each term. */
	ids: Int32Array
	df: Int32Array
	indexOf: Map<string, number>
	/** Term ids in ascending order, and the term index of each: the reverse lookup for fetched sparse vectors. */
	sortedIds: Int32Array
	sortedIdTerm: Int32Array
}

export interface WordFrequencies {
	df: Map<string, number>
	/** Frequent words made only of letters, in file order, grouped by length for spell correction. */
	spellVocabulary: string[]
	spellByLength: Map<number, number[]>
}

export interface NameEntity {
	/** The search_reference_profiles point id. */
	id: string
	kind: "person" | "team" | "studio"
	name: string
	/** p:<person id>, c:<company id>, n:<network id>. */
	members: string[]
	mass: number
	/** Point id -> credit weight: 1 for a main credit, 0.5 for a minor one. */
	titles: Map<number, number>
	codirected: number[]
	mention: string[]
}

export interface NameIndex {
	/** Resolving key -> entity index. */
	entityOf: Map<string, number>
	entities: NameEntity[]
	/** Keys with a space (full names), sorted: the typo-matching targets. */
	fullNames: string[]
}

export interface Peers {
	members: string[]
	/** Row-major [n, 74] fingerprint centroids. */
	fingerprints: Float32Array
	dim: number
	titles: number[][]
}

export interface NegationLabels {
	/** Point ids per label. */
	titles: number[][]
	/** Content stem -> the labels that hold it. */
	labelsWithStem: Map<string, number[]>
}

export interface QuantizedVectors {
	dim: number
	scale: Float32Array
	/** Row-major [titles, dim]; vector = values x scale. */
	values: Int8Array
}

export interface IntentExamples {
	labels: string[]
	dim: number
	/** Row-major [examples, dim], multilingual-e5-small of "query: " + the example. */
	vectors: Float32Array
}

export interface SearchIndex {
	buildId: string
	manifest: Manifest
	loadedAt: Date
	titleTable: TitleTable
	termStatistics: TermStatistics
	words: WordFrequencies
	/** Bigram terms whose adjacent words form one facet unit. */
	collocations: Set<string>
	names: NameIndex
	peers: Peers
	negationLabels: NegationLabels
	/** Point id -> the point ids of its alternate cuts. */
	alternateCuts: Map<number, Set<number>>
	intents: IntentExamples
	/** Rows aligned with the title table. */
	mixVectors: { multilingual: QuantizedVectors; english: QuantizedVectors }
	/** Normalized title (also without a leading "the") -> the row with the most votes, for "like X". */
	referenceTitles: Map<string, number>
	/** Padded normalized titles (" title ", " original ") per row, for franchises. */
	franchiseTitles: { row: number; title: string; original: string }[]
	/** Normalized titles and original titles with their rows, for fuzzy title matching. */
	titleNames: { name: string; row: number }[]
	/** Load time per file and in total. */
	timings: Record<string, number>
}

// --- Crate access -------------------------------------------------------------------------------------------------

class BlobMissing extends Error {}

function crateConfig() {
	const hosts = (process.env.CRATE_HOSTS ?? "")
		.split(",")
		.map((h) => h.trim())
		.filter(Boolean)
	if (!hosts.length) throw new Error("CRATE_HOSTS is not set")
	return {
		hosts,
		port: Number(process.env.CRATE_PORT || "4200"),
		auth: `Basic ${Buffer.from(`${process.env.CRATE_USER || ""}:${process.env.CRATE_PASS || ""}`).toString("base64")}`,
	}
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 8 })

function request(
	url: URL,
	method: "GET" | "POST",
	headers: Record<string, string>,
	body?: string,
): Promise<{
	status: number
	headers: http.IncomingHttpHeaders
	body: Buffer
}> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			url,
			{
				method,
				agent,
				headers: body
					? { ...headers, "Content-Length": Buffer.byteLength(body) }
					: headers,
			},
			(res) => {
				const chunks: Buffer[] = []
				res.on("data", (chunk: Buffer) => chunks.push(chunk))
				res.on("end", () =>
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						body: Buffer.concat(chunks),
					}),
				)
				res.on("error", reject)
			},
		)
		req.setTimeout(REQUEST_TIMEOUT_MS, () =>
			req.destroy(new Error(`Crate request timed out: ${url.pathname}`)),
		)
		req.on("error", reject)
		req.end(body)
	})
}

async function readManifest(): Promise<Manifest> {
	const { hosts, port, auth } = crateConfig()
	let lastError: unknown
	for (const host of hosts) {
		try {
			const res = await request(
				new URL(`http://${host}:${port}/_sql`),
				"POST",
				{ "Content-Type": "application/json", Authorization: auth },
				JSON.stringify({
					stmt: "SELECT manifest FROM search_index_builds WHERE build_id = 'current'",
				}),
			)
			if (res.status !== 200)
				throw new Error(`Crate answered HTTP ${res.status}`)
			const rows = (
				JSON.parse(res.body.toString("utf8")) as { rows: unknown[][] }
			).rows
			if (!rows.length) throw new Error("No current search index build")
			const raw = rows[0][0]
			return (typeof raw === "string" ? JSON.parse(raw) : raw) as Manifest
		} catch (error) {
			lastError = error
		}
	}
	throw lastError
}

/** One blob, following the redirect of a node that doesn't hold it, checked against its SHA-1. */
async function readBlob(sha1: string): Promise<Buffer> {
	const { hosts, port, auth } = crateConfig()
	let url = new URL(
		`http://${hosts[0]}:${port}/_blobs/search_index_files/${sha1}`,
	)
	for (let hop = 0; hop < 4; hop++) {
		const res = await request(url, "GET", { Authorization: auth })
		if (res.status === 307 || res.status === 301 || res.status === 302) {
			const location = res.headers.location
			if (!location) throw new Error("Crate redirect without a location")
			url = new URL(location, url)
			continue
		}
		if (res.status === 404) throw new BlobMissing(`Index file ${sha1} is gone`)
		if (res.status !== 200)
			throw new Error(`Crate blob ${sha1} answered HTTP ${res.status}`)
		const digest = createHash("sha1").update(res.body).digest("hex")
		if (digest !== sha1)
			throw new Error(`Index file ${sha1} has the wrong SHA-1 ${digest}`)
		return res.body
	}
	throw new Error(`Too many redirects for index file ${sha1}`)
}

// --- Decoding -----------------------------------------------------------------------------------------------------

interface Matrix {
	shape: [number, number] | [number]
	float32?: string
	int8?: string
}

function float32(m: Matrix): Float32Array {
	const bytes = Buffer.from(m.float32 as string, "base64")
	// Copy into an aligned buffer: base64 decoding may return a pooled, unaligned slice.
	const out = new Float32Array(bytes.length / 4)
	new Uint8Array(out.buffer).set(bytes)
	return out
}

function int8(m: Matrix): Int8Array {
	const bytes = Buffer.from(m.int8 as string, "base64")
	return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length).slice()
}

// biome-ignore lint/suspicious/noExplicitAny: parsed JSON documents
type Json = any

function titleTable(d: Json): TitleTable {
	const pointIds = d.point_ids as number[]
	const rowOf = new Map<number, number>()
	pointIds.forEach((id, row) => rowOf.set(id, row))
	return {
		size: pointIds.length,
		pointIds,
		titles: d.titles,
		originalTitles: d.original_titles,
		years: Int32Array.from(d.years as number[]),
		votes: Float64Array.from(d.votes as number[]),
		goodwatchScores: Float64Array.from(
			(d.goodwatch_scores as (number | null)[]).map((x) => x ?? Number.NaN),
		),
		popularity: Float64Array.from(d.popularity as number[]),
		imdbIds: (d.imdb_ids as (string | null)[]).map((x) => x?.trim() || null),
		flagNames: d.flag_names,
		flags: Int32Array.from(d.flags as number[]),
		productionMethods: d.production_methods,
		rowOf,
	}
}

function termStatistics(d: Json): TermStatistics {
	const terms = d.terms as string[]
	const ids = Int32Array.from(d.ids as number[])
	const indexOf = new Map<string, number>()
	terms.forEach((t, i) => indexOf.set(t, i))
	const order = Array.from(ids.keys()).sort((a, b) => ids[a] - ids[b])
	return {
		n: d.n,
		terms,
		ids,
		df: Int32Array.from(d.df as number[]),
		indexOf,
		sortedIds: Int32Array.from(order, (i) => ids[i]),
		sortedIdTerm: Int32Array.from(order),
	}
}

function wordFrequencies(d: Json): WordFrequencies {
	const df = new Map<string, number>()
	;(d.words as string[]).forEach((w, i) => df.set(w, d.df[i]))
	const spellVocabulary = d.spell_vocabulary as string[]
	const spellByLength = new Map<number, number[]>()
	spellVocabulary.forEach((w, i) => {
		const list = spellByLength.get(w.length) ?? []
		list.push(i)
		spellByLength.set(w.length, list)
	})
	return { df, spellVocabulary, spellByLength }
}

function nameIndex(d: Json): NameIndex {
	const entityOf = new Map<string, number>()
	;(d.keys as string[]).forEach((k, i) => entityOf.set(k, d.entity[i]))
	return {
		entityOf,
		entities: (d.entities as Json[]).map((e) => ({
			id: e.id,
			kind: e.kind,
			name: e.name,
			members: e.members,
			mass: e.mass,
			titles: new Map(e.titles as [number, number][]),
			codirected: e.codirected,
			mention: e.mention,
		})),
		fullNames: (d.keys as string[]).filter((k) => k.includes(" ")),
	}
}

function negationLabels(d: Json): NegationLabels {
	const labelsWithStem = new Map<string, number[]>()
	;(d.stems as string[][]).forEach((stems, label) => {
		for (const s of stems) {
			const list = labelsWithStem.get(s) ?? []
			list.push(label)
			labelsWithStem.set(s, list)
		}
	})
	return { titles: d.titles, labelsWithStem }
}

function alternateCuts(d: Json): Map<number, Set<number>> {
	const out = new Map<number, Set<number>>()
	for (const [a, b] of d.pairs as [number, number][]) {
		if (!out.has(a)) out.set(a, new Set())
		if (!out.has(b)) out.set(b, new Set())
		out.get(a)?.add(b)
		out.get(b)?.add(a)
	}
	return out
}

function quantized(d: Json): QuantizedVectors {
	const scale = float32(d.scale)
	return { dim: scale.length, scale, values: int8(d.values) }
}

function derivedTitles(t: TitleTable) {
	const referenceTitles = new Map<string, number>()
	const franchiseTitles: SearchIndex["franchiseTitles"] = []
	const titleNames: SearchIndex["titleNames"] = []
	for (let row = 0; row < t.size; row++) {
		const names = [...new Set([t.titles[row], t.originalTitles[row]])]
		if (t.votes[row] >= REFERENCE_TITLE_VOTES) {
			for (const name of names) {
				const n = normalized(name)
				const keys = new Set([n, n.startsWith("the ") ? n.slice(4) : n])
				for (const key of keys) {
					const current = referenceTitles.get(key)
					if (key && (current === undefined || t.votes[row] > t.votes[current]))
						referenceTitles.set(key, row)
				}
			}
		}
		if (t.votes[row] >= FRANCHISE_VOTES)
			franchiseTitles.push({
				row,
				title: ` ${normalized(t.titles[row])} `,
				original: ` ${normalized(t.originalTitles[row])} `,
			})
		for (const name of names) {
			const n = normalized(name)
			if (n) titleNames.push({ name: n, row })
		}
	}
	return { referenceTitles, franchiseTitles, titleNames }
}

async function loadBuild(manifest: Manifest): Promise<SearchIndex> {
	const started = performance.now()
	const timings: Record<string, number> = {}
	const docs = {} as Record<IndexFile, Json>
	await Promise.all(
		INDEX_FILES.map(async (name) => {
			const file = manifest.files[name]
			if (!file)
				throw new Error(`Search index build ${manifest.build_id} lacks ${name}`)
			const t = performance.now()
			const gz = await readBlob(file.sha1)
			docs[name] = JSON.parse((await gunzip(gz)).toString("utf8"))
			timings[name] = performance.now() - t
		}),
	)
	const title = titleTable(docs.title_table)
	const mix = docs.mix_vectors
	const mixIds = mix.point_ids as number[]
	if (
		mixIds.length !== title.size ||
		mixIds.some((id: number, i: number) => id !== title.pointIds[i])
	)
		throw new Error("mix_vectors rows don't match the title table")
	const peers = docs.peers
	const peerFingerprints = float32(peers.fingerprints)
	const intents = docs.intent_examples
	if (!intents.vectors) throw new Error("intent_examples has no vectors")
	const intentVectors = float32(intents.vectors)
	const index: SearchIndex = {
		buildId: manifest.build_id,
		manifest,
		loadedAt: new Date(),
		titleTable: title,
		termStatistics: termStatistics(docs.term_statistics),
		words: wordFrequencies(docs.word_frequencies),
		collocations: new Set(docs.collocations.bigrams as string[]),
		names: nameIndex(docs.name_index),
		peers: {
			members: peers.members,
			fingerprints: peerFingerprints,
			dim: peers.fingerprints.shape[1] ?? 74,
			titles: peers.titles,
		},
		negationLabels: negationLabels(docs.negation_labels),
		alternateCuts: alternateCuts(docs.alternate_cuts),
		intents: {
			labels: intents.labels,
			dim: intents.vectors.shape[1],
			vectors: intentVectors,
		},
		mixVectors: {
			multilingual: quantized(mix.text_multi_v1),
			english: quantized(mix.text_en_v1),
		},
		...derivedTitles(title),
		timings,
	}
	timings.total = performance.now() - started
	return index
}

// --- The current build ----------------------------------------------------------------------------------------------

let current: SearchIndex | undefined
let loading: Promise<SearchIndex> | undefined
let failedAt = 0
let lastFailure: Error | undefined
let timer: NodeJS.Timeout | undefined

/** Loads the current build; on a missing file (a newer build's cleanup removed it), reads the current row again. */
async function loadCurrent(): Promise<SearchIndex> {
	for (let attempt = 0; ; attempt++) {
		const manifest = await readManifest()
		if (current && manifest.build_id === current.buildId) return current
		try {
			return await loadBuild(manifest)
		} catch (error) {
			if (!(error instanceof BlobMissing) || attempt >= 2) throw error
		}
	}
}

function refresh(): Promise<SearchIndex> {
	if (!loading) {
		loading = loadCurrent()
			.then((index) => {
				if (index !== current) {
					current = index
					console.info(
						`Search index build ${index.buildId} loaded in ${Math.round(index.timings.total)} ms`,
					)
				}
				lastFailure = undefined
				return index
			})
			.catch((error: Error) => {
				failedAt = Date.now()
				lastFailure = error
				console.error("Search index failed to load", error)
				throw error
			})
			.finally(() => {
				loading = undefined
			})
	}
	return loading
}

function watch() {
	if (timer) return
	timer = setInterval(() => {
		refresh().catch(() => {
			// Logged in refresh; the loaded build stays in use.
		})
	}, CHECK_EVERY_MS)
	timer.unref()
}

/** The loaded search index. The first call loads it; later calls return the current build at once. */
export async function getSearchIndex(): Promise<SearchIndex> {
	assertSearchRankingEnabled("The search index")
	watch()
	if (current) return current
	if (lastFailure && !loading && Date.now() - failedAt < RETRY_AFTER_MS)
		throw lastFailure
	return refresh()
}

/** The id of the loaded build, or null before the first build has loaded. */
export function loadedSearchIndexBuild(): string | null {
	return current?.buildId ?? null
}

/** Starts loading the index in the background, so the first search doesn't wait for it. */
export function startSearchIndex(): void {
	getSearchIndex().catch(() => {
		// Logged in refresh.
	})
}

/** Stops the periodic check and drops the loaded build. */
export function stopSearchIndex(): void {
	if (timer) clearInterval(timer)
	timer = undefined
	current = undefined
}
