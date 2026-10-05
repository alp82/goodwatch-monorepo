// PROTOTYPE - throwaway. Third-view candidate "Your edges" (existing components): round 2's Frontiers cut
// down to Sides' structure. The places and kinds of story you've barely tried but rate high. The hero
// pairs where you've been (left fan) with what's just past it (right fan); below, one edge at a time.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	itemsOf,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Frontier } from "~/ui/prototype-rec-taste-2/model"
import type { Payload4 } from "../model"
import { BackdropTab, Fan } from "../parts"

const avgIn = (f: Frontier) =>
	/(\d+(?:\.\d+)?) on average/.exec(f.line)?.[1] ?? null

const lead = (f: Frontier) =>
	f.kind === "country"
		? { pre: "You've barely been to", name: f.name }
		: f.kind === "language"
			? { pre: "You rarely watch in", name: f.name }
			: f.kind === "decade"
				? { pre: "You rarely go back to", name: f.name.replace(/^The/, "the") }
				: { pre: "You rarely pick", name: f.name.toLowerCase() }

export default function Edges({ data }: { data: Payload4 }) {
	const r = data.report
	const [id, setId] = useState(r.frontiers[0]?.id)
	const services = useOnMine(data)
	const hero = r.frontiers[0]
	const edge = r.frontiers.find((f) => f.id === id) ?? hero
	if (!hero)
		return (
			<p className="mx-auto max-w-7xl px-4 py-16 text-lg text-gray-300 md:px-8">
				Rate a few more titles from outside your usual places to see your edges.
			</p>
		)
	const l = lead(hero)
	const avg = avgIn(hero)

	return (
		<div className="pb-32 text-white">
			<section className="relative overflow-hidden border-b border-gray-800 bg-gray-950">
				<div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 md:grid-cols-[1fr_1.3fr_1fr] md:gap-8 md:px-8 md:py-16">
					<Fan
						items={itemsOf(data, hero.evidence)}
						dir={-1}
						label={`What you rated: ${hero.name}`}
						onPick={() => setId(hero.id)}
					/>
					<div className="text-center">
						<p className="text-sm text-gray-400">The edge of your taste</p>
						<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
							{l.pre} <span className="text-amber-300">{l.name}</span>
						</h1>
						<p className="my-3 text-xl text-gray-400 md:text-2xl">
							but when you go
						</p>
						<p className="text-3xl font-bold leading-tight md:text-5xl">
							you rate it{" "}
							<span className="text-sky-300">{avg ?? "higher"}</span>
						</p>
						<p className="mx-auto mt-5 max-w-md text-gray-400">
							Against your usual {r.who.avg}. On the right, what's just past it.
						</p>
					</div>
					<Fan
						items={itemsOf(
							data,
							hero.picks.map((p) => p.key),
						)}
						dir={1}
						label={`Go further: ${hero.name}`}
						onPick={() => setId(hero.id)}
					/>
				</div>
			</section>

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-2xl font-bold md:text-3xl">Your edges</h2>
				<p className="mt-1 text-gray-400">
					Places, eras and kinds of story you've barely tried, where your
					ratings run above your average.
				</p>
				<div
					className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
					role="tablist"
				>
					{r.frontiers.map((f) => (
						<BackdropTab
							key={f.id}
							on={f.id === edge.id}
							onClick={() => setId(f.id)}
							backdrop={data.items[f.picks[0]?.key]?.backdrop}
							title={f.name}
							sub={
								avgIn(f)
									? `You rate it ${avgIn(f)}`
									: `${f.evidence.length} rated`
							}
						/>
					))}
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={edge.id}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25 }}
						className="mt-8 grid gap-8 md:grid-cols-[1fr_2fr]"
					>
						<div>
							<p className="text-3xl font-bold">{edge.headline}</p>
							<p className="mt-2 text-lg text-gray-200">{edge.line}</p>
							{edge.evidence.length > 0 && (
								<>
									<h3 className="mb-3 mt-5 text-sm text-gray-400">
										What you've rated here
									</h3>
									<div className="grid grid-cols-4 gap-2">
										{itemsOf(data, edge.evidence).map((t) => (
											<RatedPoster key={t.key} t={t} size="w185" />
										))}
									</div>
								</>
							)}
						</div>
						<div>
							<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
								<h3 className="text-xl font-bold">Go further</h3>
								<ServicesSwitch state={services} />
							</div>
							<PickRow
								data={data}
								refs={services.filter(edge.picks)}
								n={4}
								cols="grid-cols-2 md:grid-cols-4"
							/>
						</div>
					</motion.div>
				</AnimatePresence>
			</section>
		</div>
	)
}
