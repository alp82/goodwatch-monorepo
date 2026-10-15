// PROTOTYPE - throwaway (#657). Variant "Sides as moods" (existing components, overview first): the sides are the
// GoodWatch moods (or mood pairs) the person's loved titles fall into, named and colored like the mood picker, shown
// as an overview of tiles with one opened below. Just past a side: a mood they rarely mix in, or a place. Every side
// and mood edge opens in Watch next with those moods, which is how other places could reuse the sides.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { RatedPoster, posterUrl, titlesOf, useServicesFilter } from "~/ui/taste/tabs/parts"
import { AttributeChips, PosterRow, edgePicks } from "./bits"
import type { ProtoSide, ProtoView } from "./model"
import { MoreOfThis } from "./Tighter"

const watchNext = (moods: string[]) => `/watch-next?moods=${moods.join(",")}`
const stripe = (side: ProtoSide) => (side.hues.length > 1 ? `linear-gradient(90deg, ${side.hues.join(", ")})` : side.hues[0])

export function Moods({ view }: { view: ProtoView }) {
	const [openId, setOpenId] = useState(view.sides[0]?.id ?? "")
	const side = view.sides.find((s) => s.id === openId) ?? view.sides[0]
	const services = useServicesFilter(view.hasServices)
	if (!side) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">Too few loved titles for sides.</p>
	return (
		<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
			<h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">The moods you love most</h1>
			<p className="mt-3 max-w-2xl text-gray-400">
				Your {view.member.loved} favorite titles, by the moods you pick in Watch next. A title can be in two moods.
				{view.loose > 0 && ` ${view.loose} of them fit none of these.`}
			</p>
			<div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{view.sides.map((s) => {
					const on = s.id === side.id
					const covers = titlesOf(view.titles, s.here).slice(0, 3)
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => setOpenId(s.id)}
							aria-pressed={on}
							className={`relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border-2 p-3 pl-5 text-left transition ${on ? "border-amber-500 bg-amber-950/30" : "border-gray-800 bg-gray-900/40 hover:border-gray-500"}`}
						>
							<span className="absolute inset-y-0 left-0 w-1.5" style={{ background: stripe(s) }} />
							<span className="flex shrink-0 -space-x-5">
								{covers.map((t) => (
									<img key={t.key} src={posterUrl(t, "w185")} alt="" className="w-12 rounded-md border-2 border-gray-950" />
								))}
							</span>
							<span className="min-w-0">
								<span className="block text-lg font-bold leading-tight">{s.name}</span>
								<span className="mt-1 block text-sm text-gray-400">
									{Math.round(s.share * 100)}% of what you love ({s.count} titles)
								</span>
								<span className="mt-2 block h-1.5 w-40 overflow-hidden rounded-full bg-gray-800">
									<span className="block h-full rounded-full" style={{ width: `${Math.round(s.share * 100)}%`, background: stripe(s) }} />
								</span>
							</span>
						</button>
					)
				})}
			</div>

			<div className="mt-8 rounded-2xl border-2 border-gray-800 p-4 md:p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-sm font-semibold text-amber-300">You're here</p>
						<h2 className="text-3xl font-bold leading-tight md:text-4xl">{side.name}</h2>
					</div>
					<Link to={watchNext(side.moods)} className="inline-flex min-h-11 items-center rounded-full border-2 border-amber-600/70 bg-amber-900/30 px-4 text-sm font-semibold text-amber-100 hover:border-amber-400 md:min-h-9">
						Open {side.name} in Watch next
					</Link>
				</div>
				<AttributeChips side={side} className="mt-3" />
				<PosterRow keys={side.here} titles={view.titles} n={6} className="mt-5 grid-cols-3 sm:grid-cols-6" />

				<h3 className="mt-8 text-sm font-semibold text-sky-300">Just past it</h3>
				{side.edges.length ? (
					<div className="mt-3 grid gap-3 lg:grid-cols-2">
						{side.edges.map((edge) => (
							<div key={edge.id} className="rounded-xl border-2 border-sky-400/30 bg-gray-950/60 p-4">
								<div className="flex flex-wrap items-baseline justify-between gap-2">
									<h4 className="text-xl font-bold leading-tight">{edge.line}</h4>
									{edge.moods && (
										<Link to={watchNext(edge.moods)} className="text-sm font-semibold text-sky-300 hover:text-sky-200">
											Open in Watch next
										</Link>
									)}
								</div>
								<p className="mt-1 text-sm text-gray-300">{edge.evidence}</p>
								<div className="mt-3 grid grid-cols-4 gap-2">
									{edgePicks(view.titles, edge, services, 4).map((t) => (
										<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
									))}
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="mt-2 text-sm text-gray-400">Nothing just past this mood yet.</p>
				)}
				<MoreOfThis side={side} view={view} services={services} />
			</div>
		</section>
	)
}
