// /blog/rss.xml: every post in full, newest first. With the whole text in the feed, a reader shows the post, and
// dev.to's import brings it in as a draft whose canonical address is the post on goodwatch.app.
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { blogPosts, blogUpdated } from "~/server/blog/posts.server"
import { feedComponents } from "~/ui/blog/feed-components"
import { blogPostUrl } from "~/utils/blog-structured-data"
import { rssFeed } from "~/utils/rss"

type PostModule = {
	default: (props: { components?: typeof feedComponents }) => unknown
}

const POSTS = import.meta.glob<PostModule>("../content/blog/*/post.mdx", {
	eager: true,
})

export const loader = () => {
	const items = blogPosts.flatMap((post) => {
		const Text = POSTS[`../content/blog/${post.slug}/post.mdx`]?.default
		if (!Text) return []
		return [
			{
				title: post.title,
				url: blogPostUrl(post.slug),
				published: post.published,
				description: post.description,
				html: renderToStaticMarkup(
					createElement(Text as never, { components: feedComponents }),
				),
			},
		]
	})
	const body = rssFeed({
		title: "GoodWatch blog",
		url: "https://goodwatch.app/blog",
		feedUrl: "https://goodwatch.app/blog/rss.xml",
		description:
			"Data studies about where movies and shows stream, and notes on how GoodWatch is built.",
		updated: blogUpdated(),
		items,
	})
	return new Response(body, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	})
}
