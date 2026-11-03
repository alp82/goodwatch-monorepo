// Ranks recorded searches (capture.ts or the search arena's captures) with the local ranker, read-only against the
// current search index build and Qdrant, and writes per query the blended list and the ranked pool with each title's
// votes and GoodWatch score, for before/after comparisons (compare.py).
//
//   npx vite-node --config scripts/arena-vite.config.mjs scripts/search-concept-eval/run.ts \
//     --captures=<dir>[,<dir>] --out=<file.json> [--only=id,id] [--limit=1000]
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { readingFields } from "~/server/combined-search/reading-retrieval.server"
import { stopQueryEncoder } from "~/server/search-ranking/query-encoder.server"
import { conceptTitles } from "~/server/search-ranking/concept-query.server"
import { rankSearch } from "~/server/search-ranking/rank-search.server"
import {
	getSearchIndex,
	stopSearchIndex,
} from "~/server/search-ranking/search-index.server"

const arg = (name: string, fallback = "") =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback
const dirs = arg("captures").split(",").filter(Boolean)
const OUT = arg("out")
if (!dirs.length || !OUT) throw new Error("--captures and --out are required")
const only = arg("only") ? new Set(arg("only").split(",")) : null
const LIMIT = Number(arg("limit", "1000"))

const index = await getSearchIndex()
const t = index.titleTable
const facts = (id: number) => {
	const row = t.rowOf.get(id)
	return row === undefined
		? { votes: null, gw: null }
		: { votes: t.votes[row], gw: t.goodwatchScores[row] }
}
const out: unknown[] = []
for (const dir of dirs)
	for (const file of readdirSync(dir).sort()) {
		if (!file.endsWith(".json") || file === "index.json") continue
		const cap = JSON.parse(readFileSync(join(dir, file), "utf8"))
		if (only && !only.has(cap.id)) continue
		if (!cap.reading?.raw) continue
		const reading = readingFields(
			cap.language.text,
			cap.reading.raw,
			cap.language.vectorOnly,
		)
		const ranked = await rankSearch(
			reading,
			{
				query: cap.query,
				text: cap.language.text,
				nonEnglish: cap.language.detectedNonEnglish,
				titleLookup: (cap.titleLookup ?? []).filter(
					(x: { eligible?: boolean }) => x.eligible !== false,
				),
				resultLimit: LIMIT,
				trace: true,
			},
			{ includeAdult: false, lesserKnown: cap.policy?.lesserKnown ?? false },
		)
		const total = new Map(ranked.trace?.candidates ?? [])
		const concept = conceptTitles(index, cap.query)
		out.push({
			id: cap.id,
			query: cap.query,
			route: ranked.route,
			poolSize: ranked.poolSize,
			ms: Math.round(ranked.timings.total),
			relevant: (ranked as { relevantCount?: number }).relevantCount ?? null,
			concept: concept ? [...concept] : null,
			results: ranked.results.map((r) => ({
				id: r.id,
				title: r.title,
				year: r.year,
				score: r.score,
				total: total.get(r.id) ?? null,
				...facts(r.id),
			})),
		})
		console.log(
			`${cap.id} "${cap.query}" pool=${ranked.poolSize} ${Math.round(ranked.timings.total)}ms: ${ranked.results
				.slice(0, 5)
				.map((r) => `${r.title} (${r.year})`)
				.join(" | ")}`,
		)
	}
writeFileSync(OUT, JSON.stringify(out))
await stopQueryEncoder()
stopSearchIndex()
process.exit(0)
