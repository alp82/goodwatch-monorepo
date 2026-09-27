// PROTOTYPE - throwaway. Backdrop rail (existing): round 2's hero on top, then round 5's picker-and-detail
// layout, but the picker is a column of backdrop tiles instead of a text list. The open side shows its edges
// as smaller tiles tucked under it; picking one turns the stage to that edge. The stage leads with a wide
// backdrop, then your titles and more of this on your services. Phones: the tiles scroll sideways.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"
import type { Edge, SideView } from "../model"
import { pct } from "../model"
import {
	Contradiction,
	Empty,
	Picks,
	SideChips,
	type VariantProps,
	bd,
	edgeRating,
	edgeSentence,
	useSides,
} from "../parts"

export default function Rail({ data }: VariantProps) {
	const { model, side, select, services } = useSides(data)
	const [edgeId, setEdgeId] = useState<string | null>(null)
	if (!side) return <Empty />
	const edge = side.edges.find((e) => e.id === edgeId) ?? null
	const pickSide = (id: string) => {
		select(id)
		setEdgeId(null)
	}

	return (
		<div className="pb-32 text-white">
			<Contradiction model={model} onPick={pickSide} compact />

			<section className="mx-auto mt-10 grid max-w-7xl gap-6 px-4 md:px-8 lg:grid-cols-[19rem_1fr] lg:gap-10">
				<div
					className="t6-noscroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
					role="tablist"
					aria-label="Sides of you"
				>
					{model.sides.map((s) => {
						const on = s.id === side.id
						return (
							<div key={s.id} className="flex shrink-0 gap-3 lg:flex-col lg:gap-2">
								<SideTile side={s} on={on && !edge} open={on} onClick={() => pickSide(s.id)} />
								{on &&
									s.edges.map((e) => (
										<EdgeTile
											key={e.id}
											edge={e}
											on={e.id === edge?.id}
											onClick={() => setEdgeId(e.id)}
										/>
									))}
							</div>
						)
					})}
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={edge?.id ?? side.id}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="min-w-0"
					>
						{edge ? (
							<>
								<Stage
									image={edge.image}
									tone="sky"
									kicker={`Just past ${side.name.toLowerCase()}`}
									title={edgeSentence(edge)}
									sub={edgeRating(edge, model.usual)}
								/>
								{edge.rated.length > 0 && (
									<>
										<h3 className="mb-3 mt-8 text-xl font-bold">What you've rated here</h3>
										<div className="grid grid-cols-4 gap-2 md:grid-cols-8">
											{edge.rated.slice(0, 8).map((t) => (
												<RatedPoster key={t.key} t={t} size="w185" />
											))}
										</div>
									</>
								)}
								<Picks
									data={data}
									services={services}
									refs={edge.picks}
									title="Go a step further"
									n={5}
									cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
									className="mt-10"
								/>
							</>
						) : (
							<>
								<Stage
									image={side.image}
									tone="amber"
									kicker={`${pct(side.share)} of what you love`}
									title={`You love ${side.name.toLowerCase()}`}
								/>
								<SideChips data={data} side={side} className="mt-5" />
								<div className="mt-5 grid grid-cols-4 gap-2 md:grid-cols-8">
									{side.loved.slice(0, 8).map((t) => (
										<RatedPoster key={t.key} t={t} size="w185" />
									))}
								</div>
								<Picks
									data={data}
									services={services}
									refs={side.picks}
									title="More of this"
									n={5}
									cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
									className="mt-10"
								/>
								{side.edges[0] && (
									<button
										type="button"
										onClick={() => setEdgeId(side.edges[0].id)}
										className="group relative isolate mt-10 flex min-h-28 w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border-2 border-sky-400/30 p-5 text-left transition hover:border-sky-400"
									>
										{side.edges[0].image && (
											<img
												src={bd(side.edges[0].image, "w780")}
												alt=""
												className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30 transition group-hover:opacity-45"
											/>
										)}
										<span className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-semibold text-sky-300">Just past this side</span>
											<span className="mt-1 block text-2xl font-bold leading-tight">
												{edgeSentence(side.edges[0])}
											</span>
										</span>
										<span className="text-2xl text-sky-300 transition group-hover:translate-x-1" aria-hidden>
											›
										</span>
									</button>
								)}
							</>
						)}
					</motion.div>
				</AnimatePresence>
			</section>
		</div>
	)
}

function SideTile({
	side,
	on,
	open,
	onClick,
}: { side: SideView; on: boolean; open: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={open}
			onClick={onClick}
			className={`group relative isolate flex h-28 w-64 cursor-pointer flex-col justify-end overflow-hidden rounded-xl border-2 p-4 text-left transition lg:w-full ${on ? "border-amber-500" : open ? "border-amber-500/50" : "border-gray-800 hover:border-gray-500"}`}
		>
			{side.image && (
				<img
					src={bd(side.image, "w780")}
					alt=""
					className={`absolute inset-0 -z-10 h-full w-full object-cover transition ${open ? "opacity-60" : "opacity-35 group-hover:opacity-50"}`}
				/>
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/60 to-transparent" />
			<span className="block text-lg font-bold leading-tight">{side.name}</span>
			<span className="mt-1 block text-sm text-gray-300">{pct(side.share)} of what you love</span>
		</button>
	)
}

function EdgeTile({ edge, on, onClick }: { edge: Edge; on: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			className={`group relative isolate flex h-28 w-48 cursor-pointer flex-col justify-end overflow-hidden rounded-xl border-2 p-3 text-left transition lg:ml-6 lg:h-16 lg:w-auto lg:justify-center ${on ? "border-sky-400" : "border-gray-800 hover:border-sky-400/60"}`}
		>
			{edge.image && (
				<img
					src={bd(edge.image, "w780")}
					alt=""
					className={`absolute inset-0 -z-10 h-full w-full object-cover transition ${on ? "opacity-50" : "opacity-25 group-hover:opacity-40"}`}
				/>
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950/90 to-gray-950/30 lg:bg-linear-to-r" />
			<span className="block text-xs font-semibold text-sky-300">Just past it</span>
			<span className="block truncate font-bold">{edge.name}</span>
		</button>
	)
}

function Stage({
	image,
	tone,
	kicker,
	title,
	sub,
}: {
	image: SideView["image"]
	tone: "amber" | "sky"
	kicker: string
	title: string
	sub?: string
}) {
	return (
		<div className="relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 p-5 md:min-h-72 md:p-8">
			{image && (
				<img src={bd(image)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-gray-950/10" />
			<p className={`text-sm font-semibold ${tone === "amber" ? "text-amber-300" : "text-sky-300"}`}>{kicker}</p>
			<h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{title}</h2>
			{sub && <p className="mt-2 text-gray-200">{sub}</p>}
		</div>
	)
}
