// The blog's posts. posts.json is the one list: the sitemap generator (scripts/sitemap_blog.py) reads it too, so a post
// is in the sitemap with the same dates the page shows, and a draft is left out there as here. Only loaders read it,
// so it never reaches the browser's bundle. A post's text is app/content/blog/<slug>/post.mdx.
import posts from "~/content/blog/posts.json"
import { byNewest, lastUpdated, listedPosts } from "~/utils/blog-posts"
import type { BlogPost } from "~/utils/blog-structured-data"

/** Every post, drafts included, newest first. */
export const blogPosts: readonly BlogPost[] = byNewest(posts as BlogPost[])

/** The posts /blog and the feed list: no drafts. */
export const listedBlogPosts: readonly BlogPost[] = listedPosts(blogPosts)

/** Any post, a draft too: a draft renders at its address for a preview. */
export const findBlogPost = (slug: string | undefined) =>
	blogPosts.find((post) => post.slug === slug)

/** The newest day a listed post changed, or null while none is listed. */
export const blogUpdated = () => lastUpdated(listedBlogPosts)
