// PROTOTYPE - throwaway (#657). Variant "Map of you" (bolder): the tighter engine's sides drawn where they really lie.
// Every title you love is a dot on a map of your taste (its two main directions), each side is a colored region with
// its most typical posters, and each edge sits where its titles really fall, joined to its side by a dashed line. Pick
// a side to light it up and read it below. Posters, scores and cards are the site's own; only the map is new.
import { useState } from "react"
import { RatedPoster, posterUrl, titlesOf, useServicesFilter } from "~/ui/taste/tabs/parts"
import { AttributeChips, PosterRow, edgePicks } from "./bits"
import type { ProtoSide, ProtoView } from "./model"
import { MoreOfThis } from "./Tighter"

const COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#e879f9", "#fb7185", "#a3e635"]

export function MapOfYou({ view }: { view: ProtoView }) {
	const [focusId, setFocusId] = useState<string | null>(null)
	const services = useServicesFilter(view.hasServices)
	if (!view.sides.length) return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">Too few loved titles for sides.</p>
	const focus = view.sides.find((s) => s.id === focusId) ?? null
	const color = (side: ProtoSide) => COLORS[view.sides.indexOf(side) % COLORS.length]
	const dim = (side: ProtoSide) => (focus && focus !== side ? "opacity-20" : "opacity-100")
	const pct = (x: number | undefined) => `${((x ?? 0.5) * 100).toFixed(2)}%`
	return (
		<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
			<h1 className="max-w-4xl text-3xl font-bold leading-tight md:text-5xl">The map of what you love</h1>
			<p className="mt-3 max-w-2xl text-gray-400">
				Each dot is a title you love. Your sides are spread apart so each one has room; inside a side, close dots are alike. The dashed places at a side's rim are just past it, where you've barely been.
			</p>
			<div className="relative mt-8 aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-gray-800 bg-gray-950 sm:aspect-[16/10]">
				<div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
				<svg className="absolute inset-0 h-full w-full" aria-hidden>
					{view.sides.flatMap((side) =>
						side.edges.map((edge) => (
							<line
								key={edge.id}
								x1={pct(side.x)}
								y1={pct(side.y)}
								x2={pct(edge.x)}
								y2={pct(edge.y)}
								stroke={color(side)}
								strokeOpacity={focus && focus !== side ? 0.08 : 0.45}
								strokeDasharray="6 6"
								strokeWidth={2}
							/>
						)),
					)}
				</svg>
				{view.sides.map((side) => (
					<div key={side.id} className={`transition-opacity duration-300 ${dim(side)}`}>
						{(side.dots ?? []).map((d) => (
							<span key={d.key} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(d.x), top: pct(d.y), background: color(side), opacity: 0.55 }} />
						))}
						{titlesOf(view.titles, side.here.slice(0, 4)).map((t) => {
							const d = side.dots?.find((x) => x.key === t.key)
							if (!d) return null
							return (
								<img
									key={t.key}
									src={posterUrl(t, "w185")}
									alt={t.title}
									title={t.title}
									className="absolute w-8 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 shadow-lg md:w-12"
									style={{ left: pct(d.x), top: pct(d.y), borderColor: color(side) }}
								/>
							)
						})}
						{side.edges.map((edge) => (
							<button
								key={edge.id}
								type="button"
								onClick={() => setFocusId(side.id)}
								className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-1"
								style={{ left: pct(edge.x), top: pct(edge.y) }}
							>
								<span className="flex -space-x-3 rounded-full border-2 border-dashed p-1.5" style={{ borderColor: color(side) }}>
									{titlesOf(view.titles, edge.suggestions.slice(0, 2)).map((t) => (
										<img key={t.key} src={posterUrl(t, "w185")} alt="" className="w-6 rounded opacity-70 md:w-8" />
									))}
								</span>
								<span className="hidden whitespace-nowrap rounded-full bg-gray-950/85 px-2 py-0.5 text-[11px] font-semibold text-gray-200 sm:inline">{edge.chip}</span>
							</button>
						))}
						<button
							type="button"
							onClick={() => setFocusId(focus === side ? null : side.id)}
							aria-pressed={focus === side}
							className="absolute max-w-[40%] -translate-x-1/2 -translate-y-[170%] cursor-pointer truncate whitespace-nowrap rounded-full border-2 bg-gray-950/90 px-3 py-1 text-xs font-bold shadow-xl md:max-w-none md:text-sm"
							style={{ left: pct(side.x), top: pct(side.y), borderColor: color(side) }}
						>
							{side.name}
						</button>
					</div>
				))}
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{view.sides.map((side) => (
					<button
						key={side.id}
						type="button"
						onClick={() => setFocusId(focus === side ? null : side.id)}
						aria-pressed={focus === side}
						className={`inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${focus === side ? "bg-white/10" : "bg-transparent"}`}
						style={{ borderColor: color(side) }}
					>
						<span className="h-2.5 w-2.5 rounded-full" style={{ background: color(side) }} />
						{side.name}
						<span className="text-gray-400">{side.count}</span>
					</button>
				))}
			</div>

			{focus ? (
				<div className="mt-8 rounded-2xl border-2 p-4 md:p-6" style={{ borderColor: `${color(focus)}66` }}>
					<p className="text-sm font-semibold" style={{ color: color(focus) }}>
						You're here
					</p>
					<h2 className="text-3xl font-bold leading-tight md:text-4xl">{focus.name}</h2>
					<p className="mt-2 text-gray-300">
						{Math.round(focus.share * 100)}% of what you love ({focus.count} titles).
					</p>
					<AttributeChips side={focus} className="mt-3" />
					<PosterRow keys={focus.here} titles={view.titles} n={6} className="mt-5 grid-cols-3 sm:grid-cols-6" />
					<h3 className="mt-8 text-sm font-semibold text-sky-300">Just past it</h3>
					<div className="mt-3 grid gap-3 lg:grid-cols-3">
						{focus.edges.map((edge) => (
							<div key={edge.id} className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: `${color(focus)}66` }}>
								<h4 className="font-bold leading-tight">{edge.line}</h4>
								<p className="mt-1 text-sm text-gray-300">{edge.evidence}</p>
								<div className="mt-3 grid grid-cols-4 gap-2">
									{edgePicks(view.titles, edge, services, 4).map((t) => (
										<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
									))}
								</div>
							</div>
						))}
						{!focus.edges.length && <p className="text-sm text-gray-400">Nothing you've barely tried sits right next to this side yet.</p>}
					</div>
					<MoreOfThis side={focus} view={view} services={services} />
				</div>
			) : (
				<p className="mt-8 text-gray-400">Pick a side on the map to see it up close.</p>
			)}
		</section>
	)
}
