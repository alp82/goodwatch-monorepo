// /blog: GoodWatch's posts, newest first. Data studies and notes on how GoodWatch is built. The list is posts.json,
// read by the loader only, so it stays out of the browser's bundle.
import { type MetaFunction, json } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { blogPosts } from "~/server/blog/posts.server"
import { Kicker } from "~/ui/info-page"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
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

export const loader = () =>
	json({
		posts: blogPosts.map((post) => ({
			slug: post.slug,
			title: post.title,
			description: post.description,
			kind: post.kind,
			published: post.published,
			date: longDate(post.published),
		})),
	})

export const meta: MetaFunction = () =>
	buildMeta({
		pageMeta: {
			title: "Blog | GoodWatch",
			description:
				"Data studies about where movies and shows stream, and notes on how GoodWatch is built.",
			url: BLOG_URL,
			image: ogImageUrl(BLOG_URL),
			alt: "The GoodWatch blog",
		},
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
				<ul className="flex flex-col gap-4">
					{posts.map((post) => (
						<li key={post.slug}>
							<Link
								to={`/blog/${post.slug}`}
								prefetch="intent"
								className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
							>
								<span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
									{post.kind}
								</span>
								<span className="text-xl font-bold tracking-tight text-white">
									{post.title}
								</span>
								<span className="text-gray-400">{post.description}</span>
								<time
									dateTime={post.published}
									className="text-sm text-gray-500"
								>
									{post.date}
								</time>
							</Link>
						</li>
					))}
				</ul>
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
