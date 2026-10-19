// Which blog posts are public. A draft renders at its own address so the owner can preview and edit it live, but it
// is noindex, nofollow and left out of /blog, the RSS feed and the sitemap (scripts/sitemap_blog.py follows the same
// rule). /blog itself stays out of the index until it lists a post.
// Plain Node runs blog-posts.test.ts on this file, so its imports are relative with the extension.
import type { BlogPost } from "./blog-structured-data.ts"

export const isDraft = (post: Pick<BlogPost, "draft">) => post.draft === true

/** Newest first, then by slug. */
export const byNewest = <P extends Pick<BlogPost, "published" | "slug">>(
	posts: readonly P[],
) =>
	[...posts].sort(
		(a, b) =>
			b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug),
	)

/** The posts /blog, the feed and the sitemap list: every post that isn't a draft, newest first. */
export const listedPosts = <P extends BlogPost>(posts: readonly P[]) =>
	byNewest(posts.filter((post) => !isDraft(post)))

export const postRobots = (post: Pick<BlogPost, "draft">) =>
	isDraft(post) ? ("noindex, nofollow" as const) : ("index, follow" as const)

/** /blog without a listed post is an empty page: crawlers may follow its links, but not index it. */
export const blogIndexRobots = (listed: readonly unknown[]) =>
	listed.length > 0 ? ("index, follow" as const) : ("noindex, follow" as const)

/** The newest day a listed post changed, or null when none is listed. */
export const lastUpdated = (posts: readonly Pick<BlogPost, "updated">[]) =>
	posts.reduce<string | null>(
		(max, post) => (max === null || post.updated > max ? post.updated : max),
		null,
	)
