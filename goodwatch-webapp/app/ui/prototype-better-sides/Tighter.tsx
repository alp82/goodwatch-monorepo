// PROTOTYPE - throwaway (#657). Variant "Tighter sides" (existing layout): today's Taste page layout, unchanged in
// shape, fed by the tighter engine. As many sides as hold together (2 to 5), names contrasted against the other
// sides, and each side's own places just past it, with the side's name in the headline.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useState } from "react"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import { RatedPoster, ServicesSwitch, SuggestionCard, backdropUrl, posterUrl, titlesOf, useServicesFilter } from "~/ui/taste/tabs/parts"
import { AttributeChips, EdgeChips, PosterRow, edgePicks } from "./bits"
import type { ProtoEdge, ProtoSide, ProtoView } from "./model"

export function Tighter({ view }: { view: ProtoView }) {
	const [openId, setOpenId] = useState(view.sides[0]?.id ?? "")
	const side = view.sides.find((s) => s.id === openId) ?? view.sides[0]
	const services = useServicesFilter(view.hasServices)
	const reduceMotion = useReducedMotion()
	if (!side) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">Too few loved titles for sides.</p>
	return (
		<>
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
				{view.headline && <h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">{view.headline}</h1>}
				<p className="mt-3 max-w-2xl text-gray-400">
					{view.sides.length} sides of what you rate highly, each holding together on its own, and for each one the places right next to it you've barely tried.
				</p>
				<div role="tablist" className="-mx-4 mt-8 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
					{view.sides.map((s) => {
						const on = s.id === side.id
						const cover = titlesOf(view.titles, s.here)[0]
						return (
							<button
								key={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setOpenId(s.id)}
								className={`flex w-60 shrink-0 cursor-pointer items-center gap-3 rounded-xl border-2 p-2 pr-4 text-left transition md:w-auto md:flex-1 ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-900/40 hover:border-gray-500 hover:bg-gray-900"}`}
							>
								{cover?.poster && <img src={posterUrl(cover, "w185")} alt="" className="w-10 shrink-0 rounded-md" />}
								<span className="min-w-0">
									<span className="block font-bold leading-tight">{s.name}</span>
									<span className="mt-0.5 block text-sm text-gray-400">{s.count} titles you love</span>
								</span>
							</button>
						)
					})}
				</div>
			</section>
			<AnimatePresence mode="wait" initial={false}>
				<motion.section
					key={side.id}
					initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
					className="mx-auto mt-8 max-w-7xl px-4 md:px-8"
				>
					<div className="grid items-stretch gap-3 lg:grid-cols-[1fr_2.5rem_1fr]">
						<Panel image={titlesOf(view.titles, [side.image])[0]} tone="amber">
							<div>
								<p className="text-sm font-semibold text-amber-300">You're here</p>
								<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{side.name}</h2>
								<p className="mt-2 text-gray-200">
									{Math.round(side.share * 100)}% of what you love: {side.count} titles.
								</p>
							</div>
							<PosterRow keys={side.here} titles={view.titles} n={4} className="mt-6 grid-cols-4" />
						</Panel>
						<div className="flex items-center justify-center text-3xl text-gray-500" aria-hidden>
							<span className="rotate-90 lg:rotate-0">→</span>
						</div>
						{side.edges.length ? (
							<JustPastIt side={side} edges={side.edges} view={view} services={services} />
						) : (
							<div className="flex items-center rounded-2xl border border-dashed border-gray-700 p-8 text-gray-400">
								Nothing you've barely tried sits right next to this side yet.
							</div>
						)}
					</div>
					<AttributeChips side={side} className="mt-6" />
					<MoreOfThis side={side} view={view} services={services} />
				</motion.section>
			</AnimatePresence>
		</>
	)
}

export function Panel({ image, tone, children }: { image: PortraitTitle | undefined; tone: "amber" | "sky"; children: ReactNode }) {
	return (
		<div className={`relative isolate flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-2xl border-2 p-5 md:min-h-[30rem] md:p-7 ${tone === "amber" ? "border-amber-500/40" : "border-sky-400/40"}`}>
			{image?.backdrop && <img src={backdropUrl(image)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />}
			<span className="absolute inset-0 -z-10 bg-linear-to-b from-gray-950/90 via-gray-950/40 to-gray-950/95" />
			{children}
		</div>
	)
}

function JustPastIt({ side, edges, view, services }: { side: ProtoSide; edges: ProtoEdge[]; view: ProtoView; services: ReturnType<typeof useServicesFilter> }) {
	const [id, setId] = useState(edges[0].id)
	const edge = edges.find((e) => e.id === id) ?? edges[0]
	const picks = edgePicks(view.titles, edge, services, 4)
	return (
		<Panel image={titlesOf(view.titles, [edge.image])[0]} tone="sky">
			<div>
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm font-semibold text-sky-300">Just past it</p>
					<EdgeChips edges={edges} current={edge.id} onPick={setId} label={(e) => e.chip} />
				</div>
				<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">
					{side.name}, <span className="text-sky-200">{edge.line.slice(side.name.length + 2)}</span>
				</h2>
				<p className="mt-2 text-gray-200">{edge.evidence}</p>
			</div>
			<div className="mt-6 grid grid-cols-4 gap-2">
				{picks.map((t) => (
					<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
				))}
			</div>
		</Panel>
	)
}

export function MoreOfThis({ side, view, services, n = 6, title = "More of this" }: { side: ProtoSide; view: ProtoView; services: ReturnType<typeof useServicesFilter>; n?: number; title?: string }) {
	const shown = titlesOf(view.titles, side.moreOfThis).filter(services.keep).slice(0, n)
	return (
		<div className="mt-10">
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<h3 className="text-xl font-bold">{title}</h3>
				<ServicesSwitch filter={services} services={view.services} />
			</div>
			{shown.length ? (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
					{shown.map((t) => (
						<SuggestionCard key={t.key} t={t} />
					))}
				</div>
			) : (
				<p className="py-6 text-sm text-gray-400">
					{services.onlyMine ? "Nothing on your services here yet. Switch to Everywhere." : "Nothing more to suggest here yet."}
				</p>
			)}
		</div>
	)
}
