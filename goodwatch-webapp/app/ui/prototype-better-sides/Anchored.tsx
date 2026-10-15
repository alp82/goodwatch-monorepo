// PROTOTYPE - throwaway (#657). Variant "Named by a title" (existing components, new arrangement): every side on one
// scroll as a band, no picker. Sides grow around anchor titles and carry the anchor's name ("Your Breaking Bad side");
// a title close to two anchors counts for both. Just past a side: a step (this side, but darkly funny) or the way
// toward the nearest other side.
import { useState } from "react"
import { RatedPoster, SuggestionCard, ServicesSwitch, posterUrl, titleHref, titlesOf, useServicesFilter } from "~/ui/taste/tabs/parts"
import { Link } from "@remix-run/react"
import { EdgeChips, PosterRow, edgePicks } from "./bits"
import type { ProtoEdge, ProtoSide, ProtoView } from "./model"

export function Anchored({ view }: { view: ProtoView }) {
	const services = useServicesFilter(view.hasServices)
	if (!view.sides.length) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">Too few loved titles for sides.</p>
	const anchorName = (side: ProtoSide | undefined) => (side ? (view.titles[side.anchor ?? -1]?.title ?? "this") : "")
	const names = view.sides.map((s) => anchorName(s))
	return (
		<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
			<h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
				Your taste has {view.sides.length} sides:{" "}
				{names.map((n, i) => (
					<span key={n}>
						{i > 0 && (i === names.length - 1 ? " and " : ", ")}
						<span className="text-amber-300">{n}</span>
					</span>
				))}
				.
			</h1>
			<p className="mt-3 max-w-2xl text-gray-400">
				Each side grows around a title you love. Titles close to two of them count for both. Next to each: where it goes when you take one step out.
			</p>
			<div className="mt-4 flex justify-end">
				<ServicesSwitch filter={services} services={view.services} />
			</div>
			<div className="mt-6 flex flex-col gap-6">
				{view.sides.map((side) => (
					<Band key={side.id} side={side} view={view} services={services} anchorName={anchorName} />
				))}
			</div>
		</section>
	)
}

function Band({ side, view, services, anchorName }: { side: ProtoSide; view: ProtoView; services: ReturnType<typeof useServicesFilter>; anchorName: (s: ProtoSide | undefined) => string }) {
	const [edgeId, setEdgeId] = useState(side.edges[0]?.id ?? "")
	const [more, setMore] = useState(false)
	const edge = side.edges.find((e) => e.id === edgeId) ?? side.edges[0]
	const anchor = view.titles[side.anchor ?? -1]
	const name = anchorName(side)
	const other = (e: ProtoEdge) => view.sides.find((s) => s.id === e.toward)
	const chip = (e: ProtoEdge) => (e.kind === "bridge" ? `Toward ${anchorName(other(e))}` : e.chip)
	const headline = (e: ProtoEdge) =>
		e.kind === "bridge" ? (
			<>
				Between {name} and <span className="text-sky-200">{anchorName(other(e))}</span>
			</>
		) : (
			<>
				{name}, <span className="text-sky-200">{e.line}</span>
			</>
		)
	const moreTitles = titlesOf(view.titles, side.moreOfThis).filter(services.keep).slice(0, 6)
	return (
		<article className="rounded-2xl border-2 border-gray-800 bg-gray-900/40 p-4 md:p-6">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
				<div className="flex gap-4 md:gap-6">
					{anchor && (
						<Link to={titleHref(anchor)} className="relative w-28 shrink-0 md:w-40" title={anchor.title}>
							<img src={posterUrl(anchor, "w342")} alt={`Poster for ${anchor.title}`} className="aspect-[2/3] w-full rounded-lg border-2 border-amber-500/60 object-cover" />
						</Link>
					)}
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold text-amber-300">Your</p>
						<h2 className="text-2xl font-bold leading-tight md:text-4xl">{name} side</h2>
						<p className="mt-1 text-sm text-gray-300">{side.line}</p>
						<p className="mt-2 text-sm text-gray-400">
							{Math.round(side.share * 100)}% of what you love ({side.count} titles)
							{side.shared > 0 && ` · ${side.shared} shared with another side`}
						</p>
						<PosterRow keys={side.here.filter((k) => k !== side.anchor)} titles={view.titles} n={5} className="mt-4 grid-cols-5" />
					</div>
				</div>
				<div className="rounded-xl border-2 border-sky-400/30 bg-gray-950/60 p-4">
					{edge ? (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-sm font-semibold text-sky-300">Just past it</p>
								<EdgeChips edges={side.edges} current={edge.id} onPick={setEdgeId} label={chip} />
							</div>
							<h3 className="mt-1 text-xl font-bold leading-tight md:text-2xl">{headline(edge)}</h3>
							<p className="mt-1 text-sm text-gray-300">{edge.evidence}</p>
							<div className="mt-3 grid grid-cols-4 gap-2">
								{edgePicks(view.titles, edge, services, 4).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
								))}
							</div>
						</>
					) : (
						<p className="text-sm text-gray-400">Nothing just past this side yet.</p>
					)}
				</div>
			</div>
			<button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="mt-4 cursor-pointer text-sm font-semibold text-amber-300 hover:text-amber-200">
				{more ? "Hide" : "Show"} more like your {name} side
			</button>
			{more && (
				<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
					{moreTitles.map((t) => (
						<SuggestionCard key={t.key} t={t} />
					))}
				</div>
			)}
		</article>
	)
}
