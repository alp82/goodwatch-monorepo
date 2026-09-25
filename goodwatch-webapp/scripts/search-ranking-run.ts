// Runs the local search ranking end to end on recorded searches: the Jev readings of the search arena's captures,
// against the current search index build and Qdrant (read-only queries). Prints each query's top 10 and timings, and,
// with --expect, how many of an expected top 10 it shares.
//
//   SEARCH_RANKING_MODE=shadow npx vite-node --config scripts/arena-vite.config.mjs scripts/search-ranking-run.ts \
//     --captures=<dir of <id>.json captures> [--only=id,id] [--expect=<trace.jsonl with top10 per id>] [--json=<out>]
//
// Needs CRATE_*, QDRANT_URL and QDRANT_API_KEY as the webapp has them. No Jev calls: the readings are recorded.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { readingFields } from "~/server/combined-search/reading-retrieval.server"
import { rankSearch } from "~/server/search-ranking/rank-search.server"
import { stopQueryEncoder } from "~/server/search-ranking/query-encoder.server"
import { stopSearchIndex } from "~/server/search-ranking/search-index.server"

const arg = (name: string, fallback = "") =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback
const CAPTURES = arg("captures")
if (!CAPTURES) throw new Error("--captures=<dir> is required")
const only = arg("only") ? new Set(arg("only").split(",")) : null
const expected = new Map<string, number[]>()
if (arg("expect"))
	for (const line of readFileSync(arg("expect"), "utf8")
		.split("\n")
		.filter(Boolean)) {
		const q = JSON.parse(line) as { id: string; top10: number[] }
		expected.set(q.id, q.top10)
	}

interface Capture {
	id: string
	query: string
	policy: { includeAdult: boolean; lesserKnown: boolean }
	language: { text: string; detectedNonEnglish: boolean; vectorOnly: boolean }
	reading?: { raw?: unknown }
	titleLookup?: {
		id: number
		title: string
		original?: string
		type: string
		year: string
		popularity: number
		eligible?: boolean
	}[]
}

const files = readdirSync(CAPTURES)
	.filter((f) => f.endsWith(".json") && f !== "index.json")
	.map((f) => f.slice(0, -5))
	.filter((id) => !only || only.has(id))
	.sort()
const out: unknown[] = []
let overlapSum = 0
let overlapN = 0
for (const id of files) {
	const cap = JSON.parse(
		readFileSync(join(CAPTURES, `${id}.json`), "utf8"),
	) as Capture
	if (!cap.reading?.raw) {
		console.log(`${id}: no recorded reading, skipped`)
		continue
	}
	const reading = readingFields(
		cap.language.text,
		cap.reading.raw as Parameters<typeof readingFields>[1],
		cap.language.vectorOnly,
	)
	const ranked = await rankSearch(
		reading,
		{
			query: cap.query,
			text: cap.language.text,
			nonEnglish: cap.language.detectedNonEnglish,
			titleLookup: (cap.titleLookup ?? []).filter((t) => t.eligible),
		},
		{
			includeAdult: cap.policy.includeAdult,
			lesserKnown: cap.policy.lesserKnown,
		},
	)
	const top10 = ranked.results.slice(0, 10)
	const want = expected.get(id)
	let overlap = ""
	if (want) {
		const shared = top10.filter((r) => want.includes(r.id)).length
		overlapSum += shared
		overlapN++
		overlap = ` shares ${shared}/10 with --expect`
	}
	const ref = ranked.reference
	console.log(
		`\n${id} "${cap.query}" route=${ranked.route}${ref ? ` ref=${ref.kind}/${ref.intent} [${ref.names.join(", ")}] residual="${ref.residual}"` : ""} pool=${ranked.poolSize} total=${Math.round(ranked.timings.total)}ms${overlap}`,
	)
	console.log(
		`  timings ${Object.entries(ranked.timings)
			.map(([k, v]) => `${k}=${Math.round(v)}`)
			.join(
				" ",
			)}; rounds ${ranked.rounds.map((r) => `${r.name}:${r.queries}q/${Math.round(r.serverMs)}ms/${Math.round(r.wallMs)}ms`).join(" ")}`,
	)
	top10.forEach((r, i) =>
		console.log(
			`  ${String(i + 1).padStart(2)}. ${r.title} (${r.year}) ${r.mediaType} ${r.score}`,
		),
	)
	out.push({ id, query: cap.query, ...ranked })
}
if (overlapN)
	console.log(
		`\nMean top-10 overlap with --expect: ${(overlapSum / overlapN).toFixed(2)} over ${overlapN} queries`,
	)
if (arg("json")) writeFileSync(arg("json"), JSON.stringify(out))
await stopQueryEncoder()
stopSearchIndex()
process.exit(0)
