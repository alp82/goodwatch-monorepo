// POST /api/social/wrong-title (routes/api.social.wrong-title.ts), from the section's "wrong title?" control.
import type { SocialTitleRef } from "./query"

/** Reports that a post isn't about the title. Resolves once the server has hidden it. */
export async function reportWrongTitle({ mediaType, tmdbId }: SocialTitleRef, postId: string): Promise<void> {
	const response = await fetch("/api/social/wrong-title", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ media_type: mediaType === "show" ? "tv" : "movie", media_tmdb_id: tmdbId, post_id: postId }),
	})
	if (!response.ok) throw new Error(`Wrong-title report answered ${response.status}`)
}
