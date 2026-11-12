import type { ExactSearch } from "../../domain/exact-search.ts"
import { tropeTitles, similarTitles } from "../title-filter/id-sets.server"
import { peopleSearchFilters } from "./people-filter.server"
import { searchQuery, type Metadata } from "./catalog.server"
import { toCrateSql, titlePointId } from "./search-filters"
import type { Eligibility, ReadingChip } from "./reading-retrieval.server"
import type { Row } from "~/ui/search/search-model"

/** Execute an exact filter using the existing Like candidates or canonical trope membership. */
export async function resolvedSearch(
	entity: ExactSearch,
	eligibility: Eligibility,
	signal: AbortSignal,
	limit = 100,
) {
	signal.throwIfAborted()
	let keys =
		entity.kind === "trope"
			? await tropeTitles(entity.id)
			: await similarTitles(Number(entity.id))
	const filters = await peopleSearchFilters(eligibility.filters, signal)
	if (
		filters?.trope &&
		!(entity.kind === "trope" && filters.trope === entity.id)
	) {
		const ownTrope = await tropeTitles(filters.trope)
		keys = new Set([...keys].filter((key) => ownTrope.has(key)))
	}
	if (filters?.onlyTitles) {
		const allowed = new Set(filters.onlyTitles)
		keys = new Set(
			[...keys].filter((key) =>
				allowed.has(`${key >= 2e12 ? "show" : "movie"}:${key % 1e12}`),
			),
		)
	}
	if (signal.aborted) throw new Error("Search interrupted")
	const maximum = Math.min(5000, Math.max(1, limit))
	type Found = Metadata & {
		title: string
		original_title: string | null
		release_year: number | null
		popularity: number
	}
	const groups = await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = [...keys]
				.filter((key) => (key >= 2e12 ? "show" : "movie") === type)
				.map((key) => key % 1e12)
			if (!ids.length) return []
			const sql = toCrateSql(filters, type)
			if (!sql) return []
			return searchQuery<Found>(
				`SELECT tmdb_id,title,original_title,release_year,popularity,poster_path,genres,adult,imdb_id,goodwatch_overall_score_normalized_percent,goodwatch_overall_score_voting_count,'${type}' AS media_type FROM ${type} WHERE tmdb_id = ANY(?) AND poster_path IS NOT NULL AND goodwatch_overall_score_normalized_percent IS NOT NULL${eligibility.includeAdult ? "" : " AND NOT coalesce(adult,false)"}${eligibility.lesserKnown ? "" : " AND goodwatch_overall_score_voting_count >= 2000"}${sql.sql} ORDER BY popularity DESC NULLS LAST,tmdb_id LIMIT ?`,
				[ids, ...sql.params, maximum],
				signal,
			)
		}),
	)
	const found = groups
		.flat()
		.sort(
			(a, b) =>
				(b.popularity || 0) - (a.popularity || 0) ||
				`${a.media_type}:${a.tmdb_id}`.localeCompare(
					`${b.media_type}:${b.tmdb_id}`,
				),
		)
		.slice(0, maximum)
	const description =
		entity.kind === "trope"
			? `Trope: ${entity.label}`
			: `Like ${entity.label}${entity.year ? ` (${entity.year})` : ""}`
	const reading: ReadingChip[] = [{ kind: "attribute", text: description }]
	const head = found.slice(0, Math.min(100, maximum))
	const rows: Row[] = head.map((r, i) => ({
		key: `${r.media_type}:${r.tmdb_id}`,
		title: r.title,
		original: r.original_title ?? undefined,
		type: r.media_type,
		year: String(r.release_year ?? ""),
		poster: r.poster_path,
		popularity: r.popularity || 0,
		adult: r.adult ?? undefined,
		lexical: 0,
		match: description,
		score: found.length - i,
	}))
	return {
		rows,
		metadata: head as Metadata[],
		reading,
		searchKeys: found.map((r) => titlePointId(`${r.media_type}:${r.tmdb_id}`)),
	}
}
