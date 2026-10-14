// The title section's data as the page asks for it: GET /api/social/title (routes/api.social.title.ts), and the
// "wrong title?" report (report.ts). Only the slot imports this module at run time, so that it stays in the title
// page's chunk and out of the shell.
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

export type TitleSocialQuery = ReturnType<typeof titleSocialQuery>

export const titleSocialQuery = (title: SocialTitleRef) => ({
	queryKey: titleSocialKey(title),
	queryFn: () => fetchTitleSocial(title),
})
