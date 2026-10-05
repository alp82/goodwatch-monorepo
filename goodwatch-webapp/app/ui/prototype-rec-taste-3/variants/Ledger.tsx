// PROTOTYPE - throwaway. Sides: side and edge (existing). Every side at once, one row each: where you are on
// the left, what lies just past it on the right. Nothing to open; the whole map reads top to bottom.
import { Link } from "@remix-run/react"
import {
	EDGE,
	Frame,
	HOME,
	Head,
	MatchText,
	Plain,
	RatedPoster,
	type View3Props,
	href,
	pct,
	sideViews,
} from "../kit3"

export default function Ledger({ data }: View3Props) {
	const views = sideViews(data)
	return (
		<Frame>
			<Head
				title="Sides of you"
				sub="Where your taste lives, and what lies just past each part of it."
			/>
			<div className="mt-10">
				{views.map((v) => (
					<article
						key={v.side.id}
						className="grid gap-8 border-t border-white/10 py-10 lg:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] lg:gap-6"
					>
						<div className="min-w-0">
							<p className={`text-sm font-semibold ${HOME}`}>
								You're here, with {pct(v.side.share)} of what you love
							</p>
							<h3 className="mt-1 text-2xl font-bold md:text-3xl">
								{v.side.name}
							</h3>
							<div className="mt-5 grid grid-cols-4 gap-3">
								{v.loved.slice(0, 4).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
						<div
							className="hidden items-center justify-center lg:flex"
							aria-hidden
						>
							<span className="h-full w-px bg-linear-to-b from-amber-400/0 via-sky-400/50 to-sky-400/0" />
						</div>
						<div className="min-w-0">
							{v.edge ? (
								<>
									<p className={`text-sm font-semibold ${EDGE}`}>Just past it</p>
									<h3 className="mt-1 text-2xl font-bold md:text-3xl">
										{v.edge.name}
									</h3>
									<div className="mt-5 grid grid-cols-4 gap-3">
										{v.edgePicks.slice(0, 4).map((t) => (
											<Link key={t.key} to={href(t)} className="block min-w-0">
												<Plain t={t} size="w185" linked={false} />
												<MatchText match={t.match} short className="mt-1.5 block" />
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
