// The list owner's scores for the titles of their share list, for the filled score square at the end of each row. Only
// what their profile shows the viewer: nothing when they keep their scores to themselves (or to members, for a guest).
import { canSee } from "~/domain/profile"
import { getProfileSettings } from "~/server/profile/settings.server"
import type { ListEntry } from "~/server/share-lists/titles.server"
import { getUserData } from "~/server/userData.server"
import { titleKey } from "~/ui/share-card/model"

/** By the list's title key ("movie:603"); null when the viewer may not see the owner's scores. */
export async function getOwnerScores(
	ownerId: string,
	viewer: "member" | "guest",
	entries: readonly ListEntry[],
): Promise<Record<string, number> | null> {
	const settings = await getProfileSettings(ownerId)
	if (!canSee(settings.visibility, "scores", viewer)) return null
	const { scores } = await getUserData({ user_id: ownerId })
	const result: Record<string, number> = {}
	for (const e of entries) {
		const score = scores[`${e.media_type}-${e.tmdb_id}`]?.score
		if (score) result[titleKey(e.media_type, e.tmdb_id)] = score
	}
	return result
}
