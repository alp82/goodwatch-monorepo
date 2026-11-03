// Captures search inputs for scripts/search-ranking-run.ts: the Jev reading and the title lookup of each query in a
// query file, in the search arena's capture format. Read-only: Jev is called directly (no reading cache, no history
// row), TMDB and the command palette are read, and Crate is only selected from.
//
//   npx vite-node --config scripts/arena-vite.config.mjs scripts/search-concept-eval/capture.ts \
//     --queries=scripts/search-concept-eval/queries.json --out=<dir> [--force]
//
// Needs TYPESAFE_API_KEY, TMDB_API_KEY, CRATE_* and QDRANT_* (the palette lookup reads the search index).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import { fetch } from "undici"
import { citedYear } from "~/domain/cited-year"
import { eligible, metadataFor } from "~/server/combined-search/catalog.server"
import { nonEnglish } from "~/server/combined-search/language.server"
import {
	attributeRequest,
	fingerprintRequest,
} from "~/server/combined-search/reading-retrieval.server"
import { paletteLookupTitles } from "~/server/command-palette.server"
import {
	getSearchIndex,
	stopSearchIndex,
} from "~/server/search-ranking/search-index.server"
import { JEV_MODEL } from "~/server/search-runtime/runtime.server"

const arg = (name: string, fallback = "") =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback
const QUERIES = arg("queries")
const OUT = arg("out")
if (!QUERIES || !OUT)
	throw new Error("--queries=<file> and --out=<dir> are required")
const FORCE = process.argv.includes("--force")
mkdirSync(OUT, { recursive: true })

const queries = JSON.parse(readFileSync(QUERIES, "utf8")) as {
	id: string
	query: string
}[]
const client = new TypeSafeClient({
	fetch: fetch as unknown as typeof globalThis.fetch,
	apiKey: process.env.TYPESAFE_API_KEY as string,
	baseURL: "https://api.typesafe.ai",
	defaultModel: JEV_MODEL,
	timeout: 15000,
	retry: { maxRetries: 1 },
	logLevel: "off",
})
// search.server.ts readingText: the text Jev reads.
const readingText = (text: string) =>
	text
		.normalize("NFC")
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase()
		.normalize("NFC")
const policy = { includeAdult: false, lesserKnown: false }

async function tmdb(q: string) {
	const out = []
	for (let page = 1; page <= 5; page++) {
		const params = new URLSearchParams({
			api_key: process.env.TMDB_API_KEY || "",
			query: q,
			language: "en-US",
			include_adult: "false",
			page: String(page),
		})
		const res = await fetch(
			`https://api.themoviedb.org/3/search/multi?${params}`,
		)
		if (!res.ok) throw new Error(`TMDB ${res.status}`)
		const body = (await res.json()) as {
			total_pages?: number
			results?: Record<string, never>[]
		}
		for (const r of body.results ?? []) {
			const x = r as Record<string, unknown>
			if (x.media_type !== "movie" && x.media_type !== "tv") continue
			if (x.adult === true) continue
			out.push({
				id: x.id as number,
				title: (x.title || x.name || "Untitled") as string,
				original: (x.original_title || x.original_name) as string | undefined,
				type: x.media_type as string,
				year: String(x.release_date || x.first_air_date || "").slice(0, 4),
				poster: (x.poster_path as string) || null,
				popularity: (x.popularity as number) || 0,
			})
		}
		if (page >= (body.total_pages ?? 1)) break
	}
	return out
}

await getSearchIndex()
let spent = 0
for (const { id, query } of queries) {
	const file = join(OUT, `${id}.json`)
	if (existsSync(file) && !FORCE) continue
	const text = query.trim()
	const read = readingText(text)
	const [attributes, fingerprint] = await Promise.all([
		client.systemOne({ ...attributeRequest(read), model: JEV_MODEL }),
		client.systemOne({ ...fingerprintRequest(read), model: JEV_MODEL }),
	])
	const tokens =
		((attributes.usage as { total_tokens?: number })?.total_tokens ?? 0) +
		((fingerprint.usage as { total_tokens?: number })?.total_tokens ?? 0)
	spent += tokens
	// As search.server.ts titles(): the lookups search a cited title without its year.
	const words = citedYear(text)?.title ?? text
	const fromTmdb = await tmdb(words)
	const palette = await paletteLookupTitles(words, 20)
	const known = new Set(fromTmdb.map((t) => `${t.type}:${t.id}`))
	const lookup = [
		...fromTmdb,
		...palette
			.filter((t) => !known.has(`${t.type}:${t.id}`))
			.map((t) => ({ ...t, popularity: t.popularity ?? 0 })),
	]
	const key = (t: { type: string; id: number }) =>
		`${t.type === "tv" ? "show" : "movie"}:${t.id}`
	const meta = new Map(
		(await metadataFor([...new Set(lookup.map(key))])).map((m) => [
			`${m.media_type}:${m.tmdb_id}`,
			m,
		]),
	)
	const titleLookup = lookup.map((t) => {
		const m = meta.get(key(t))
		const poster = t.poster?.trim() || m?.poster_path?.trim() || null
		return { ...t, poster, eligible: eligible(m, policy, false, poster) }
	})
	const foreign = nonEnglish(text)
	writeFileSync(
		file,
		JSON.stringify({
			id,
			query: text,
			capturedAt: new Date().toISOString(),
			policy,
			language: {
				text,
				detectedNonEnglish: foreign,
				vectorOnly: false,
			},
			reading: { raw: [attributes, fingerprint], model: JEV_MODEL },
			titleLookup,
		}),
	)
	console.log(`${id} "${text}": ${titleLookup.length} lookup titles`)
}
console.log(`Jev tokens: ${spent}`)
stopSearchIndex()
process.exit(0)
