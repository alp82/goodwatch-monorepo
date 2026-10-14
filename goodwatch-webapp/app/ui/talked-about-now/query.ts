// The title section's data as the page asks for it: GET /api/social/title (routes/api.social.title.ts), and the
// "wrong title?" report, POST /api/social/wrong-title.
import type { SocialEmbedItem } from "~/ui/social-embed/target"

export interface TitleBuzz {
	/** Wikipedia views on the scored day over the 28-day mean. */
	lift: number
	views: number
	/** The scored day, YYYY-MM-DD. */
	day: string
}

export interface TitleSocial {
	items: SocialEmbedItem[]
	buzz: TitleBuzz | null
}

export interface SocialTitleRef {
	mediaType: "movie" | "show"
	tmdbId: number
}

export const titleSocialKey = ({ mediaType, tmdbId }: SocialTitleRef) => ["talked-about-now", "title", mediaType, tmdbId] as const

export async function fetchTitleSocial({ mediaType, tmdbId }: SocialTitleRef): Promise<TitleSocial> {
	const response = await fetch(`/api/social/title?type=${mediaType}&id=${tmdbId}`)
	if (!response.ok) throw new Error(`Talked about now answered ${response.status}`)
	return (await response.json()) as TitleSocial
}

export const titleSocialQuery = (title: SocialTitleRef) => ({
	queryKey: titleSocialKey(title),
	queryFn: () => fetchTitleSocial(title),
})

/** Reports that a post isn't about the title. Resolves once the server has hidden it. */
export async function reportWrongTitle({ mediaType, tmdbId }: SocialTitleRef, postId: string): Promise<void> {
	const response = await fetch("/api/social/wrong-title", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ media_type: mediaType === "show" ? "tv" : "movie", media_tmdb_id: tmdbId, post_id: postId }),
	})
	if (!response.ok) throw new Error(`Wrong-title report answered ${response.status}`)
}
