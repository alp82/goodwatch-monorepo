// PROTOTYPE - throwaway. Sides: one at a time (existing). Round 2's Sides without the big header: pick a
// side, see what you love there, and right under it the edge just past it. Frontiers that sit near this
// side (a country, a language, a decade) are one tap away in the same row.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	EDGE,
	Frame,
	HOME,
	Head,
	Pick,
	RatedPoster,
	type View3Props,
	backdrop,
	mineFirst,
	pct,
	sideViews,
} from "../kit3"

export default function Focus({ data }: View3Props) {
	const views = sideViews(data)
	const [id, setId] = useState(views[0]?.side.id)
	const [far, setFar] = useState<string | null>(null)
	const v = views.find((x) => x.side.id === id) ?? views[0]
	if (!v)
		return (
			<Frame>
				<Head title="Sides of you" sub="Rate a few more titles you love to find your sides." />
			</Frame>
		)
	const frontier = v.further.find((f) => f.id === far)
	const picks = frontier
		? mineFirst(data, frontier.picks)
				.map((p) => data.items[p.key] && { ...data.items[p.key], match: p.match })
				.filter((t): t is NonNullable<typeof t> => !!t)
		: v.edgePicks

	return (
		<Frame>
			<Head
				title="Sides of you"
				sub={`What you love falls into ${views.length} groups. Each one has an edge: close by, but somewhere you've rarely gone.`}
			/>
			<div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4" role="tablist">
				{views.map((x) => {
					const on = x.side.id === v.side.id
					return (
						<button
							key={x.side.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => {
								setId(x.side.id)
								setFar(null)
							}}
							className={`relative isolate overflow-hidden rounded-xl border-2 p-4 text-left transition ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-600"}`}
						>
							{x.heart && (
								<img
									src={backdrop(x.heart, "w780")}
									alt=""
									className="absolute inset-0 -z-10 h-full w-full object-cover opacity-20"
								/>
							)}
							<span className="block text-lg font-bold leading-tight">
								{x.side.name}
							</span>
							<span className="mt-2 block text-sm text-gray-300">
								{pct(x.side.share)} of what you love
							</span>
						</button>
					)
				})}
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					key={v.side.id}
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					<div className="mt-12 flex flex-wrap items-baseline justify-between gap-2">
						<p className={`text-lg font-semibold ${HOME}`}>You're here</p>
						<p className="text-sm text-gray-400">
							You rate these {v.side.avg} on average
						</p>
					</div>
					<div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
						{v.loved.slice(0, 6).map((t) => (
							<RatedPoster key={t.key} t={t} size="w185" />
						))}
					</div>

					{v.edge && (
						<div className="mt-14 border-t border-dashed border-sky-400/30 pt-10">
							<p className={`text-lg font-semibold ${EDGE}`}>Just past it</p>
							{v.further.length === 0 && (
								<h3 className="mt-1 text-2xl font-bold md:text-3xl">{v.edge.name}</h3>
							)}
							<div className={`mt-3 flex flex-wrap gap-2 ${v.further.length ? "" : "hidden"}`}>
								{[{ id: null, name: v.edge.name }, ...v.further].map((f) => {
									const on = far === f.id
									return (
										<button
											key={f.id ?? "edge"}
											type="button"
											onClick={() => setFar(f.id)}
											aria-pressed={on}
											className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition ${on ? "border-sky-400 bg-sky-900/40 text-sky-50" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
										>
											{f.name}
										</button>
									)
								})}
							</div>
							<p className="mt-4 max-w-2xl text-gray-400">
								{frontier ? frontier.line : v.edge.line}
							</p>
							<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
								{picks.slice(0, 6).map((t) => (
									<Pick key={t.key} data={data} t={t} match={t.match} />
								))}
							</div>
						</div>
					)}
				</motion.div>
			</AnimatePresence>
		</Frame>
	)
}
