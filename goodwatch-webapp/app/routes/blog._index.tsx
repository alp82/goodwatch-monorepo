// /blog: GoodWatch's posts, newest first. Data studies and notes on how GoodWatch is built. The list is posts.json,
// read by the loader only, so it stays out of the browser's bundle. Drafts aren't listed. Without a listed post the
// page shows an empty state and stays out of the index.
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { blogPosts, listedBlogPosts } from "~/server/blog/posts.server"
import { Kicker } from "~/ui/info-page"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { blogIndexRobots, isDraft } from "~/utils/blog-posts"
import { buildMeta, ogImageUrl } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

const BLOG_URL = "https://goodwatch.app/blog"
const TRAIL: Crumb[] = [
	{ label: "Home", path: "/" },
	{ label: "Blog", path: "/blog" },
]

const longDate = (day: string) =>
	new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	})

// `/blog?drafts` also lists the drafts, marked as such, so a draft's card can be previewed. That view is never
// indexed; the canonical address stays /blog.
export const loader = ({ request }: LoaderFunctionArgs) => {
	const withDrafts = new URL(request.url).searchParams.has("drafts")
	const posts = withDrafts ? blogPosts : listedBlogPosts
	return json({
		robots: withDrafts
			? ("noindex, follow" as const)
			: blogIndexRobots(listedBlogPosts),
		posts: posts.map((post) => ({
			slug: post.slug,
			draft: isDraft(post),
			kind: post.kind,
			title: post.title,
			dek: post.card?.dek ?? post.description,
			published: post.published,
			dateLabel: post.card?.date_label ?? longDate(post.published),
			linkLabel: post.card?.link_label ?? "Read the post",
		})),
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) =>
	buildMeta({
		pageMeta: {
			title: "Blog | GoodWatch",
			description:
				"Data studies about where movies and shows stream, and notes on how GoodWatch is built.",
			url: BLOG_URL,
			image: ogImageUrl(BLOG_URL),
			alt: "The GoodWatch blog",
		},
		robots: data?.robots ?? "noindex, follow",
		breadcrumbs: TRAIL,
	})

export const links = () => [
	{
		rel: "alternate",
		type: "application/rss+xml",
		title: "GoodWatch blog",
		href: "https://goodwatch.app/blog/rss.xml",
	},
]

export default function Blog() {
	const { posts } = useLoaderData<typeof loader>()
	return (
		<>
			<Breadcrumbs items={TRAIL} />
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-10 pb-24 text-gray-300 sm:px-8 md:pt-16">
				<header className="flex flex-col gap-4">
					<Kicker>Blog</Kicker>
					<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
						Studies and notes
					</h1>
					<p className="text-lg leading-relaxed text-gray-300 sm:text-xl">
						What we find in the data behind GoodWatch, and how we build it.
					</p>
				</header>
				{posts.length > 0 ? (
					<ul className="flex flex-col gap-4">
						{posts.map((post) => (
							<li key={post.slug}>
								<Link
									to={`/blog/${post.slug}`}
									prefetch="intent"
									className="group flex flex-col gap-3 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
								>
									<span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
										{post.kind}
										{post.draft ? (
											<span className="ml-2 text-gray-500">· Draft</span>
										) : null}
									</span>
									<span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
										{post.title}
									</span>
									<span className="leading-relaxed text-gray-400">
										{post.dek}
									</span>
									<span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
										<span className="text-gray-500">
											<span className="font-semibold text-gray-300">
												GoodWatch
											</span>
											{" · "}
											<time dateTime={post.published}>{post.dateLabel}</time>
										</span>
										<span className="font-semibold text-amber-500 group-hover:text-amber-400">
											{post.linkLabel} <span aria-hidden="true">→</span>
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				) : (
					<p className="rounded-2xl bg-white/[0.04] p-5 text-gray-400 ring-1 ring-white/10">
						No posts yet. The first data study is on its way.
					</p>
				)}
				<p className="text-sm text-gray-500">
					Follow along with the{" "}
					<a
						href="/blog/rss.xml"
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						RSS feed
					</a>
					.
				</p>
			</div>
		</>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/blog._index")
