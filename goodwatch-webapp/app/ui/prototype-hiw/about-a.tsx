// PROTOTYPE - throwaway. /about variant A, "Note": one narrow column that reads top to bottom like a short letter.
// The tagline, two sentences of why, who; then what it does (four rows into /how-it-works), four numbers, where to
// find us, and the data credits.
import { ABOUT, ABOUT_FEATURES, ABOUT_NUMBERS } from "./about-content"
import { CreatorChip, Credits, FindUs } from "./about-parts"
import { Kicker, MoreLink } from "./ui"
import { Link } from "@remix-run/react"

export function AboutA() {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-14 px-4 pt-10 pb-24 text-gray-300 sm:px-8 md:pt-20">
			<header className="flex flex-col gap-6">
				<Kicker>About GoodWatch</Kicker>
				<h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
					Every score, every service, <span className="text-amber-400">one place.</span>
				</h1>
				<div className="flex flex-col gap-3 text-lg leading-relaxed text-gray-300 sm:text-xl">
					{ABOUT.story.map((s) => (
						<p key={s}>{s}</p>
					))}
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<CreatorChip />
					<span className="text-sm text-gray-500">Since {ABOUT.since}</span>
				</div>
			</header>

			<section aria-labelledby="a-what" className="flex flex-col gap-5">
				<h2 id="a-what" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
					What it does
				</h2>
				<ul className="grid gap-3 sm:grid-cols-2">
					{ABOUT_FEATURES.map(({ icon: Icon, title, line, to }) => (
						<li key={title}>
							<Link
								to={to}
								prefetch="intent"
								className="flex h-full items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.08]"
							>
								<Icon className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" aria-hidden="true" />
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
				{ABOUT_NUMBERS.map(({ n, label }) => (
					<div key={label} className="flex flex-col gap-1">
						<dt className="order-2 text-sm text-gray-400">{label}</dt>
						<dd className="text-3xl font-black tracking-tight text-white">{n}</dd>
					</div>
				))}
			</dl>

			<section aria-labelledby="a-find" className="flex flex-col gap-4">
				<h2 id="a-find" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
					Find us
				</h2>
				<FindUs />
			</section>

			<Credits className="border-t border-white/10 pt-6" />
		</div>
	)
}
