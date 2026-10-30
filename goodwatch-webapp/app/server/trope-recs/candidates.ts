import type { MediaKey } from "../../types/user-data.ts"
import type { CatalogRead } from "../profile/tropes-data.ts"
import type { TropePageReferences } from "../profile/trope-pages.ts"
import { tropeTarget } from "../profile/trope-uri-pool.ts"
import { defining } from "../profile/tropes-model.ts"
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

/** URI aliases merge once per title, using the longest excerpt; never match identities by display name. */
export function candidateTropes(
	names: string[],
	rows: Association[],
	resolved: TropePageReferences,
) {
	const lengths = new Map<string, number>()
	for (const row of rows) {
		const id = tropeTarget(row.name, row.url, resolved)
		lengths.set(id, Math.max(lengths.get(id) ?? 0, Number(row.length) || 0))
	}
	const found = new Set(rows.map((r) => r.name))
	for (const name of new Set(names))
		if (!found.has(name)) lengths.set(tropeTarget(name, null), 0)
	const titleTropeCount = new Set(names).size
	return [...lengths].map(([id, length]) => ({
		id,
		d: Math.round(defining(length, titleTropeCount) * 100),
	}))
}

export async function buildCandidateIndex(
	read: CatalogRead,
	resolve: (urls: string[]) => Promise<TropePageReferences>,
	titlePath: (kind: "movie" | "show", id: number, name: string) => string,
): Promise<CandidateIndex> {
	const raw: {
		title: Omit<Candidate, "tropes">
		names: string[]
		rows: Association[]
	}[] = []
	const urls = new Set<string>()
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
				rows.push(...page)
				if (page.length < 10000) break
			}
			for (const row of rows) if (row.url) urls.add(row.url)
			const byTitle = new Map<number, Association[]>()
			for (const row of rows) {
				const list = byTitle.get(Number(row.media_tmdb_id)) ?? []
				list.push(row)
				byTitle.set(Number(row.media_tmdb_id), list)
			}
			for (const t of batch)
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
					names: t.tropes ?? [],
					rows: byTitle.get(Number(t.tmdb_id)) ?? [],
				})
		}
	}
	// Resolve the union once, including negative lookups, across every title batch and both kinds.
	const resolved = await resolve([...urls])
	const displayNames = new Map(
		Object.values(resolved).map((r) => [r.url, r.title]),
	)
	const tropes: string[] = []
	const names: string[] = []
	const references: string[][] = []
	const positions = new Map<string, number>()
	const titles = raw.map(({ title, names: labels, rows }) => ({
		...title,
		tropes: candidateTropes(labels, rows, resolved).map(({ id, d }) => {
			let i = positions.get(id)
			if (i === undefined) {
				i = tropes.length
				positions.set(id, i)
				tropes.push(id)
				names.push(
					displayNames.get(id) ??
						rows.find((r) => tropeTarget(r.name, r.url, resolved) === id)
							?.name ??
						labels.find((name) => tropeTarget(name, null) === id) ??
						"",
				)
				references.push([])
			}
			return { i, d }
		}),
	}))
	const sources = tropes.map(() => new Set<string>())
	for (const { rows } of raw)
		for (const row of rows) {
			const i = positions.get(tropeTarget(row.name, row.url, resolved))
			if (i !== undefined && row.url) sources[i].add(row.url)
		}
	for (let i = 0; i < sources.length; i++) references[i] = [...sources[i]]
	// Only numeric associations and one identity table survive publication; raw/resolved are build-local.
	return { titles, tropes, names, references }
}
