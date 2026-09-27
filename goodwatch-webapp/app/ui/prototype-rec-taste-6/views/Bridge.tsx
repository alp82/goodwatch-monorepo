// PROTOTYPE - throwaway. You're here, just past it (bolder): one side at a time as two big pictures side by
// side. Left, where you are: the side's backdrop with the posters you rated highest. Right, just past it: the
// edge's backdrop with unseen titles from there. The contradiction is the page's first line; the sides are
// picked from poster chips. More of this on your services closes the side.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"
import type { Title } from "~/ui/prototype-rec-taste-2/model"
import type { Edge, SideView } from "../model"
import { pct } from "../model"
import {
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

export default function Bridge({ data }: VariantProps) {
	const { model, side, select, services } = useSides(data)
	if (!side) return <Empty />
	const c = model.contradiction

	return (
		<div className="pb-32 text-white">
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
				{c && (
					<h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
						You love <span className="text-amber-300">{c.a.name.toLowerCase()}</span>,
						and just as much{" "}
						<span className="text-sky-300">{c.b.name.toLowerCase()}</span>.
					</h1>
				)}
				<p className="mt-3 max-w-2xl text-gray-400">
					{model.sides.length} sides of what you rate highly, and for each one, the place
					just past it you've barely tried but rate above your usual {model.usual}.
				</p>
				<div className="t6-noscroll -mx-4 mt-8 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist">
					{model.sides.map((s) => {
						const on = s.id === side.id
						const p = s.loved[0]
						return (
							<button
								key={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => select(s.id)}
								className={`flex w-60 shrink-0 cursor-pointer items-center gap-3 rounded-xl border-2 p-2 pr-4 text-left transition md:w-auto md:flex-1 ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-900/40 hover:border-gray-500 hover:bg-gray-900"}`}
							>
								{p && (
									<img
										src={p.poster.replace("/w342/", "/w185/")}
										alt=""
										className="w-10 shrink-0 rounded-md"
									/>
								)}
								<span className="min-w-0">
									<span className="block font-bold leading-tight">{s.name}</span>
									<span className="mt-0.5 block text-sm text-gray-400">
										{pct(s.share)} of what you love
									</span>
								</span>
							</button>
						)
					})}
				</div>
			</section>

			<AnimatePresence mode="wait">
				<motion.section
					key={side.id}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.25 }}
					className="mx-auto mt-8 max-w-7xl px-4 md:px-8"
				>
					<div className="grid items-stretch gap-3 lg:grid-cols-[1fr_2.5rem_1fr]">
						<Here side={side} />
						<div className="flex items-center justify-center text-3xl text-gray-500" aria-hidden>
							<span className="rotate-90 lg:rotate-0">→</span>
						</div>
						{side.edges[0] ? (
							<Past edges={side.edges} services={services} usual={model.usual} data={data} />
						) : (
							<div className="flex items-center rounded-2xl border border-dashed border-gray-700 p-8 text-gray-400">
								Nothing you've barely tried sits close to this side yet.
							</div>
						)}
					</div>
					<SideChips data={data} side={side} className="mt-6" />
					<Picks
						data={data}
						services={services}
						refs={side.picks}
						title="More of this"
						className="mt-10"
					/>
				</motion.section>
			</AnimatePresence>
		</div>
	)
}

function Panel({
	image,
	children,
	tone,
}: {
	image: Title | null
	children: ReactNode
	tone: "amber" | "sky"
}) {
	return (
		<div
			className={`relative isolate flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-2xl border-2 p-5 md:min-h-[30rem] md:p-7 ${tone === "amber" ? "border-amber-500/40" : "border-sky-400/40"}`}
		>
			{image && (
				<img src={bd(image)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-b from-gray-950/90 via-gray-950/40 to-gray-950/95" />
			{children}
		</div>
	)
}

function Here({ side }: { side: SideView }) {
	return (
		<Panel image={side.image} tone="amber">
			<div>
				<p className="text-sm font-semibold text-amber-300">You're here</p>
				<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{side.name}</h2>
				<p className="mt-2 text-gray-200">
					{pct(side.share)} of what you love, rated {side.avg} on average.
				</p>
			</div>
			<div className="mt-6 grid grid-cols-4 gap-2">
				{side.loved.slice(0, 4).map((t) => (
					<RatedPoster key={t.key} t={t} size="w185" />
				))}
			</div>
		</Panel>
	)
}

function Past({
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
	const picks = edgePicks(services, e.picks, 4)
		.map((r) => data.items[r.key])
		.filter((t): t is Title => !!t)
		.slice(0, 4)
	return (
		<Panel image={e.image} tone="sky">
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm font-semibold text-sky-300">Just past it</p>
					{edges.length > 1 &&
						edges.map((x) => (
							<button
								key={x.id}
								type="button"
								onClick={() => setId(x.id)}
								aria-pressed={x.id === e.id}
								className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${x.id === e.id ? "border-sky-400 bg-sky-900/50 text-sky-100" : "border-white/20 bg-black/30 text-gray-300 hover:border-sky-400/70"}`}
							>
								{x.name}
							</button>
						))}
				</div>
				<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{edgeSentence(e)}</h2>
				<p className="mt-2 text-gray-200">{edgeRating(e, usual)}</p>
			</div>
			{picks.length ? (
				<div className="mt-6 grid grid-cols-4 gap-2">
					{picks.map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
					))}
				</div>
			) : (
				<p className="mt-6 text-sm text-gray-300">
					Nothing from here on your services yet. Switch to Everywhere below.
				</p>
			)}
		</Panel>
	)
}
