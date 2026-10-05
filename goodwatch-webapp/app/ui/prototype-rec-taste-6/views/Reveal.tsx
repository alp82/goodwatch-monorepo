// PROTOTYPE - throwaway. Round 2's Sides, edge inside (existing): round 2's page as the owner loved it, the
// contradiction hero, backdrop tabs for the sides, the side's own titles and more of this on your services.
// New: each side ends in a band for the edge just past it, with its backdrop, what you rated there and
// where to go next. The mood section stays as round 2 had it.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { PickRow, RatedPoster, itemsOf } from "~/ui/prototype-rec-taste-2/kit"
import type { Edge } from "../model"
import { pct } from "../model"
import {
	Contradiction,
	Empty,
	Picks,
	type Services,
	SideChips,
	type VariantProps,
	bd,
	edgePicks,
	edgeRating,
	edgeSentence,
	useSides,
} from "../parts"

export default function Reveal({ data }: VariantProps) {
	const { model, side, select, services } = useSides(data)
	const r = data.report
	const [moodId, setMoodId] = useState(r.moods[0]?.id)
	const mood = r.moods.find((m) => m.id === moodId) ?? r.moods[0]
	if (!side) return <Empty />

	return (
		<div className="pb-32 text-white">
			<Contradiction model={model} onPick={select} />

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-2xl font-bold md:text-3xl">The sides of your taste</h2>
				<p className="mt-1 text-gray-400">
					Everything you rated highly, grouped by what the title analysis says the
					titles have in common.
				</p>
				<div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" role="tablist">
					{model.sides.map((s) => {
						const on = s.id === side.id
						return (
							<button
								key={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => select(s.id)}
								className={`relative isolate cursor-pointer overflow-hidden rounded-xl border-2 p-4 text-left transition ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-500"}`}
							>
								{s.image && (
									<img
										src={bd(s.image, "w780")}
										alt=""
										className={`absolute inset-0 -z-10 h-full w-full object-cover transition ${on ? "opacity-30" : "opacity-20"}`}
									/>
								)}
								<span className="block text-lg font-bold leading-tight">{s.name}</span>
								<span className="mt-2 block text-sm text-gray-300">
									{pct(s.share)} of what you love
								</span>
							</button>
						)
					})}
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={side.id}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="mt-8"
					>
						<SideChips data={data} side={side} />
						<div className="mt-5 grid grid-cols-5 gap-2 md:grid-cols-10">
							{side.loved.slice(0, 10).map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
						</div>
						<Picks
							data={data}
							services={services}
							refs={side.picks}
							title="More for this side of you"
							className="mt-10"
						/>
						{side.edges[0] && (
							<JustPast
								data={data}
								edges={side.edges}
								services={services}
								usual={model.usual}
							/>
						)}
					</motion.div>
				</AnimatePresence>
			</section>

			{mood && (
				<section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
					<h2 className="text-2xl font-bold md:text-3xl">Your taste by mood</h2>
					<p className="mt-1 text-gray-400">
						How you rate titles made for each kind of evening, against your usual{" "}
						{r.who.avg}.
					</p>
					<div className="mt-6 flex flex-wrap gap-2">
						{r.moods.map((m) => (
							<button
								key={m.id}
								type="button"
								onClick={() => setMoodId(m.id)}
								aria-pressed={m.id === mood.id}
								className={`cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${m.id === mood.id ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
							>
								{m.name}
								<span
									className={`ml-2 tabular-nums ${m.delta >= 0.2 ? "text-emerald-400" : m.delta <= -0.2 ? "text-rose-400" : "text-gray-400"}`}
								>
									{m.delta > 0 ? "+" : ""}
									{m.delta.toFixed(1)}
								</span>
							</button>
						))}
					</div>
					<div className="mt-6 grid gap-8 md:grid-cols-[1fr_2fr]">
						<div>
							<p className="text-3xl font-bold">{mood.name}</p>
							<p className="mt-1 text-gray-400">{mood.line}.</p>
							<p className="mt-4 text-lg text-gray-200">
								{mood.delta >= 0.2
									? `You rate these ${mood.delta.toFixed(1)} above your average. This is where your taste is happiest.`
									: mood.delta <= -0.2
										? `You rate these ${Math.abs(mood.delta).toFixed(1)} below your average. You watch them, but they rarely stick.`
										: "You rate these about as you rate everything else."}
							</p>
							<div className="mt-5 grid grid-cols-3 gap-2">
								{itemsOf(data, mood.top.slice(0, 3)).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
						<div>
							<h3 className="mb-4 text-lg font-bold">
								For your next {mood.name.toLowerCase()} evening
							</h3>
							<PickRow
								data={data}
								refs={services.filter(mood.picks)}
								n={4}
								cols="grid-cols-2 md:grid-cols-4"
							/>
						</div>
					</div>
				</section>
			)}
		</div>
	)
}

/** The edge that sits just past a side, as a band with its own backdrop. More than one: small tabs. */
function JustPast({
	data,
	edges,
	services,
	usual,
}: {
	data: VariantProps["data"]
	edges: Edge[]
	services: Services
	usual: number
}) {
	const [id, setId] = useState(edges[0].id)
	const e = edges.find((x) => x.id === id) ?? edges[0]
	return (
		<div className="relative isolate mt-10 overflow-hidden rounded-2xl border border-sky-400/25 bg-gray-950">
			{e.image && (
				<img
					src={bd(e.image)}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/85 to-gray-950/40" />
			<div className="grid gap-6 p-5 md:grid-cols-[1fr_1.6fr] md:gap-10 md:p-8">
				<div>
					<p className="text-sm font-semibold text-sky-300">Just past this side</p>
					<p className="mt-2 text-2xl font-bold leading-tight md:text-3xl">
						{edgeSentence(e)}
					</p>
					<p className="mt-2 text-gray-300">{edgeRating(e, usual)}</p>
					{edges.length > 1 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{edges.map((x) => (
								<button
									key={x.id}
									type="button"
									onClick={() => setId(x.id)}
									aria-pressed={x.id === e.id}
									className={`cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${x.id === e.id ? "border-sky-400 bg-sky-900/40 text-sky-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
								>
									{x.name}
								</button>
							))}
						</div>
					)}
					{e.rated.length > 0 && (
						<div className="mt-5 grid max-w-xs grid-cols-4 gap-2">
							{e.rated.slice(0, 4).map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
						</div>
					)}
				</div>
				<div>
					<h3 className="mb-4 text-xl font-bold">Go a step further</h3>
					<PickRow
						data={data}
						refs={edgePicks(services, e.picks, 4)}
						n={4}
						cols="grid-cols-2 md:grid-cols-4"
					/>
				</div>
			</div>
		</div>
	)
}
