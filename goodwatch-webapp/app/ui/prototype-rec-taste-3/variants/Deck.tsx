// PROTOTYPE - throwaway. Sides: deck (bolder). One tall card per side, the side's defining title as the
// cover, its name set large, and the edge just past it underneath. Four cards side by side on desktop,
// a swipeable deck on mobile.
import { Link } from "@remix-run/react"
import {
	CONDENSED,
	Frame,
	Head,
	MatchText,
	Plain,
	type View3Props,
	href,
	pct,
	poster,
	sideViews,
} from "../kit3"

export default function Deck({ data }: View3Props) {
	const views = sideViews(data)
	const cols =
		views.length >= 4
			? "lg:grid-cols-[repeat(4,minmax(0,1fr))]"
			: views.length === 3
				? "lg:grid-cols-[repeat(3,minmax(0,1fr))]"
				: "lg:grid-cols-[repeat(2,minmax(0,1fr))] lg:max-w-4xl"
	return (
		<Frame>
			<Head
				title="Sides of you"
				sub="Swipe through the sides of your taste. Each one ends where something new begins."
			/>
			<div
				className={`t3-noscroll -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 ${cols}`}
			>
				{views.map((v) => (
					<article
						key={v.side.id}
						className="flex w-[80vw] min-w-0 max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900 lg:w-auto lg:max-w-none"
					>
						<Link
							to={v.heart ? href(v.heart) : "#"}
							className="relative block aspect-[4/5] overflow-hidden"
						>
							{v.heart && (
								<img
									src={poster(v.heart, "w500")}
									alt={`Poster for ${v.heart.title}`}
									className="absolute inset-0 h-full w-full object-cover object-top"
									loading="lazy"
								/>
							)}
							<span className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/70 to-transparent to-70%" />
							<span className="absolute inset-x-0 bottom-0 p-5">
								<span className="block text-sm text-amber-300">
									{pct(v.side.share)} of what you love
								</span>
								<span
									className="mt-1 block text-4xl font-extrabold leading-[0.92] text-white"
									style={CONDENSED}
								>
									{v.side.name}
								</span>
							</span>
						</Link>
						<div className="flex grow flex-col p-5 pt-4">
							{v.edge ? (
								<>
									<p className="text-sm text-sky-300">Just past it</p>
									<p className="text-xl font-bold">{v.edge.name}</p>
									<div className="mt-4 grid grid-cols-3 gap-2">
										{v.edgePicks.slice(0, 3).map((t) => (
											<Link key={t.key} to={href(t)} className="block min-w-0">
												<Plain t={t} size="w185" linked={false} />
												<MatchText match={t.match} short className="mt-1 block" />
											</Link>
										))}
									</div>
								</>
							) : (
								<p className="text-gray-500">
									Nothing close by that you haven't explored.
								</p>
							)}
						</div>
					</article>
				))}
			</div>
		</Frame>
	)
}
