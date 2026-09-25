import { fetch } from "undici"
import type { Eligibility } from "./reading-retrieval.server"

// Search text never passes through the general-purpose SQL logger.
export async function searchStatement(stmt: string, args: unknown[] = []) {
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
			signal: AbortSignal.timeout(8000),
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
): Promise<T[]> {
	const data = await searchStatement(stmt, args)
	return data.rows.map(
		(row) =>
			Object.fromEntries(data.cols.map((name, i) => [name, row[i]])) as T,
	)
}
export interface Metadata {
	tmdb_id: number
	media_type: "movie" | "show"
	genres: string[] | null
	adult: boolean | null
	imdb_id: string | null
	goodwatch_overall_score_voting_count: number | null
}
export async function metadataFor(keys: string[]) {
	return (
		await Promise.all(
			(["movie", "show"] as const).map(async (type) => {
				const ids = keys
					.filter((k) => k.startsWith(`${type}:`))
					.map((k) => Number(k.split(":")[1]))
					.filter(Number.isSafeInteger)
				if (!ids.length) return []
				return searchQuery<Metadata>(
					`SELECT tmdb_id, genres, adult, imdb_id, goodwatch_overall_score_voting_count, '${type}' AS media_type FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
					ids,
				)
			}),
		)
	).flat()
}
export function eligible(
	metadata: Metadata | undefined,
	policy: Eligibility,
	discovery: boolean,
) {
	return (
		(policy.includeAdult || metadata?.adult !== true) &&
		(!discovery ||
			policy.lesserKnown ||
			(metadata?.goodwatch_overall_score_voting_count ?? 0) >= 2000)
	)
}
