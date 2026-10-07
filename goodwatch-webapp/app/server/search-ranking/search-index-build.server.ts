// Downloads, checks, decodes, and derives a search build in a per-load worker or inline in development.
import { createHash } from "node:crypto"
import { BackendTimeoutError } from "../../utils/backend-timeout.ts"
import http from "node:http"
import { promisify } from "node:util"
import { gunzip as gunzipCallback } from "node:zlib"
import type {
	Manifest,
	TitleTable,
	TermStatistics,
	WordFrequencies,
	NameIndex,
	NegationLabels,
	QuantizedVectors,
	SearchIndex,
} from "./search-index.server.ts"
import { normalized, singular } from "./text-rules.server.ts"

const gunzip = promisify(gunzipCallback)

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

// --- Crate access -------------------------------------------------------------------------------------------------

export class BlobMissing extends Error {}

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
			req.destroy(new BackendTimeoutError("CrateDB", REQUEST_TIMEOUT_MS, `Crate request timed out: ${url.pathname}`)),
		)
		req.on("error", reject)
		req.end(body)
	})
}

export async function readManifest(): Promise<Manifest> {
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
		// Builds since #168 store singular() forms already; older ones don't, and singular() is idempotent.
		for (const s of new Set(stems.map(singular))) {
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

export async function loadBuild(manifest: Manifest): Promise<SearchIndex> {
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
