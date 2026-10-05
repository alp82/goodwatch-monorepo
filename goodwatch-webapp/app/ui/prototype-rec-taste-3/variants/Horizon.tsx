// PROTOTYPE - throwaway. Sides: horizon (bolder). Each side is a full-bleed band named in large condensed
// type. One line of posters runs through it: what you love on the left, a horizon line, and on the right
// the edge just past it. You read your taste and where it could go in one glance.
import { Link } from "@remix-run/react"
import {
	CONDENSED,
	Frame,
	Head,
	MatchText,
	Plain,
	type View3Props,
	YourScore,
	backdrop,
	href,
	pct,
	sideViews,
} from "../kit3"

const TRACK =
	"t3-noscroll -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-[repeat(4,minmax(0,1fr))_6.5rem_repeat(4,minmax(0,1fr))] md:overflow-visible md:px-0"

export default function Horizon({ data }: View3Props) {
	const views = sideViews(data)
	return (
		<div>
			<Frame>
				<Head
					title="Sides of you"
					sub="What you love, and the horizon just past it."
				/>
			</Frame>
			<div className="mt-10">
				{views.map((v) => (
					<section
						key={v.side.id}
						className="relative isolate overflow-hidden border-t border-white/10 py-12 md:py-16"
					>
						{v.heart && (
							<img
								src={backdrop(v.heart)}
								alt=""
								className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
								loading="lazy"
							/>
						)}
						<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950/95 via-gray-950/75 to-gray-950/90" />
						<Frame>
							<p className="text-sm text-gray-300">
								{pct(v.side.share)} of what you love
							</p>
							<h3
								className="mt-1 text-5xl font-extrabold leading-[0.9] md:text-8xl"
								style={CONDENSED}
							>
								{v.side.name}
							</h3>
							<div className={`mt-8 ${TRACK}`}>
								{v.loved.slice(0, 4).map((t) => (
									<Link
										key={t.key}
										to={href(t)}
										className="block w-28 shrink-0 md:w-auto"
									>
										<Plain t={t} size="w185" linked={false} />
										<span className="mt-2 block">
											{t.mine != null && <YourScore score={t.mine} size="sm" />}
										</span>
									</Link>
								))}
								<div
									className="flex w-24 shrink-0 flex-col items-center justify-between py-1 text-center md:w-auto"
									aria-hidden={!v.edge}
								>
									<span className="text-xs font-semibold text-amber-300">
										You're here
									</span>
									<span className="my-2 w-0.5 grow rounded-full bg-linear-to-b from-amber-400 to-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.6)]" />
									<span className="text-xs font-semibold text-sky-300">
										Just past it
									</span>
								</div>
								{v.edgePicks.slice(0, 4).map((t) => (
									<Link
										key={t.key}
										to={href(t)}
										className="block w-28 shrink-0 md:w-auto"
									>
										<Plain
											t={t}
											size="w185"
											linked={false}
											className="rounded-md ring-2 ring-sky-400/40"
										/>
										<MatchText match={t.match} short className="mt-2 block" />
									</Link>
								))}
							</div>
							{v.edge && (
								<p className="mt-6 max-w-3xl text-gray-300 md:ml-auto md:text-right">
									<span
										className="mr-2 text-2xl font-extrabold text-sky-300 md:text-3xl"
										style={CONDENSED}
									>
										{v.edge.name}
									</span>
									{v.edge.line}
								</p>
							)}
						</Frame>
					</section>
				))}
			</div>
		</div>
	)
}
