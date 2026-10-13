import { fetch } from "undici"
import { ELIGIBLE_VOTES } from "../search-ranking/search-filter.server"
import type { Eligibility } from "./reading-retrieval.server"
import type { Title } from "~/ui/search/search-model"
import { withBackendTimeout } from "../../utils/backend-timeout.ts"

// Search text never passes through the general-purpose SQL logger.
export async function searchStatement(
	stmt: string,
	args: unknown[] = [],
	signal = AbortSignal.timeout(8000),
) {
	const host = process.env.CRATE_HOSTS?.split(",")[0]
	if (!host) throw new Error("Catalog unavailable")
	const response = await fetch(
		`http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${Buffer.from(`${process.env.CRATE_USER || ""}:${process.env.CRATE_PASS || ""}`).toString("base64")}`,
			},
			body: JSON.stringify({ stmt, args }),
			signal,
		},
	)
	if (!response.ok) throw new Error("Catalog unavailable")
	return (await response.json()) as {
		cols: string[]
		rows: unknown[][]
		rowcount: number
	}
}
export async function searchQuery<T extends object>(
	stmt: string,
	args: unknown[] = [],
	signal?: AbortSignal,
): Promise<T[]> {
	const data = await searchStatement(stmt, args, signal)
	return data.rows.map(
		(row) =>
			Object.fromEntries(data.cols.map((name, i) => [name, row[i]])) as T,
	)
}

/** Bounded exact-name recovery while TMDB is still in flight. MATCH is indexed; lower() equality scans the catalog. */
export async function exactCatalogTitles(
	text: string,
	signal?: AbortSignal,
): Promise<Title[]> {
	const normalized = (name: string) =>
		name.normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/gu, " ")
	const wanted = normalized(text)
	return withBackendTimeout(
		"Catalog exact titles",
		200,
		async (signal) => {
			const groups = await Promise.all(
				(["movie", "show"] as const).map(async (type) => {
					const rows = await searchQuery<{
						tmdb_id: number
						title: string
						original_title: string | null
						release_year: number | null
						poster_path: string | null
						popularity: number | null
						adult: boolean | null
					}>(
						`SELECT tmdb_id,title,original_title,release_year,poster_path,popularity,adult FROM ${type} WHERE MATCH((title,original_title), ?) ORDER BY _score DESC LIMIT 20`,
						[text],
						signal,
					).catch(() => [])
					return rows
						.filter(
							(row) =>
								row.adult !== true &&
								[row.title, row.original_title].some(
									(name) => name && normalized(name) === wanted,
								),
						)
						.map((row) => ({
							id: row.tmdb_id,
							title: row.title,
							original: row.original_title ?? undefined,
							type: type === "show" ? "tv" : "movie",
							year: row.release_year ? String(row.release_year) : "",
							poster: row.poster_path,
							popularity: row.popularity ?? 0,
							adult: row.adult ?? undefined,
						}))
				}),
			)
			return groups.flat()
		},
		{ signal },
	).catch(() => [])
}
export interface Metadata {
	tmdb_id: number
	media_type: "movie" | "show"
	genres: string[] | null
	adult: boolean | null
	imdb_id: string | null
	goodwatch_overall_score_voting_count: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
}
// The catalog read's own limit, kept when a caller's signal can end it sooner (see searchStatement's default).
const METADATA_TIMEOUT_MS = 8000
/**
 * The catalog rows of the keys: one query per table that has keys. The read fails at its first failed query, while the
 * query beside it may still run. `track` is called once with each query that was sent, as it starts, so a caller can
 * count the queries one by one; it changes neither the queries nor when the read ends.
 */
export async function metadataFor(
	keys: string[],
	signal?: AbortSignal,
	track?: (query: Promise<Metadata[]>) => void,
) {
	const bound = signal
		? AbortSignal.any([signal, AbortSignal.timeout(METADATA_TIMEOUT_MS)])
		: undefined
	return (
		await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const ids = keys
					.filter((k) => k.startsWith(`${type}:`))
					.map((k) => Number(k.split(":")[1]))
					.filter(Number.isSafeInteger)
				if (!ids.length) return []
				const query = searchQuery<Metadata>(
					`SELECT tmdb_id, genres, adult, imdb_id, goodwatch_overall_score_voting_count, poster_path, goodwatch_overall_score_normalized_percent, '${type}' AS media_type FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
					ids,
					bound,
				)
				track?.(query)
				return query
			}),
		)
	).flat()
}
/**
 * Whether the search may show the title. A discovery row, one the ranking found, must be a presentable title
 * (CONTEXT.md) with enough votes; a lesser-known search lifts the votes only. A title the person typed is shown
 * without either.
 */
export function eligible(
	metadata: Metadata | undefined,
	policy: Eligibility,
	discovery: boolean,
) {
	return (
		(policy.includeAdult || metadata?.adult !== true) &&
		(!discovery ||
			(!!metadata?.poster_path &&
				metadata.goodwatch_overall_score_normalized_percent != null &&
				(policy.lesserKnown ||
					(metadata.goodwatch_overall_score_voting_count ?? 0) >=
						ELIGIBLE_VOTES)))
	)
}
