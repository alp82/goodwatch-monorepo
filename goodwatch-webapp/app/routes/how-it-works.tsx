// /how-it-works: one feature per row, centred: a kicker, a short headline and one line, then a big picture made from
// the start page intro's parts (ui/how-it-works), then a link to the real page. The text is in the server's HTML; the
// pictures load on demand as they scroll into view. Each row has an anchor (/how-it-works#score); the start page's
// "How GoodWatch works" links to #score. #title-analysis stays compatible with existing links.
import type { MetaFunction } from "@remix-run/node"
import {
	FeaturePicture,
	IntroDataProvider,
} from "~/ui/how-it-works/FeaturePicture"
import { type Feature, HOW_IT_WORKS_FEATURES } from "~/ui/how-it-works/features"
import { ActionLink, Kicker, MoreLink } from "~/ui/info-page"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "How GoodWatch works | GoodWatch",
		description:
			"One score from IMDb, Rotten Tomatoes, Metacritic and TMDB, 325 streaming services, picks for your taste, your taste fingerprint, AI apps and the Discord bot.",
		url: "https://goodwatch.app/how-it-works",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "How GoodWatch works",
	}

	return buildMeta({ pageMeta, items: [] })
}

export default function HowItWorks() {
	return (
		<IntroDataProvider>
			<div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-10 pb-24 text-center text-gray-300 sm:px-8 md:pt-20">
				<header className="flex max-w-2xl flex-col items-center gap-4">
					<h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
						How GoodWatch works
					</h1>
					<p className="text-lg leading-relaxed text-gray-300 sm:text-xl">
						Every score, every service, one place. Here's what that looks like.
					</p>
				</header>

				<ol className="mt-20 flex w-full flex-col gap-24 sm:mt-28 sm:gap-32">
					{HOW_IT_WORKS_FEATURES.map((f) => (
						<FeatureRow key={f.id} f={f} />
					))}
				</ol>

				<section className="mt-28 flex flex-col items-center gap-5 sm:mt-36">
					<h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
						Your turn
					</h2>
					<p className="max-w-md text-lg text-gray-300">
						Rate a few titles you loved. Your picks are ready in a minute.
					</p>
					<div className="flex flex-wrap justify-center gap-3">
						<ActionLink to="/taste" primary>
							Find your taste
						</ActionLink>
						<ActionLink to="/discover">Open Discover</ActionLink>
					</div>
				</section>
			</div>
		</IntroDataProvider>
	)
}

function FeatureRow({ f }: { f: Feature }) {
	return (
		<li id={f.id} className="flex scroll-mt-24 flex-col items-center gap-3">
			<Kicker>{f.kicker}</Kicker>
			<h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
				{f.title}
			</h2>
			<p className="max-w-xl text-lg leading-relaxed text-gray-300">{f.line}</p>
			<div className="mt-6 w-full sm:mt-10">
				{f.picture === "chat" ? (
					<ChatDemo className="mx-auto max-w-xl text-left" />
				) : (
					<FeaturePicture id={f.picture} phone={f.phone} />
				)}
			</div>
			<MoreLink to={f.link.to} className="mt-4">
				{f.link.label}
			</MoreLink>
		</li>
	)
}
