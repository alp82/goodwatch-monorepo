// PROTOTYPE - throwaway. /about variant C, "Questions": the old FAQ, kept as a FAQ but cut to six short answers, all
// open (no accordion). Wide screens: who and how to reach us stay in a sticky column on the left.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { ABOUT, ABOUT_FEATURES, ABOUT_NUMBERS } from "./about-content"
import { CreatorChip, Credits, FindUs } from "./about-parts"
import { Cta, Kicker, MoreLink } from "./ui"

const linkClass = "font-semibold text-amber-500 hover:text-amber-400"

const QUESTIONS: { q: string; a: ReactNode }[] = [
	{
		q: "Why does GoodWatch exist?",
		a: (
			<>
				{ABOUT.story.map((s) => (
					<p key={s}>{s}</p>
				))}
			</>
		),
	},
	{
		q: "What does it do?",
		a: (
			<>
				<ul className="grid gap-2 sm:grid-cols-2">
					{ABOUT_FEATURES.map(({ icon: Icon, title, line, to }) => (
						<li key={title}>
							<Link to={to} prefetch="intent" className="group flex items-start gap-2.5">
								<Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
								<span>
									<span className="font-semibold text-white group-hover:text-amber-300">{title}.</span>{" "}
									<span className="text-gray-400">{line}.</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
				<MoreLink to="/how-it-works">See how it works</MoreLink>
			</>
		),
	},
	{
		q: "Who makes it?",
		a: (
			<p>
				{ABOUT.creator.name}, since {ABOUT.since}. The code is public on{" "}
				<a href="https://github.com/alp82/goodwatch-monorepo" target="_blank" rel="noreferrer" className={linkClass}>
					GitHub
				</a>
				, and build notes are on{" "}
				<a href="https://dev.to/t/goodwatch" target="_blank" rel="noreferrer" className={linkClass}>
					dev.to
				</a>
				.
			</p>
		),
	},
	{
		q: "Where does the data come from?",
		a: (
			<>
				<p>Movies, shows and where they stream from TMDB and JustWatch. Scores from IMDb, Rotten Tomatoes, Metacritic and TMDB.</p>
				<Credits />
			</>
		),
	},
	{
		q: "What does it cost?",
		a: <p>Nothing. GoodWatch is free.</p>,
	},
	{
		q: "How do I reach you?",
		a: (
			<>
				<p>
					Chat on Discord or Reddit, or write to us from{" "}
					<Link to="/support" prefetch="intent" className={linkClass}>
						Support
					</Link>
					.
				</p>
				<FindUs />
			</>
		),
	},
]

export function AboutC() {
	return (
		<div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-10 pb-24 text-gray-300 sm:px-8 md:pt-16 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
			<aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
				<Kicker>About GoodWatch</Kicker>
				<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{ABOUT.tagline}</h1>
				<CreatorChip />
				<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-6">
					{ABOUT_NUMBERS.map(({ n, label }) => (
						<div key={label} className="flex flex-col">
							<dt className="order-2 text-sm text-gray-400">{label}</dt>
							<dd className="text-2xl font-black tracking-tight text-white">{n}</dd>
						</div>
					))}
				</dl>
				<div className="flex flex-wrap gap-3">
					<Cta to="/taste" primary>
						Find your taste
					</Cta>
				</div>
			</aside>

			<ol className="flex flex-col">
				{QUESTIONS.map(({ q, a }, i) => (
					<li key={q} className={`flex flex-col gap-3 py-8 ${i ? "border-t border-white/10" : "pt-0 lg:pt-2"}`}>
						<h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{q}</h2>
						<div className="flex flex-col gap-3 text-lg leading-relaxed">{a}</div>
					</li>
				))}
			</ol>
		</div>
	)
}
