// /about: one narrow column that reads like a short note. The tagline, why GoodWatch exists and who makes it; what it
// does (four tiles into /how-it-works); four numbers; where to find us; where the data comes from. Facts checked on
// 2026-10-18: since 2023 is the repo's first commit, "free" is the sign-up page's word, the numbers are the start page
// intro's snapshot (server/living-room/intro/content.json, captured 2026-10-17).
import {
	FingerPrintIcon,
	SparklesIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { CreatorChip, Credits, FindUs } from "~/ui/about/AboutParts"
import { Kicker, MoreLink } from "~/ui/info-page"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "About | GoodWatch",
		description:
			"Why GoodWatch exists, who makes it and where its data comes from. Every score, every streaming service and picks for your taste, in one place.",
		url: "https://goodwatch.app/about",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "About GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

const FEATURES = [
	{
		icon: StarIcon,
		title: "One score",
		line: "Critics and audiences from four sites, in one number",
		to: "/how-it-works#score",
	},
	{
		icon: TvIcon,
		title: "Where it streams",
		line: "325 services in 139 countries",
		to: "/how-it-works#streaming",
	},
	{
		icon: SparklesIcon,
		title: "Picks for your taste",
		line: "From the titles you loved",
		to: "/how-it-works#for-you",
	},
	{
		icon: FingerPrintIcon,
		title: "How it feels",
		line: "Every title read on 74 traits",
		to: "/how-it-works#title-analysis",
	},
]

const NUMBERS = [
	{ n: "1.5M", label: "movies and shows" },
	{ n: "325", label: "streaming services" },
	{ n: "139", label: "countries" },
	{ n: "Free", label: "to use" },
]

export default function About() {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-14 px-4 pt-10 pb-24 text-gray-300 sm:px-8 md:pt-20">
			<header className="flex flex-col gap-6">
				<Kicker>About GoodWatch</Kicker>
				<h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
					Every score, every service,{" "}
					<span className="text-amber-400">one place.</span>
				</h1>
				<div className="flex flex-col gap-3 text-lg leading-relaxed text-gray-300 sm:text-xl">
					<p>
						I used to jump between IMDb, Metacritic, Rotten Tomatoes and
						JustWatch to decide what to watch next.
					</p>
					<p>
						So I built one place for all of it. Now it also learns your taste
						and picks for you.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<CreatorChip />
					<span className="text-sm text-gray-500">Since 2023</span>
				</div>
			</header>

			<section aria-labelledby="about-what" className="flex flex-col gap-5">
				<h2
					id="about-what"
					className="text-xl font-bold tracking-tight text-white sm:text-2xl"
				>
					What it does
				</h2>
				<ul className="grid gap-3 sm:grid-cols-2">
					{FEATURES.map(({ icon: Icon, title, line, to }) => (
						<li key={title}>
							<Link
								to={to}
								prefetch="intent"
								className="flex h-full items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
							>
								<Icon
									className="mt-0.5 h-6 w-6 shrink-0 text-amber-400"
									aria-hidden="true"
								/>
								<span className="flex flex-col">
									<span className="font-semibold text-white">{title}</span>
									<span className="text-sm text-gray-400">{line}</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
				<MoreLink to="/how-it-works">See how it works</MoreLink>
			</section>

			<dl className="grid grid-cols-2 gap-y-6 border-y border-white/10 py-8 sm:grid-cols-4">
				{NUMBERS.map(({ n, label }) => (
					<div key={label} className="flex flex-col gap-1">
						<dt className="order-2 text-sm text-gray-400">{label}</dt>
						<dd className="text-3xl font-black tracking-tight text-white">
							{n}
						</dd>
					</div>
				))}
			</dl>

			<section aria-labelledby="about-find" className="flex flex-col gap-4">
				<h2
					id="about-find"
					className="text-xl font-bold tracking-tight text-white sm:text-2xl"
				>
					Find us
				</h2>
				<FindUs />
			</section>

			<Credits className="border-t border-white/10 pt-6" />
		</div>
	)
}
