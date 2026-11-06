// What a blog post's link-preview card shows: the collection card's split (OgCard.tsx), a picture on the left, the
// post's kind, headline and preview line on the amber panel. Everything comes from the post's own entry in
// app/content/blog/posts.json, so a new post has its card without card code. The picture is the backdrop of the first
// title the post links to; a post that links none, or whose titles have no backdrop, gets a top-scored movie's.
// A draft renders at its address for a preview (routes/blog.$slug.tsx), so it has a card too. Backdrops are TMDB URLs
// here; og-image.server.tsx inlines them.
import type { OgCollectionContent } from "~/ui/og-image/OgCard"
import { SUBTEXT_MAX_LENGTH } from "~/ui/og-image/copy"
import type { BlogPost } from "~/utils/blog-structured-data"

export interface BlogCardDeps {
	post: (slug: string) => BlogPost | undefined
	/** The titles the post links to ("movie/129"), first mention first; null when the post has no text. */
	linkedTitles: (slug: string) => readonly string[] | null
	/** A title's backdrop, or null when it has none or the title is unknown. */
	backdrop: (type: "movie" | "show", id: number) => Promise<string | null>
	fallbackBackdrop: () => Promise<string | null>
}

// A linked title without a backdrop hands over to the next; past these, the fallback.
const TITLES_TRIED = 3

/**
 * The card path of a /blog address: /blog itself, or the page of one of `posts` (every post, drafts too); null for
 * an address without a post.
 */
export function canonicalBlogPath(
	segments: readonly string[],
	posts: readonly Pick<BlogPost, "slug">[],
): string | null {
	if (segments.length === 1) return "/blog"
	const slug = segments[1]
	if (segments.length !== 2 || !posts.some((post) => post.slug === slug))
		return null
	return `/blog/${slug}`
}

/** The line under the headline: the post's own preview line, else its description when that is short enough. */
export const previewLine = (post: BlogPost) =>
	post.card?.preview_line ??
	(post.description.length <= SUBTEXT_MAX_LENGTH ? post.description : "")

const titleRef = (ref: string) => {
	const [type, id] = ref.split("/")
	return (type === "movie" || type === "show") && Number(id) > 0
		? ({ type, id: Number(id) } as const)
		: null
}

/** The card of a post's canonical path (/blog/<slug>), or null when its page answers 404. */
export async function blogCardContent(
	path: string,
	deps: BlogCardDeps,
): Promise<OgCollectionContent | null> {
	const slug = path.split("/").filter(Boolean)[1] ?? ""
	const post = deps.post(slug)
	const titles = deps.linkedTitles(slug)
	if (!post || !titles) return null
	let backdrop: string | null = null
	for (const ref of titles
		.map(titleRef)
		.filter((r) => r !== null)
		.slice(0, TITLES_TRIED)) {
		backdrop = await deps.backdrop(ref.type, ref.id)
		if (backdrop) break
	}
	return {
		kind: "collection",
		tag: post.kind,
		title: post.title,
		subtitle: previewLine(post),
		backdrop: backdrop ?? (await deps.fallbackBackdrop()),
		providerId: null,
	}
}
