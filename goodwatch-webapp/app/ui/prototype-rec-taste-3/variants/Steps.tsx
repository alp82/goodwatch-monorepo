// PROTOTYPE - throwaway. Sides: how far to go (existing). Pick a side, then step out from its center: your
// favorites, more like them, just past it, and further out (a country, language or decade near this side).
// One row of posters answers each step.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	Frame,
	Head,
	Pick,
	RatedPoster,
	type View3Props,
	mineFirst,
	sideViews,
} from "../kit3"
import type { Ref, Title } from "../model"

type Step = {
	id: string
	label: string
	name: string
	line: string
	rated?: Title[]
	picks?: Ref[]
}

export default function Steps({ data }: View3Props) {
	const views = sideViews(data)
	const [id, setId] = useState(views[0]?.side.id)
	const [at, setAt] = useState(0)
	const v = views.find((x) => x.side.id === id) ?? views[0]
	if (!v)
		return (
			<Frame>
				<Head title="How far do you want to go?" sub="Rate a few more titles you love to find your sides." />
			</Frame>
		)

	const steps: Step[] = [
		{
			id: "home",
			label: "Your favorites",
			name: v.side.name,
			line: `The heart of this side. You rate these ${v.side.avg} on average.`,
			rated: v.loved,
		},
		{
			id: "close",
			label: "More like them",
			name: `More ${v.side.name.toLowerCase()}`,
			line: "Titles you haven't seen that sit right in the middle of this side.",
			picks: v.side.picks,
		},
		...(v.edge
			? [
					{
						id: "edge",
						label: "Just past it",
						name: v.edge.name,
						line: v.edge.line,
						picks: v.edge.picks,
					},
				]
			: []),
		...v.further.slice(0, 1).map((f) => ({
			id: f.id,
			label: "Further out",
			name: f.name,
			line: f.line,
			picks: f.picks,
		})),
	]
	const step = steps[Math.min(at, steps.length - 1)]
	const fill = steps.length > 1 ? (Math.min(at, steps.length - 1) / (steps.length - 1)) * 100 : 0

	return (
		<Frame>
			<Head
				title="How far do you want to go?"
				sub="Pick a side of your taste, then step out from its center."
			/>
			<div className="mt-8 flex flex-wrap gap-2">
				{views.map((x) => {
					const on = x.side.id === v.side.id
					return (
						<button
							key={x.side.id}
							type="button"
							onClick={() => {
								setId(x.side.id)
								setAt(0)
							}}
							aria-pressed={on}
							className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${on ? "border-amber-500 bg-amber-900/30 text-amber-50" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
						>
							{x.side.name}
						</button>
					)
				})}
			</div>

			{/* The stepper: stops along a line that fills from amber (home) to sky (the edge). */}
			<div className="relative mt-12">
				<div className="absolute left-0 right-0 top-[0.6rem] h-1 rounded-full bg-gray-800" />
				<div
					className="absolute left-0 top-[0.6rem] h-1 rounded-full bg-linear-to-r from-amber-400 to-sky-400 transition-all duration-300"
					style={{ width: `${fill}%` }}
				/>
				<ol
					className="relative grid"
					style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
				>
					{steps.map((s, i) => {
						const on = i === at
						const passed = i <= at
						return (
							<li
								key={s.id}
								className={i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center"}
							>
								<button
									type="button"
									onClick={() => setAt(i)}
									aria-pressed={on}
									className={`inline-flex flex-col gap-2 ${i === 0 ? "items-start" : i === steps.length - 1 ? "items-end" : "items-center"}`}
								>
									<span
										className={`h-6 w-6 rounded-full border-4 transition ${on ? "scale-125 border-white bg-sky-400" : passed ? "border-gray-950 bg-amber-300" : "border-gray-950 bg-gray-600"}`}
									/>
									<span
										className={`text-xs font-semibold sm:text-sm ${on ? "text-white" : "text-gray-400"}`}
									>
										{s.label}
									</span>
								</button>
							</li>
						)
					})}
				</ol>
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					key={`${v.side.id}-${step.id}`}
					initial={{ opacity: 0, x: 12 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -12 }}
					transition={{ duration: 0.2 }}
					className="mt-12"
				>
					<h3 className="text-3xl font-bold md:text-4xl">{step.name}</h3>
					<p className="mt-2 max-w-2xl text-gray-400">{step.line}</p>
					<div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
						{step.rated
							? step.rated
									.slice(0, 6)
									.map((t) => <RatedPoster key={t.key} t={t} />)
							: mineFirst(data, step.picks ?? [])
									.slice(0, 6)
									.map((p) => {
										const t = data.items[p.key]
										return t ? (
											<Pick key={p.key} data={data} t={t} match={p.match} />
										) : null
									})}
					</div>
				</motion.div>
			</AnimatePresence>
		</Frame>
	)
}
