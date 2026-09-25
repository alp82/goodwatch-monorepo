// Checks the search's language routing (`nonEnglish` in combined-search/language.server.ts) on query sets.
//
//   npx vite-node --config scripts/arena-vite.config.mjs scripts/language-routing/check.ts \
//     [--arena=<search-arena queries.json>] [--history]
//
// Sets:
// - spanish*.txt, turkish*.txt: realistic Spanish and Turkish searches. They should route as non-English, except
//   bare titles ("la casa de papel"), which are language-neutral and stay English.
// - english-hard*.txt: English searches with Spanish or Turkish titles, names and loanwords. None may route as
//   non-English.
// - --arena: the graded arena queries. The non-English ones should route as non-English. The English ones must not.
//   Three graded queries of other types are German or French; they're counted with the non-English queries.
// - --history: past searches from doc.search_history (needs the webapp's .env). Prints counts only: the texts are
//   private and are never printed.
import "dotenv/config"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { nonEnglish } from "~/server/combined-search/language.server"

const here = join(process.cwd(), "scripts/language-routing")
const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}`))?.split("=")[1] ?? null
const lines = (file: string) =>
	readFileSync(join(here, file), "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)

interface SetResult {
	name: string
	expect: "foreign" | "english"
	total: number
	wrong: string[]
	private?: boolean
}
const results: SetResult[] = []
const check = (
	name: string,
	expect: SetResult["expect"],
	texts: string[],
	isPrivate = false,
) => {
	const wrong = texts.filter((t) => nonEnglish(t) !== (expect === "foreign"))
	results.push({ name, expect, total: texts.length, wrong, private: isPrivate })
}

// The markers were tuned on spanish.txt, turkish.txt and english-hard.txt. The *-heldout.txt sets were written
// afterwards and never used for tuning.
for (const set of ["", "-heldout"]) {
	check(`spanish${set}`, "foreign", lines(`spanish${set}.txt`))
	check(`turkish${set}`, "foreign", lines(`turkish${set}.txt`))
	check(`english-hard${set}`, "english", lines(`english-hard${set}.txt`))
}

const arena = arg("arena")
if (arena) {
	const OTHER_LANGUAGE = new Set([
		"lustige Filme mit Bud Spencer und Terence Hill",
		"un film à la jean-pierre jeunet",
		"Krimi ohne Mord",
	])
	const queries = JSON.parse(readFileSync(arena, "utf8")) as {
		query: string
		type: string
	}[]
	check(
		"arena-non-english",
		"foreign",
		queries
			.filter((q) => q.type === "non_english" || OTHER_LANGUAGE.has(q.query))
			.map((q) => q.query),
	)
	check(
		"arena-english",
		"english",
		queries
			.filter((q) => q.type !== "non_english" && !OTHER_LANGUAGE.has(q.query))
			.map((q) => q.query),
	)
}

if (process.argv.includes("--history")) {
	const { getSearchStore } = await import(
		"~/server/search-runtime/runtime.server"
	)
	const { searchQuery } = await import(
		"~/server/combined-search/catalog.server"
	)
	const store = getSearchStore()
	const rows = await searchQuery<{ ciphertext: string }>(
		"SELECT ciphertext FROM doc.search_history LIMIT 10000",
	)
	// Rows sealed with another SEARCH_STORAGE_KEY (another environment) don't open and are skipped.
	const opened = rows.flatMap((r) => {
		try {
			return [store.unseal<{ text: string }>(r.ciphertext).text]
		} catch {
			return []
		}
	})
	const texts = [...new Set(opened)]
	// Past searches have no language label: report how many route as non-English, without the texts.
	const foreign = texts.filter((t) => nonEnglish(t)).length
	results.push({
		name: `history (${rows.length} rows, ${opened.length} opened; distinct texts)`,
		expect: "english",
		total: texts.length,
		wrong: Array(foreign).fill(""),
		private: true,
	})
}

for (const r of results) {
	console.log(
		`${r.name.padEnd(46)} ${String(r.total - r.wrong.length).padStart(4)} of ${String(r.total).padStart(4)} as expected (${r.expect})`,
	)
	if (!r.private) for (const w of r.wrong) console.log(`    wrong: ${w}`)
}
process.exit(0)
