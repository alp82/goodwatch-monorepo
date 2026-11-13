import type { MediaKey } from "../../types/user-data.ts"
import type { TropePageReferences } from "../profile/trope-pages.ts"
import { memoizedTropeTarget, tropeTarget } from "../profile/trope-uri-pool.ts"
import type { CatalogRead } from "../profile/tropes-data.ts"
import { defining } from "../profile/tropes-model.ts"
import { timeSlice } from "../time-slice.ts"
import type { Candidate, CandidateIndex } from "./ranking.ts"

interface TitleRow {
	tmdb_id: number
	title: string | null
	release_year: number | null
	poster_path: string
	gw: number
	popularity: number
	tropes: string[] | null
}
export interface Association {
	media_tmdb_id: number
	name: string
	url: string | null
	length: number | null
}

/**
 * URI aliases merge once per title, using the longest excerpt; never match identities by display name. Each identity
 * carries the name of its first association row, or its label when only the title's trope list names it.
 */
export function candidateTropes(
	names: string[],
	rows: Association[],
	resolved: TropePageReferences,
	target: (name: string, url: string | null) => string = (name, url) =>
		tropeTarget(name, url, resolved),
) {
	const lengths = new Map<string, number>()
	const labels = new Map<string, string>()
	for (const row of rows) {
		const id = target(row.name, row.url)
		lengths.set(id, Math.max(lengths.get(id) ?? 0, Number(row.length) || 0))
		if (!labels.has(id)) labels.set(id, row.name)
	}
	const found = new Set(rows.map((r) => r.name))
	for (const name of new Set(names))
		if (!found.has(name)) {
			const id = target(name, null)
			lengths.set(id, 0)
			if (!labels.has(id)) labels.set(id, name)
		}
	const titleTropeCount = new Set(names).size
	return [...lengths].map(([id, length]) => ({
		id,
		d: Math.round(defining(length, titleTropeCount) * 100),
		name: labels.get(id) ?? "",
	}))
}

export async function buildCandidateIndex(
	read: CatalogRead,
	resolve: (urls: string[]) => Promise<TropePageReferences>,
	titlePath: (kind: "movie" | "show", id: number, name: string) => string,
	slice = timeSlice(),
): Promise<CandidateIndex> {
	const raw: {
		title: Omit<Candidate, "tropes">
		names: string[]
		rows: Association[]
	}[] = []
	const urls = new Set<string>()
	// The build runs in the request process and must not hold its event loop: it lets requests run every few ms
	// (see time-slice.ts). In slices of 100 titles, a slice took up to 80 ms in production.
	// About 1.6 million association rows repeat a few tens of thousands of names and URLs; each page's rows come with
	// their own copies of the strings, which stay in memory until the build ends. One copy of each is kept.
	const strings = new Map<string, string>()
	const intern = (text: string) => {
		const known = strings.get(text)
		if (known !== undefined) return known
		strings.set(text, text)
		return text
	}
	// Sequential batches bound query size and concurrency; only metadata is retained for union resolution.
	for (const kind of ["movie", "show"] as const) {
		const titles = await read<TitleRow>(
			`SELECT tmdb_id, title, release_year, poster_path, popularity, tropes,
   goodwatch_overall_score_normalized_percent AS gw FROM ${kind}
   WHERE array_length(tropes, 1) >= 12 AND goodwatch_overall_score_normalized_percent >= 66
   AND poster_path IS NOT NULL AND poster_path <> ''
   ORDER BY popularity DESC NULLS LAST, tmdb_id LIMIT 6000`,
			[],
		)
		for (let start = 0; start < titles.length; start += 200) {
			const batch = titles.slice(start, start + 200)
			const rows: Association[] = []
			for (let offset = 0; ; offset += 10000) {
				const page = await read<Association>(
					`SELECT media_tmdb_id, name, url, coalesce(content_length, 0) AS length
     FROM trope WHERE media_type = ? AND media_tmdb_id IN (${batch.map(() => "?").join(",")})
     ORDER BY media_tmdb_id, name, url, length LIMIT 10000 OFFSET ${offset}`,
					[kind, ...batch.map((t) => t.tmdb_id)],
				)
				for (const row of page) {
					if (slice.due()) await slice.pause()
					row.name = intern(row.name)
					if (row.url) row.url = intern(row.url)
					rows.push(row)
				}
				if (page.length < 10000) break
			}
			for (const row of rows) if (row.url) urls.add(row.url)
			const byTitle = new Map<number, Association[]>()
			for (const row of rows) {
				const list = byTitle.get(Number(row.media_tmdb_id)) ?? []
				list.push(row)
				byTitle.set(Number(row.media_tmdb_id), list)
			}
			for (const t of batch) {
				if (slice.due()) await slice.pause()
				raw.push({
					title: {
						id: `${kind}-${t.tmdb_id}` as MediaKey,
						kind,
						name: t.title ?? "",
						year: t.release_year,
						poster: t.poster_path,
						gwScore: Number(t.gw),
						popularity: Number(t.popularity) || 0,
						href: titlePath(kind, Number(t.tmdb_id), t.title ?? ""),
					},
					names: (t.tropes ?? []).map(intern),
					rows: byTitle.get(Number(t.tmdb_id)) ?? [],
				})
			}
		}
	}
	strings.clear()
	// Resolve the union once, including negative lookups, across every title batch and both kinds.
	const resolved = await resolve([...urls])
	const displayNames = new Map(
		Object.values(resolved).map((r) => [r.url, r.title]),
	)
	const target = memoizedTropeTarget(resolved)
	const tropes: string[] = []
	const names: string[] = []
	const references: string[][] = []
	const positions = new Map<string, number>()
	const sources: Set<string>[] = []
	const titles: Candidate[] = []
	for (const entry of raw) {
		if (slice.due()) await slice.pause()
		const { title, names: labels, rows } = entry
		titles.push({
			...title,
			tropes: candidateTropes(labels, rows, resolved, target).map(
				({ id, d, name }) => {
					let i = positions.get(id)
					if (i === undefined) {
						i = tropes.length
						positions.set(id, i)
						tropes.push(id)
						names.push(displayNames.get(id) ?? name)
						references.push([])
						sources.push(new Set())
					}
					return { i, d }
				},
			),
		})
		for (const row of rows) {
			if (!row.url) continue
			const i = positions.get(target(row.name, row.url))
			if (i !== undefined) sources[i].add(row.url)
		}
		// Done with the title's rows: the collector can take them while the build goes on.
		entry.rows = []
	}
	for (let i = 0; i < sources.length; i++) references[i] = [...sources[i]]
	// Only numeric associations and one identity table survive publication; raw/resolved are build-local.
	return { titles, tropes, names, references }
}
