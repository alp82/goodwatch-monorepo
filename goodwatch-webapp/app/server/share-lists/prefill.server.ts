// "Share your top 5" for signed-in people: their highest-rated titles, read from user_score.
// This only reads ratings; share lists never write to the taste profile.
import {
	type CardTitle,
	LIST_SIZE,
	type MediaType,
} from "~/ui/share-card/model"
import {
	PREFILL_CANDIDATES,
	type RatedTitle,
	rankRatings,
} from "~/ui/share-card/prefill"
import { query } from "~/utils/crate"
import { type ListEntry, resolveCardTitles } from "./titles.server"

type ScoreRow = {
	tmdb_id: number
	media_type: MediaType
	score: number
	updated_at: number | null
}

/** The person's best-rated titles, best first, with a few spares for titles the catalog can't show. */
export async function topRatedEntries(userId: string): Promise<ListEntry[]> {
	// updated_at comes back as epoch milliseconds, so a missing value can't pose as a 1970 date.
	const rows = await query<ScoreRow>(
		`SELECT tmdb_id, media_type, score, updated_at::BIGINT AS updated_at
		 FROM user_score
		 WHERE user_id = ? AND score IS NOT NULL
		 ORDER BY score DESC, updated_at DESC NULLS LAST, tmdb_id ASC
		 LIMIT ${PREFILL_CANDIDATES}`,
		[userId],
	)
	const ratings: RatedTitle[] = rows
		.filter((r) => r.media_type === "movie" || r.media_type === "show")
		.map((r) => ({
			media_type: r.media_type,
			tmdb_id: r.tmdb_id,
			score: r.score,
			ratedAt: Number(r.updated_at) || 0,
		}))
	return rankRatings(ratings).map(({ media_type, tmdb_id }) => ({
		media_type,
		tmdb_id,
	}))
}

/** Card data for up to five titles, in the given order, skipping any the catalog can't show. */
export async function prefillTitles(
	entries: ListEntry[],
): Promise<CardTitle[]> {
	return (await resolveCardTitles(entries)).slice(0, LIST_SIZE)
}
