// The titles each blog post links to, first mention first ("movie/129"), as the remark plugin in vite.config.js
// exports them from the compiled post (utils/blog-linked-titles.js). The posts are compiled with the build already,
// for their pages (routes/blog.$slug.tsx), so this reads no file at run time.
const LINKED = import.meta.glob<readonly string[]>(
	"../../content/blog/*/post.mdx",
	{ eager: true, import: "linkedTitles" },
)

/** The titles a post links to, or null when the post has no text (its page answers 404). */
export const postLinkedTitles = (slug: string): readonly string[] | null =>
	LINKED[`../../content/blog/${slug}/post.mdx`] ?? null
