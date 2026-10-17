// PROTOTYPE - throwaway. /how-it-works variant A, "Screens": the intro film's opener as the hero, then one feature
// per row, zigzag on wide screens: the feature's own intro scene playing on a screen as it scrolls into view, a short
// headline and one line beside it.
import { Link } from "@remix-run/react"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { type Feature, HIW_FEATURES, HIW_INTRO } from "./features"
import { IntroDataProvider, SceneScreen } from "./scene-screen"
import { Cta, Kicker, MoreLink } from "./ui"

export function HiwA() {
	return (
		<IntroDataProvider>
			<div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-8 pb-24 text-gray-300 sm:px-8 md:pt-14">
				<header className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
					<div className="flex flex-col gap-4">
						<h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{HIW_INTRO.title}</h1>
						<p className="text-lg leading-relaxed text-gray-300 sm:text-xl">{HIW_INTRO.line}</p>
						<div className="mt-2 flex flex-wrap gap-3">
							<Cta to="/taste" primary>
								Find your taste
							</Cta>
							<Cta to="/discover">Open Discover</Cta>
						</div>
					</div>
					<SceneScreen id="chat" className="aspect-[4/3] rounded-2xl ring-1 ring-white/10 sm:aspect-video" replay />
				</header>

				<ol className="mt-16 flex flex-col gap-16 sm:mt-24 sm:gap-24 lg:gap-28">
					{HIW_FEATURES.map((f, i) => (
						<Row key={f.id} f={f} flip={i % 2 === 1} />
					))}
				</ol>

				<Closer />
			</div>
		</IntroDataProvider>
	)
}

function Row({ f, flip }: { f: Feature; flip: boolean }) {
	return (
		<li
			id={f.id}
			className="grid scroll-mt-24 items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14"
		>
			<div className={flip ? "lg:order-2" : ""}>
				{f.scene === "ai" ? (
					<ChatDemo className="mx-auto max-w-xl" />
				) : (
					<SceneScreen id={f.scene} className="aspect-[4/3] rounded-2xl ring-1 ring-white/10 sm:aspect-video" replay />
				)}
			</div>
			<div className={`flex flex-col gap-3 ${flip ? "lg:order-1" : ""}`}>
				<Kicker>{f.kicker}</Kicker>
				<h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{f.title}</h2>
				<p className="text-lg leading-relaxed text-gray-300">{f.line}</p>
				<MoreLink to={f.link.to}>{f.link.label}</MoreLink>
			</div>
		</li>
	)
}

function Closer() {
	return (
		<section className="mt-20 flex flex-col items-center gap-5 rounded-2xl bg-gradient-to-br from-amber-950/70 via-gray-900 to-gray-900 px-5 py-12 text-center ring-1 ring-amber-500/20 sm:mt-28 sm:py-16">
			<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your turn</h2>
			<p className="max-w-md text-lg text-gray-300">Rate a few titles you loved. Your picks are ready in a minute.</p>
			<div className="flex flex-wrap justify-center gap-3">
				<Cta to="/taste" primary>
					Find your taste
				</Cta>
				<Link to="/about" className="inline-flex min-h-12 items-center px-3 font-semibold text-amber-500 hover:text-amber-400">
					About GoodWatch →
				</Link>
			</div>
		</section>
	)
}
