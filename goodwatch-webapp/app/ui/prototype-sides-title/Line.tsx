// PROTOTYPE - throwaway (#661). Variant "One line in the overview" (existing): one row inside the title's overview
// card, between the banner and the actions. A small stack of the side's closest loved titles, one sentence for where
// the title sits, and Watch next with the side's moods. The quietest answer: nothing else on the page changes.
import { titlesOf } from "~/ui/taste/tabs/parts"
import type { SidesTitleView } from "./model"
import { ProtoPoster, WatchNextLink, headline, sideOf } from "./SidesProto"

export function LineVariant({ view, names }: { view: SidesTitleView; names: boolean }) {
	const p = view.placement
	const side = sideOf(view, p.side)
	if (!side) return null
	const { title, detail } = headline(view, names)
	const edge = p.kind === "edge"
	const stack = [...titlesOf(view.titles, p.near).slice(0, edge && p.nearOther.length ? 2 : 3), ...titlesOf(view.titles, p.nearOther).slice(0, edge ? 2 : 0)]
	return (
		<div className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.05] p-3 ring-1 ring-white/10 md:mx-5 md:mt-4">
			<div className={`flex shrink-0 -space-x-4 rounded-lg p-1 ${edge ? "border-2 border-dashed border-sky-400/60" : "border-2 border-amber-500/60"}`}>
				{stack.map((t) => (
					<ProtoPoster key={t.key} t={t} className="w-9 ring-2 ring-stone-950 md:w-10" />
				))}
			</div>
			<div className="min-w-0 flex-1">
				<p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${edge ? "text-sky-300" : "text-amber-300"}`}>In your Taste</p>
				<p className="font-bold leading-snug text-white">{title}</p>
				<p className="mt-0.5 text-sm leading-snug text-gray-400">{detail}</p>
			</div>
			<WatchNextLink side={side} names={names} className="max-sm:w-full max-sm:justify-center" />
		</div>
	)
}
