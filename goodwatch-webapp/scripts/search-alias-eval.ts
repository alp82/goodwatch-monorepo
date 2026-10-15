// Evaluates search by localized names (docs/implementation/media-language-search-aliases-plan.md, "Evaluation"): the
// fixed query set in app/server/search-ranking/alias-eval.fixture.json against the current search index build, once
// without and once with an alias table, in this process. Nothing is posted to a search endpoint, so no history rows and
// no paid steps. Prints the top-1 and top-5 hit rates of each name path, the canonical lists that changed, the memory
// the alias table adds, and the lookup times.
//
//   NODE_OPTIONS=--expose-gc npx vite-node --config scripts/arena-vite.config.mjs scripts/search-alias-eval.ts -- \
//     --aliases=<alias_table.json.gz> [--json=<out.json>]
//
// --aliases is the gzipped alias_table file of a dry build (f/search/build_indexes) for the same title table; without
// it, the build's own alias_table. Needs CRATE_* as the webapp has them (read-only: the manifest and the index files).
// The paths: the command palette's prefix lookup (8 rows), the search's local title lookup and title blend (the
// palette's 20 rows into title-blend.server.ts, without TMDB and the ranked list), and "like X" (references.server.ts).
import { readFileSync, writeFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import fixture from "../app/server/search-ranking/alias-eval.fixture.json"
import {
	aliasTable,
	emptyAliasTable,
	matchedAlias,
} from "~/server/search-ranking/aliases.server"
import { matchingRows } from "~/server/search-ranking/name-prefix.server"
import { resolveReference } from "~/server/search-ranking/references.server"
import {
	loadBuild,
	readManifest,
} from "~/server/search-ranking/search-index-build.server"
import type { SearchIndex } from "~/server/search-ranking/search-index.server"
import { fold, words } from "~/server/search-ranking/text-rules.server"
import {
	type TitleLookupRow,
	blend,
} from "~/server/search-ranking/title-blend.server"
import { MIN_PREFIX_CHARS, normalizePrefix } from "~/utils/command-palette"

const arg = (name: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const TMDB_ID_RANGE = 1_000_000_000_000
const keyOf = (pointId: number) =>
	`${pointId >= 2 * TMDB_ID_RANGE ? "show" : "movie"}:${pointId % TMDB_ID_RANGE}`
const gc = () => (globalThis as { gc?: () => void }).gc?.()
const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10
const heapUsed = () => {
	for (let i = 0; i < 4; i++) gc()
	return process.memoryUsage().heapUsed
}

// --- the index, without and with aliases ------------------------------------------------------------------------------

const manifest = await readManifest()
const loaded = await loadBuild(manifest)
const size = loaded.titleTable.size
const before: SearchIndex = { ...loaded, aliases: emptyAliasTable(size) }
const file = arg("aliases")
if (!file && !manifest.files.alias_table)
	throw new Error("The current build has no alias_table: pass --aliases")
// What a role keeps: the decoded table (the parsed file's other arrays are garbage once it is built).
const base = heapUsed()
const baseRss = process.memoryUsage().rss
const table = file
	? aliasTable(
			JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")),
			size,
		)
	: loaded.aliases
const grown = heapUsed()
const grownRss = process.memoryUsage().rss
// Exact: the process's external memory also moves with the freed download and gunzip buffers.
const typedBytes = Object.values(table)
	.filter((v) => ArrayBuffer.isView(v))
	.reduce((n, v) => n + (v as ArrayBufferView).byteLength, 0)
const after: SearchIndex = { ...loaded, aliases: table }

// --- the paths ---------------------------------------------------------------------------------------------------------

const all = new Uint8Array(size).fill(1)
const timings = {
	palette: { before: [] as number[], after: [] as number[] },
	blend: { before: [] as number[], after: [] as number[] },
}
type Side = "before" | "after"

function palette(index: SearchIndex, q: string, limit: number, side: Side) {
	// As getPaletteTitles and paletteLookupTitles: no lookup for text shorter than two characters.
	if (normalizePrefix(q).length < MIN_PREFIX_CHARS) {
		if (limit === 8) timings.palette[side].push(0)
		return { rows: [], total: 0, aliases: new Map<number, number>() }
	}
	const started = performance.now()
	const out = matchingRows(index, fold(normalizePrefix(q)), limit)
	if (limit === 8) timings.palette[side].push(performance.now() - started)
	return out
}

function paletteKeys(index: SearchIndex, q: string, side: Side): string[] {
	return palette(index, q, 8, side).rows.map((row) =>
		keyOf(index.titleTable.pointIds[row]),
	)
}

// The ranked list the blend mixes in. The ranker itself (encoder, Qdrant) doesn't run here; two stand-ins over the
// lookup's rows: by votes (the ranker has a vote prior), and an adversarial one that ranks the rows found by a localized
// name first, to check that the fusion doesn't lift them past title matches of their kind.
type Ranking = "none" | "votes" | "aliases first"

/** The palette's 20 rows as the search's local title lookup, blended without TMDB, with a stand-in ranked list. */
function blendKeys(
	index: SearchIndex,
	q: string,
	side: Side,
	ranking: Ranking = "none",
): string[] {
	const t = index.titleTable
	const { rows, aliases } = palette(index, q, 20, side)
	const lookup: TitleLookupRow[] = rows.map((row) => {
		const alias = aliases.get(row)
		return {
			id: t.pointIds[row] % TMDB_ID_RANGE,
			title: t.titles[row],
			original: t.originalTitles[row] || undefined,
			type: t.pointIds[row] >= 2 * TMDB_ID_RANGE ? "tv" : "movie",
			year: t.years[row] ? String(t.years[row]) : "",
			popularity: t.popularity[row] || 0,
			...(alias === undefined
				? {}
				: { matchedAlias: matchedAlias(index.aliases, alias) }),
		}
	})
	const byVotes = [...rows].sort((a, b) => t.votes[b] - t.votes[a])
	const list =
		ranking === "none"
			? []
			: ranking === "votes"
				? byVotes
				: [
						...byVotes.filter((row) => aliases.has(row)),
						...byVotes.filter((row) => !aliases.has(row)),
					]
	const started = performance.now()
	const out = blend(
		index,
		q,
		lookup,
		list.map((row) => t.pointIds[row]),
		new Set(),
		all,
	).map((r) => keyOf(r.id))
	if (ranking === "none") timings.blend[side].push(performance.now() - started)
	return out
}

function likeKey(index: SearchIndex, q: string): string | null {
	const text = `like ${q}`
	const ref = resolveReference(index, text, text, true)
	return ref?.kind === "title"
		? keyOf(index.titleTable.pointIds[ref.seeds[0]])
		: null
}

// --- the set -------------------------------------------------------------------------------------------------------------

interface Case {
	group: string
	language?: string
	variant: "full" | "first word" | "first 3"
	query: string
	expect: string
}
function variants(
	group: string,
	query: string,
	expect: string,
	language?: string,
): Case[] {
	const first = words(query)[0] ?? query
	const out: Case[] = [{ group, language, variant: "full", query, expect }]
	if (first !== normalizePrefix(query))
		out.push({ group, language, variant: "first word", query: first, expect })
	const three = [...query].slice(0, 3).join("")
	if (three !== query && three !== first)
		out.push({ group, language, variant: "first 3", query: three, expect })
	return out
}
const cases: Case[] = [
	...fixture.localized.flatMap((c) =>
		variants("localized", c.query, c.expect, c.language),
	),
	...fixture.canonical.flatMap((c) => variants("canonical", c.query, c.expect)),
	...fixture.ambiguous.map(
		(c): Case => ({
			group: "ambiguous",
			variant: "full",
			query: c.query,
			expect: c.expect,
		}),
	),
]

const PATHS = [
	"palette",
	"blend",
	"blend, ranked by votes",
	"blend, aliases ranked first",
] as const
type Path = (typeof PATHS)[number]
interface Result extends Case, Record<Path, Record<Side, string[]>> {
	like: Record<Side, string | null> | null
}
const results: Result[] = cases.map((c) => ({
	...c,
	palette: {
		before: paletteKeys(before, c.query, "before"),
		after: paletteKeys(after, c.query, "after"),
	},
	blend: {
		before: blendKeys(before, c.query, "before"),
		after: blendKeys(after, c.query, "after"),
	},
	"blend, ranked by votes": {
		before: blendKeys(before, c.query, "before", "votes"),
		after: blendKeys(after, c.query, "after", "votes"),
	},
	"blend, aliases ranked first": {
		before: blendKeys(before, c.query, "before", "aliases first"),
		after: blendKeys(after, c.query, "after", "aliases first"),
	},
	like:
		c.variant === "full" && c.group !== "ambiguous"
			? { before: likeKey(before, c.query), after: likeKey(after, c.query) }
			: null,
}))

// --- the report ------------------------------------------------------------------------------------------------------------

const pct = (n: number, d: number) =>
	d ? `${Math.round((100 * n) / d)}%` : "-"
function rates(rows: Result[], path: Path, side: Side) {
	const top1 = rows.filter((r) => r[path][side][0] === r.expect).length
	const top5 = rows.filter((r) =>
		r[path][side].slice(0, 5).includes(r.expect),
	).length
	return `${pct(top1, rows.length)} / ${pct(top5, rows.length)}`
}
const lines: string[] = []
lines.push(
	`Build ${manifest.build_id}: ${size} titles, ${table.size} aliases (version ${table.version})`,
)
lines.push(
	`Memory of the alias table: +${mb(grown - base)} MB heap, +${mb(typedBytes)} MB typed arrays; process RSS +${mb(grownRss - baseRss)} MB (also the parse of the file, which a role does in its load worker)`,
)
lines.push("")
lines.push("Hit rates, top-1 / top-5, before -> after")
lines.push(
	"group | variant | n | palette | title lookup + blend | like X (top-1)",
)
const groups: [string, (r: Result) => boolean][] = [
	["localized", (r) => r.group === "localized"],
	...[...new Set(fixture.localized.map((c) => c.language))].map(
		(lang): [string, (r: Result) => boolean] => [
			`  ${lang}`,
			(r) => r.group === "localized" && r.language === lang,
		],
	),
	["canonical", (r) => r.group === "canonical"],
	["ambiguous", (r) => r.group === "ambiguous"],
]
for (const [name, pick] of groups) {
	for (const variant of ["full", "first word", "first 3"] as const) {
		const rows = results.filter((r) => pick(r) && r.variant === variant)
		if (!rows.length) continue
		const liked = rows.filter((r) => r.like)
		const like = liked.length
			? `${pct(liked.filter((r) => r.like?.before === r.expect).length, liked.length)} -> ${pct(liked.filter((r) => r.like?.after === r.expect).length, liked.length)}`
			: "-"
		lines.push(
			`${name} | ${variant} | ${rows.length} | ${rates(rows, "palette", "before")} -> ${rates(rows, "palette", "after")} | ${rates(rows, "blend", "before")} -> ${rates(rows, "blend", "after")} | ${like}`,
		)
	}
}
lines.push("")
lines.push(
	"With a ranked list mixed into the blend, top-1 / top-5, before -> after",
)
lines.push("group | variant | n | ranked by votes | aliases ranked first")
for (const [name, pick] of groups.filter(([name]) => !name.startsWith(" "))) {
	for (const variant of ["full", "first word", "first 3"] as const) {
		const rows = results.filter((r) => pick(r) && r.variant === variant)
		if (!rows.length) continue
		const votes = "blend, ranked by votes"
		const first = "blend, aliases ranked first"
		lines.push(
			`${name} | ${variant} | ${rows.length} | ${rates(rows, votes, "before")} -> ${rates(rows, votes, "after")} | ${rates(rows, first, "before")} -> ${rates(rows, first, "after")}`,
		)
	}
}
lines.push("")
lines.push("Canonical and ambiguous queries whose top 5 changed:")
let changed = 0
for (const r of results.filter((r) => r.group !== "localized")) {
	for (const path of PATHS) {
		const a = r[path].before.slice(0, 5).join(" ")
		const b = r[path].after.slice(0, 5).join(" ")
		if (a === b) continue
		changed++
		const top1 =
			r[path].before[0] === r[path].after[0] ? "same top-1" : "TOP-1 CHANGED"
		lines.push(`  ${path} "${r.query}" (${r.variant}, ${top1}): ${a} -> ${b}`)
	}
}
if (!changed) lines.push("  none")
lines.push("")
lines.push("Localized misses after (top-5 of the title lookup + blend):")
for (const r of results.filter(
	(r) =>
		r.group === "localized" && !r.blend.after.slice(0, 5).includes(r.expect),
))
	lines.push(
		`  ${r.language} "${r.query}" (${r.variant}) expected ${r.expect}: ${r.blend.after.slice(0, 5).join(" ") || "nothing"}`,
	)
lines.push("")
// Each query's own time, after a first pass that builds the per-build caches (folded names, character counts).
const ms = (xs: number[]) => {
	const sorted = [...xs].sort((a, b) => a - b)
	const at = (p: number) =>
		sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(
			2,
		)
	return `p50 ${at(0.5)}, p90 ${at(0.9)}, max ${at(1)}`
}
for (const side of ["before", "after"] as const) {
	timings.palette[side] = []
	timings.blend[side] = []
}
for (const c of cases) {
	paletteKeys(before, c.query, "before")
	paletteKeys(after, c.query, "after")
	blendKeys(before, c.query, "before")
	blendKeys(after, c.query, "after")
}
const slowest = (xs: number[]) =>
	cases
		.map((c, i) => [xs[i] ?? 0, c.query] as const)
		.sort((a, b) => b[0] - a[0])
		.slice(0, 5)
		.map(([t, q]) => `"${q}" ${t.toFixed(1)}`)
		.join(", ")
lines.push("Lookup time per query, ms:")
lines.push(
	`  palette (8 rows): ${ms(timings.palette.before)} -> ${ms(timings.palette.after)}`,
)
lines.push(
	`  title blend (fuzzy match included): ${ms(timings.blend.before)} -> ${ms(timings.blend.after)}`,
)
lines.push(`  slowest palette with aliases: ${slowest(timings.palette.after)}`)
lines.push(`  slowest blend with aliases: ${slowest(timings.blend.after)}`)
console.log(lines.join("\n"))
const out = arg("json")
if (out)
	writeFileSync(
		out,
		JSON.stringify(
			{ build: manifest.build_id, aliases: table.size, results },
			null,
			1,
		),
	)
process.exit(0)
