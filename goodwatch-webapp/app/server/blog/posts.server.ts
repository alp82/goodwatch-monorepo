// The published blog posts. posts.json is the one list: the sitemap generator (scripts/sitemap_blog.py) reads it
// too, so a post is in the sitemap with the same dates the page shows. Only loaders read it, so it never reaches the
// browser's bundle. A post's text is app/content/blog/<slug>/post.mdx.
import posts from "~/content/blog/posts.json"
import type { BlogPost } from "~/utils/blog-structured-data"

/** Newest first. */
export const blogPosts: readonly BlogPost[] = [...(posts as BlogPost[])].sort(
	(a, b) =>
		b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug),
)

export const findBlogPost = (slug: string | undefined) =>
	blogPosts.find((post) => post.slug === slug)

/** The newest date any post changed, for the blog's own page and its feed. */
export const blogUpdated = () =>
	blogPosts.reduce((max, post) => (post.updated > max ? post.updated : max), "")
