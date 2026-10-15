// PROTOTYPE - throwaway (#659). Variant "marked": the legend between the hero and the steps, so the colors under the
// posters can be read. Each side shows its loved posters, its share of what you love, how many of its titles fit
// tonight, and a shortcut to its moods.
import { MoodButton, SideFaces, pct } from "./bits"
import type { SwnView } from "./model"

export function Legend({ view }: { view: SwnView }) {
	if (!view.sides.length) return null
	return (
		<section aria-label="Your sides" className="mb-10 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
			<p className="mb-2 text-sm font-semibold text-gray-300 md:mb-0 md:pt-2 md:text-right">Your sides</p>
			<ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
				{view.sides.map((side, i) => (
					<li key={side.id} className="flex w-60 shrink-0 flex-col gap-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10" style={{ boxShadow: `inset 3px 0 0 ${side.color}` }}>
						<div className="flex items-center gap-3">
							<SideFaces side={side} view={view} size="sm" />
							<div className="min-w-0">
								<p className="truncate text-sm font-bold text-white">{view.names ? side.name : `Side ${i + 1}`}</p>
								<p className="text-xs text-gray-400">
									{pct(side.share)} of what you love · {side.fitting} fit tonight
								</p>
							</div>
						</div>
						<MoodButton side={side} className="self-start" />
					</li>
				))}
			</ul>
		</section>
	)
}
