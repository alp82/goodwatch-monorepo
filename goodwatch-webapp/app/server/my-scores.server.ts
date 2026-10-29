// Your scores (My library): every title a member has scored, with what the table shows, filters and groups by. One
// read of the member data and one catalog read per 500 titles; the browser does the rest (domain/my-scores.ts).
import type { ScoredTitle } from "~/domain/my-scores"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"

const BATCH = 500
const iso = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).toISOString()

interface CardRow {
	tmdb_id: number
	title: string | null
	poster_path: string | null
	release_year: number | null
	genres: string[] | null
	gw: number | null
	backdrop_path?: string | null
}

export async function getMyScores(
	userId: string,
	options: { backdrops?: boolean } = {},
): Promise<(ScoredTitle & { backdrop_path?: string | null })[]> {
	const data = await getUserData({ user_id: userId })
	const keys = Object.keys(data.scores) as MediaKey[]
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	const cards = new Map<MediaKey, CardRow>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			for (let i = 0; i < ids[type].length; i += BATCH) {
				const batch = ids[type].slice(i, i + BATCH)
				const rows = await query<CardRow>(
					`SELECT tmdb_id, title, poster_path, release_year, genres,${options.backdrops ? " backdrop_path," : ""}
					        goodwatch_overall_score_normalized_percent AS gw
					 FROM ${type} WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
					batch,
				)
				for (const row of rows) cards.set(`${type}-${Number(row.tmdb_id)}`, row)
			}
		}),
	)
	return keys.flatMap(
		(key): (ScoredTitle & { backdrop_path?: string | null })[] => {
			const card = cards.get(key)
			const score = data.scores[key]?.score
			// A title the catalog no longer has (deleted on TMDB) has nothing to show.
			if (!card || score == null) return []
			const { mediaType, tmdbId } = parseMediaKey(key)
			return [
				{
					key,
					mediaType,
					tmdbId,
					title: card.title ?? "",
					poster_path: card.poster_path,
					...(options.backdrops
						? { backdrop_path: card.backdrop_path ?? null }
						: {}),
					release_year: card.release_year,
					genres: card.genres ?? [],
					gw: card.gw == null ? null : Math.round(card.gw),
					score: Number(score),
					ratedAt: iso(data.scores[key]?.updatedAt),
					watchedAt: iso(data.watchState[key]?.watchedAt),
				},
			]
		},
	)
}

/** What an opened row shows beyond the table's columns. */
export interface ScoredTitleDetails {
	synopsis: string | null
	tagline: string | null
}

export async function getScoredTitleDetails(
	mediaType: "movie" | "show",
	tmdbId: number,
): Promise<ScoredTitleDetails | null> {
	const rows = await query<ScoredTitleDetails>(
		`SELECT synopsis, tagline FROM ${mediaType === "show" ? "show" : "movie"} WHERE tmdb_id = ?`,
		[tmdbId],
	)
	return rows[0] ?? null
}
