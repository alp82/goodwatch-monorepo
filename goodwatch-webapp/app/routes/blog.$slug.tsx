// /blog/<slug>: one post. Its text is app/content/blog/<slug>/post.mdx, compiled to React at build time; its title,
// dates and summary are in posts.json, which the sitemap reads too. The page is one narrow column in the about
// page's look. Charts and tables are in the server's HTML and need no script.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ComponentType } from "react"
import { blogDataset } from "~/server/blog/datasets.server"
import { findBlogPost } from "~/server/blog/posts.server"
import { postComponents } from "~/ui/blog/mdx-components"
import { Kicker } from "~/ui/info-page"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { isDraft, postRobots } from "~/utils/blog-posts"
import {
	type BlogPost,
	blogPostUrl,
	blogPostingJsonLd,
	datasetJsonLd,
} from "~/utils/blog-structured-data"
import { buildMeta, ogImageUrl } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

type PostModule = {
	default: ComponentType<{ components?: typeof postComponents }>
}

// Every post's text, compiled with the build. A handful of posts is small; past that, load the one asked for.
const POSTS = import.meta.glob<PostModule>("../content/blog/*/post.mdx", {
	eager: true,
})
const postText = (slug: string) =>
	POSTS[`../content/blog/${slug}/post.mdx`]?.default

const trail = (post: BlogPost): Crumb[] => [
	{ label: "Home", path: "/" },
	{ label: "Blog", path: "/blog" },
	{ label: post.title, path: `/blog/${post.slug}` },
]

export const loader = ({ params }: LoaderFunctionArgs) => {
	const post = findBlogPost(params.slug)
	if (!post || !postText(post.slug))
		throw new Response("Not found", { status: 404 })
	const url = blogPostUrl(post.slug)
	const dataset = blogDataset(post.slug)
	const structuredData: Record<string, unknown>[] = [
		blogPostingJsonLd(post, ogImageUrl(url)),
	]
	if (dataset) structuredData.push(datasetJsonLd(post, dataset))
	return json({ post, structuredData })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not found | GoodWatch" }]
	const { post, structuredData } = data
	const url = blogPostUrl(post.slug)
	return buildMeta({
		pageMeta: {
			title: `${post.title} | GoodWatch`,
			description: post.description,
			url,
			image: ogImageUrl(url),
			alt: post.title,
		},
		article: { published: post.published, modified: post.updated },
		structuredData,
		breadcrumbs: trail(post),
		// A draft renders for a preview but stays out of the index, and its links aren't followed.
		robots: postRobots(post),
	})
}

export const links = () => [
	{
		rel: "alternate",
		type: "application/rss+xml",
		title: "GoodWatch blog",
		href: "https://goodwatch.app/blog/rss.xml",
	},
]

// "October 18, 2026" for 2026-10-18, the same on the server and in every time zone. Kept here: a small helper that
// two routes share would ride on every page (vite.config.js, rule 3).
const longDate = (day: string) =>
	new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	})

export default function BlogPostPage() {
	const { post } = useLoaderData<typeof loader>()
	const Text = postText(post.slug)
	return (
		<>
			<Breadcrumbs items={trail(post)} />
			<article className="mx-auto w-full max-w-2xl px-4 pt-10 pb-24 text-base text-gray-300 sm:px-8 sm:text-lg md:pt-16">
				<header className="flex flex-col gap-6">
					{isDraft(post) ? (
						<p
							role="note"
							className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-gray-400 ring-1 ring-white/10"
						>
							<span className="font-semibold text-amber-400">Draft.</span> This
							post isn't listed on the blog, in the feed or in the sitemap, and
							search engines don't index it.
						</p>
					) : null}
					<Kicker>{post.kind}</Kicker>
					<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
						{post.title}
					</h1>
					<p className="text-lg leading-relaxed text-gray-300 sm:text-xl">
						{post.description}
					</p>
					<p className="text-sm text-gray-500">
						By <span className="font-semibold text-gray-300">GoodWatch</span>
						{" · "}
						<time dateTime={post.published}>{longDate(post.published)}</time>
						{post.updated !== post.published ? (
							<>
								{" · Updated "}
								<time dateTime={post.updated}>{longDate(post.updated)}</time>
							</>
						) : null}
					</p>
				</header>
				{Text ? <Text components={postComponents} /> : null}
			</article>
		</>
	)
}
