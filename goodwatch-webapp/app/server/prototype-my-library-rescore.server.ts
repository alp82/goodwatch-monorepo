// PROTOTYPE - throwaway. What /prototype/my-library-rescore reads: every title one member has scored, with what
// the rescoring list groups and filters by. The member is PROTOTYPE_MEMBER_ID from the environment (never committed),
// so the prototype shows real ratings without a signed-in session. Nothing is written: scores change in memory only.
import { libraryCounts } from "~/domain/my-library"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"

export interface RatedTitle {
	key: MediaKey
	mediaType: "movie" | "show"
	tmdbId: number
	title: string
	poster_path: string | null
	release_year: number | null
	genres: string[]
	/** GoodWatch score, 0-100. */
	gw: number | null
	score: number
	/** When the score was last given (ISO). */
	ratedAt: string | null
	/** The latest dated watch (ISO). */
	watchedAt: string | null
}

export interface RescoreData {
	member: string
	titles: RatedTitle[]
	counts: ReturnType<typeof libraryCounts>
}

const BATCH = 500
const iso = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).toISOString()

export async function getRescoreData(): Promise<RescoreData | null> {
	const member = process.env.PROTOTYPE_MEMBER_ID
	if (!member) return null
	const data = await getUserData({ user_id: member })
	const keys = Object.keys(data.scores) as MediaKey[]
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	type Row = {
		tmdb_id: number
		title: string | null
		poster_path: string | null
		release_year: number | null
		genres: string[] | null
		gw: number | null
	}
	const cards = new Map<MediaKey, Row>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			for (let i = 0; i < ids[type].length; i += BATCH) {
				const batch = ids[type].slice(i, i + BATCH)
				const rows = await query<Row>(
					`SELECT tmdb_id, title, poster_path, release_year, genres,
					        goodwatch_overall_score_normalized_percent AS gw
					 FROM ${type} WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
					batch,
				)
				for (const row of rows) cards.set(`${type}-${Number(row.tmdb_id)}`, row)
			}
		}),
	)
	const titles = keys.flatMap((key): RatedTitle[] => {
		const card = cards.get(key)
		const score = data.scores[key]?.score
		if (!card || score == null) return []
		const { mediaType, tmdbId } = parseMediaKey(key)
		return [
			{
				key,
				mediaType,
				tmdbId,
				title: card.title ?? "",
				poster_path: card.poster_path,
				release_year: card.release_year,
				genres: card.genres ?? [],
				gw: card.gw == null ? null : Math.round(card.gw),
				score: Number(score),
				ratedAt: iso(data.scores[key]?.updatedAt),
				watchedAt: iso(data.watchState[key]?.watchedAt),
			},
		]
	})
	return { member, titles, counts: libraryCounts(data) }
}
