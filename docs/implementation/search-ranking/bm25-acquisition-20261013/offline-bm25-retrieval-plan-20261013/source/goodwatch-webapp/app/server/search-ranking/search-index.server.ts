// Keeps the search indexes that f/search/build_indexes writes to Crate loaded and current.
//
// A build is ten gzipped JSON files in the blob table `search_index_files`, listed by the manifest in the
// `search_index_builds` row `build_id = 'current'`. A load downloads every file, checks its SHA-1, parses it into
// typed tables, and swaps the new build in only when all files have loaded, so a search never sees two builds at once.
// The loader checks the current row every few minutes and loads a new build in the background.
//
// The download, the parsing, and the table building (search-index-build.server.ts) run in a worker thread that lives
// for one load (search-index.worker.ts): on the main thread they blocked the event loop for 2.4 seconds per load. The
// worker hands the finished index over in bounded pieces (search-index-pieces.server.ts), one piece per turn of the
// event loop, and the main thread assembles them. Without the bundled worker file (development, scripts, tests) the
// same build code runs on the main thread.
//
// Nothing loads on import. Formats: "Index files" in docs/implementation/search-ranking/README.md.
import { runsSearch } from "../role.server.ts"
import { existsSync } from "node:fs"
import { Worker } from "node:worker_threads"
import { addReadinessCheck, onShutdown } from "../lifecycle.server.ts"
import { separateEntryUrl } from "../separate-entry.server.ts"
import {
	BlobMissing,
	loadBuild,
	readManifest,
} from "./search-index-build.server.ts"
import { createAssembler } from "./search-index-pieces.server.ts"
import { reloadDelayMs } from "./search-index-retry.server.ts"
import { prepareTitleBlend } from "./title-blend.server.ts"

const CHECK_EVERY_MS = 5 * 60_000
const RETRY_AFTER_MS = 60_000

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
	/** Content stem in singular() form -> the labels that hold it. */
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

// --- The current build ----------------------------------------------------------------------------------------------

let generation = 0
let current: SearchIndex | undefined
let loading: Promise<SearchIndex> | undefined
let failedAt = 0
let lastFailure: Error | undefined
let timer: NodeJS.Timeout | undefined

/** Loads the current build; on a missing file (a newer build's cleanup removed it), reads the current row again. */
async function loadCurrent(): Promise<SearchIndex> {
	const beganIn = generation
	for (let attempt = 0; ; attempt++) {
		const manifest = await readManifest()
		if (beganIn !== generation) throw new Error("Search index load stopped")
		if (current && manifest.build_id === current.buildId) return current
		try {
			if (current) await waitForReload()
			if (beganIn !== generation) throw new Error("Search index load stopped")
			const index = await loadIndexBuild(manifest)
			if (beganIn !== generation) throw new Error("Search index load stopped")
			return index
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
					// Before the swap, so no search pays for it.
					prepareTitleBlend(index)
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
	onShutdown("search index refresh", stopSearchIndex)
	timer.unref()
}

/** The loaded search index. The first call loads it; later calls return the current build at once. */
export async function getSearchIndex(): Promise<SearchIndex> {
	if (!runsSearch()) throw new Error("The page role has no search index")
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
	if (!runsSearch()) return
	// Readiness waits for the first load so the command palette and search have their index for the first requests.
	addReadinessCheck(
		"search index",
		() => current !== undefined || lastFailure !== undefined,
	)
	getSearchIndex().catch(() => {
		// Logged in refresh.
	})
}

/** Stops the periodic check, a waiting or running load, and drops the loaded build. */
export function stopSearchIndex(): void {
	generation++
	cancelReload?.()
	for (const worker of activeWorkers) void worker.terminate()
	if (timer) clearInterval(timer)
	timer = undefined
	current = undefined
}

const activeWorkers = new Set<Worker>()
let warnedMissingWorker = false
let cancelReload: (() => void) | undefined

// The wait before a reload (see search-index-retry.server.ts). The first load doesn't wait.
function waitForReload(): Promise<void> {
	return new Promise((resolve, reject) => {
		const wait = setTimeout(() => {
			cancelReload = undefined
			resolve()
		}, reloadDelayMs())
		wait.unref()
		cancelReload = () => {
			clearTimeout(wait)
			cancelReload = undefined
			reject(new Error("Search index reload stopped"))
		}
	})
}

/**
 * Loads one build: in a worker thread when the bundled worker file exists, else on the main thread. Tests pass the
 * worker's source file as `url` to run the worker path.
 */
export async function loadIndexBuild(
	manifest: Manifest,
	url = separateEntryUrl("search-index.worker.js", import.meta.url),
): Promise<SearchIndex> {
	const began = performance.now()
	if (!existsSync(url)) {
		if (process.env.NODE_ENV === "production" && !warnedMissingWorker) {
			warnedMissingWorker = true
			console.error(
				`Missing ${url.pathname}; search index load runs on the main thread`,
			)
		}
		return loadBuild(manifest)
	}
	const worker = new Worker(url, { workerData: { manifest } })
	activeWorkers.add(worker)
	onShutdown("search index workers", () =>
		Promise.all([...activeWorkers].map((worker) => worker.terminate())),
	)
	let timeout: NodeJS.Timeout | undefined
	try {
		return await new Promise<SearchIndex>((resolve, reject) => {
			const assembler = createAssembler()
			let done = false
			timeout = setTimeout(
				() => reject(new Error("Search index worker timed out")),
				5 * 60_000,
			)
			worker.on("error", reject)
			worker.on("exit", (code) => {
				if (!done || code !== 0)
					reject(new Error(`Search index worker exited early (${code})`))
			})
			worker.on("message", (message) => {
				try {
					if (message.type === "error")
						throw message.blobMissing
							? new BlobMissing(message.message)
							: new Error(message.message)
					if (message.type === "piece") {
						assembler.add(message.piece)
						// Not sent from here: Node drains a port's queue in one go, and a worker that answers within
						// microseconds would keep the main thread in that drain for the whole transfer. From
						// setImmediate, the event loop turns once per piece and serves waiting requests in between.
						setImmediate(() => worker.postMessage({ type: "next" }))
					} else if (message.type === "done") {
						const index = assembler.finish()
						index.timings.total = performance.now() - began
						done = true
						resolve(index)
					}
				} catch (error) {
					reject(error)
				}
			})
		})
	} finally {
		clearTimeout(timeout)
		await worker.terminate()
		activeWorkers.delete(worker)
	}
}
