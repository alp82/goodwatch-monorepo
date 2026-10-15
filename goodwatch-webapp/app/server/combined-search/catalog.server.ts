import { fetch } from "undici"
import { ELIGIBLE_VOTES } from "../search-ranking/search-filter.server"
import type { Eligibility } from "./reading-retrieval.server"
import type { Title } from "~/ui/search/search-model"
import { withBackendTimeout } from "../../utils/backend-timeout.ts"
import { CrateAuthenticationError, getCrateClient, toCrateError } from "../../utils/crate.ts"

// Search text never passes through the general-purpose SQL logger.
export async function searchStatement(
	stmt: string,
	args: unknown[] = [],
	signal = AbortSignal.timeout(8000),
): Promise<{ cols: string[]; rows: unknown[][]; rowcount: number }> {
	if (!process.env.CRATE_HOSTS) throw new Error("Catalog unavailable")
	return getCrateClient().execute(stmt, undefined, {
		timeoutMs: METADATA_TIMEOUT_MS, signal, source: "catalog",
		transport: async (host, attemptSignal, authorization) => {
			const url = new URL(host)
			url.pathname = "/_sql"
			try {
				const response = await fetch(url, {
					method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
					body: JSON.stringify({ stmt, args }), signal: attemptSignal,
				})
				const data = await response.json().catch((error) => {
					if (response.status === 401) throw new CrateAuthenticationError("CrateDB HTTP 401")
					if (response.ok) throw error
					return {}
				}) as { cols: string[]; rows: object[][]; rowcount: number; duration: number; error?: unknown }
				if (!response.ok || data.error) throw Object.assign(
					toCrateError(data.error ?? new Error("Catalog unavailable")), { statusCode: response.status },
				)
				return { ...data, json: [] }
			} catch (error) {
				// undici's TypeError hides the transport code in cause. The shared policy needs that original code.
				const cause = (error as { cause?: unknown })?.cause
				throw cause instanceof Error && "code" in cause ? cause : error
			}
		},
	})
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
