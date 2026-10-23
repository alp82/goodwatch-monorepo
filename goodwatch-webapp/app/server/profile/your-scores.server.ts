// A signed-in visitor's own scores for the titles on a profile page, for the "You 9" tags. Only once the visitor's
// taste can be compared (MIN_LIKED liked titles), as the match: below that, the page shows no comparisons.
import { MIN_LIKED } from "~/server/taste/formula.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import { getUserData } from "~/server/userData.server"
import type { MediaKey } from "~/types/user-data"

/** The visitor's score per title key ("movie-550") among `keys`; null when the visitor can't compare yet. */
export async function yourScores(viewerId: string, keys: Iterable<string>): Promise<Record<string, number> | null> {
	const [taste, data] = await Promise.all([loadMemberTaste(viewerId), getUserData({ user_id: viewerId })])
	if (taste.liked < MIN_LIKED) return null
	const out: Record<string, number> = {}
	for (const key of keys) {
		const score = data.scores[key as MediaKey]?.score
		if (score) out[key] = score
	}
	return out
}
