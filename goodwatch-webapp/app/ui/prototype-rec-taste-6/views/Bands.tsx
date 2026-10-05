// PROTOTYPE - throwaway. One band per side (bolder): no picker at all. Round 2's hero, then every side as a
// full-width band on its own backdrop, top to bottom: the side, the titles you rated highest there, more of
// this on your services, and at the band's end the edge just past it with where to go next. Scroll to read
// your whole taste; one services switch serves every band.
import { PickRow, RatedPoster } from "~/ui/prototype-rec-taste-2/kit"
import type { Title } from "~/ui/prototype-rec-taste-2/model"
import type { Edge, SideView } from "../model"
import { pct } from "../model"
import {
	Contradiction,
	Empty,
	type Services,
	SideChips,
	type VariantProps,
	bd,
	edgePicks,
	edgeRating,
	edgeSentence,
	useSides,
} from "../parts"
import { ServicesSwitch } from "~/ui/prototype-rec-taste-2/kit"

export default function Bands({ data }: VariantProps) {
	const { model, services, select } = useSides(data)
	if (!model.sides.length) return <Empty />
	const jump = (id: string) => {
		select(id)
		document.getElementById(`band-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
	}

	return (
		<div className="pb-32 text-white">
			<Contradiction model={model} onPick={jump} />
			<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 md:px-8">
				<p className="text-gray-400">
					{model.sides.length} sides of what you rate highly, each with the place just past it.
				</p>
				<ServicesSwitch state={services} />
			</div>
			{model.sides.map((s) => (
				<Band key={s.id} data={data} side={s} services={services} usual={model.usual} />
			))}
		</div>
	)
}

function Band({
	data,
	side,
	services,
	usual,
}: {
	data: VariantProps["data"]
	side: SideView
	services: Services
	usual: number
}) {
	const edge = side.edges[0]
	return (
		<section id={`band-${side.id}`} className="relative isolate scroll-mt-4 overflow-hidden border-t border-gray-800">
			{side.image && (
				<img
					src={bd(side.image)}
					alt=""
					className="absolute inset-x-0 top-0 -z-10 h-[32rem] w-full object-cover opacity-45"
					loading="lazy"
				/>
			)}
			<span className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-linear-to-b from-gray-950/30 via-gray-950/80 to-gray-950" />
			<div className="mx-auto max-w-7xl px-4 pb-14 pt-16 md:px-8 md:pt-24">
				<p className="text-sm font-semibold text-amber-300">{pct(side.share)} of what you love</p>
				<h2 className="mt-1 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">{side.name}</h2>
				<SideChips data={data} side={side} className="mt-5" />
				<div className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-8">
					{side.loved.slice(0, 8).map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" />
					))}
				</div>
				<div className="mt-10 grid gap-8 lg:grid-cols-[3fr_2fr] lg:gap-10">
					<div>
						<h3 className="mb-4 text-xl font-bold">More of this</h3>
						<PickRow
							data={data}
							refs={services.filter(side.picks)}
							n={4}
							cols="grid-cols-2 md:grid-cols-4"
						/>
					</div>
					{edge && <EdgeCard data={data} edge={edge} services={services} usual={usual} />}
				</div>
			</div>
		</section>
	)
}

function EdgeCard({
	data,
	edge,
	services,
	usual,
}: {
	data: VariantProps["data"]
	edge: Edge
	services: Services
	usual: number
}) {
	const picks = edgePicks(services, edge.picks, 3)
		.map((r) => data.items[r.key])
		.filter((t): t is Title => !!t)
		.slice(0, 3)
	return (
		<div className="relative isolate overflow-hidden rounded-2xl border-2 border-sky-400/40 p-5">
			{edge.image && (
				<img src={bd(edge.image, "w780")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" loading="lazy" />
			)}
			<span className="absolute inset-0 -z-10 bg-linear-to-b from-gray-950/70 to-gray-950/95" />
			<p className="text-sm font-semibold text-sky-300">Just past it</p>
			<p className="mt-1 text-2xl font-bold leading-tight">{edgeSentence(edge)}</p>
			<p className="mt-2 text-sm text-gray-300">{edgeRating(edge, usual)}</p>
			{picks.length ? (
				<div className="mt-5 grid grid-cols-3 gap-2">
					{picks.map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
					))}
				</div>
			) : (
				<p className="mt-5 text-sm text-gray-400">Nothing from here on your services yet.</p>
			)}
		</div>
	)
}
