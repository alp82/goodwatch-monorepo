// PROTOTYPE - throwaway. /how-it-works variant C, "Pictures": no film and no screens. Each row is centred: a short
// headline and one line, then one big still picture built from the intro's kit parts (kit-visuals.tsx), whose parts
// rise in as it scrolls into view. The calmest of the three.
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { type Feature, HIW_FEATURES, HIW_INTRO } from "./features"
import { KitPicture, hasPicture } from "./kit-visuals"
import { IntroDataProvider } from "./scene-screen"
import { Cta, Kicker, MoreLink } from "./ui"

export function HiwC() {
	return (
		<IntroDataProvider>
			<div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-10 pb-24 text-center text-gray-300 sm:px-8 md:pt-20">
				<header className="flex max-w-2xl flex-col items-center gap-4">
					<h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">{HIW_INTRO.title}</h1>
					<p className="text-lg leading-relaxed text-gray-300 sm:text-xl">{HIW_INTRO.line}</p>
				</header>

				<ol className="mt-20 flex w-full flex-col gap-24 sm:mt-28 sm:gap-36">
					{HIW_FEATURES.map((f) => (
						<Row key={f.id} f={f} />
					))}
				</ol>

				<section className="mt-28 flex flex-col items-center gap-5 sm:mt-36">
					<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your turn</h2>
					<p className="max-w-md text-lg text-gray-300">Rate a few titles you loved. Your picks are ready in a minute.</p>
					<div className="flex flex-wrap justify-center gap-3">
						<Cta to="/taste" primary>
							Find your taste
						</Cta>
						<Cta to="/discover">Open Discover</Cta>
					</div>
				</section>
			</div>
		</IntroDataProvider>
	)
}

function Row({ f }: { f: Feature }) {
	return (
		<li id={f.id} className="flex scroll-mt-24 flex-col items-center gap-3">
			<Kicker>{f.kicker}</Kicker>
			<h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{f.title}</h2>
			<p className="max-w-xl text-lg leading-relaxed text-gray-300">{f.line}</p>
			<div className="mt-6 w-full sm:mt-10">
				{f.scene === "ai" ? (
					<ChatDemo className="mx-auto max-w-xl text-left" />
				) : hasPicture(f.scene) ? (
					<KitPicture id={f.scene} className="aspect-[4/5] sm:aspect-[2/1]" />
				) : null}
			</div>
			<MoreLink to={f.link.to} className="mt-4">
				{f.link.label}
			</MoreLink>
		</li>
	)
}
