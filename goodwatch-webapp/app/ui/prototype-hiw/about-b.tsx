// PROTOTYPE - throwaway. /about variant B, "Before and after": the why as a picture. Four sites as browser tabs, then
// the intro's "One score" scene playing their numbers into one. Below: four numbers, where to find us as tiles, and the
// data credits.
import { assetUrl } from "~/utils/asset-url"
import { ABOUT, ABOUT_NUMBERS } from "./about-content"
import { CreatorChip, Credits, FindUs, LOGOS } from "./about-parts"
import { IntroDataProvider, SceneScreen } from "./scene-screen"
import { Cta, Kicker } from "./ui"

const TABS = [LOGOS.imdb, LOGOS.metacritic, LOGOS.rotten, LOGOS.justwatch]

export function AboutB() {
	return (
		<IntroDataProvider>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-10 pb-24 text-gray-300 sm:px-8 md:gap-24 md:pt-16">
				<header className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
					<div className="flex flex-col gap-5">
						<Kicker>About GoodWatch</Kicker>
						<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
							Four tabs became <span className="text-amber-400">one place.</span>
						</h1>
						<div className="flex flex-col gap-3 text-lg leading-relaxed">
							{ABOUT.story.map((s) => (
								<p key={s}>{s}</p>
							))}
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<CreatorChip />
							<span className="text-sm text-gray-500">Since {ABOUT.since}</span>
						</div>
					</div>

					<figure className="flex flex-col gap-3">
						{/* Before: the four sites as browser tabs. */}
						<div className="flex gap-1.5 overflow-hidden" aria-label="Before: four sites">
							{TABS.map((t, i) => (
								<div
									key={t.alt}
									className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-t-xl px-3 ring-1 ring-white/10 ${i === 3 ? "bg-gray-800" : "bg-gray-800/50"}`}
								>
									<img src={assetUrl(t.src)} alt={t.alt} className="h-5 w-auto max-w-[4.5rem] shrink-0 object-contain opacity-90" />
									<span className="hidden truncate text-xs text-gray-500 sm:inline">{t.alt}</span>
								</div>
							))}
						</div>
						{/* After: their numbers become one score. */}
						<SceneScreen id="one-score" className="-mt-3 aspect-video rounded-2xl rounded-tl-none ring-1 ring-white/10" replay />
						<figcaption className="text-sm text-gray-500">What GoodWatch does with them: five numbers, one score.</figcaption>
					</figure>
				</header>

				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{ABOUT_NUMBERS.map(({ n, label }) => (
						<div key={label} className="flex flex-col gap-1 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
							<dt className="order-2 text-sm text-gray-400">{label}</dt>
							<dd className="text-3xl font-black tracking-tight text-amber-400 sm:text-4xl">{n}</dd>
						</div>
					))}
				</dl>

				<section aria-labelledby="b-find" className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<h2 id="b-find" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
							Built in the open
						</h2>
						<p className="text-lg text-gray-400">The code is public. Questions, ideas and bugs are welcome.</p>
					</div>
					<FindUs tiles />
				</section>

				<section className="flex flex-col items-start gap-6 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
					<Credits />
					<div className="flex flex-wrap gap-3">
						<Cta to="/how-it-works" primary>
							How it works
						</Cta>
					</div>
				</section>
			</div>
		</IntroDataProvider>
	)
}
