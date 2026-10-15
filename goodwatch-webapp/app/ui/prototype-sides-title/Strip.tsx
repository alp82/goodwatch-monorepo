// PROTOTYPE - throwaway (#661). Variant "All your sides, this title placed" (existing): after the fingerprint (what
// the title is), a row of all the member's sides as the Taste page's side picker draws them, with this title marked on
// its side, just past it (dashed), or between two (both dashed). Picking another side shows its titles, so the member
// sees where this title sits among everything they love.
import { useState } from "react"
import { titlesOf } from "~/ui/taste/tabs/parts"
import type { SidesTitleView } from "./model"
import { ProtoPoster, WatchNextLink, headline, sideOf } from "./SidesProto"

export function StripVariant({ view, names }: { view: SidesTitleView; names: boolean }) {
	const p = view.placement
	const [pickedId, setPickedId] = useState(p.side)
	const home = sideOf(view, p.side)
	const picked = sideOf(view, pickedId) ?? home
	if (!home || !picked) return null
	const { title, detail } = headline(view, names)
	const self = view.titles[view.title]
	const marks = new Map<string, "on" | "past">()
	marks.set(home.id, p.kind === "on" ? "on" : "past")
	if (p.edge?.kind === "bridge" && p.edge.toward) marks.set(p.edge.toward, "past")
	const shown = picked === home ? titlesOf(view.titles, p.near) : titlesOf(view.titles, picked.here)
	return (
		<div className="relative isolate flex flex-col items-center">
			<section className="mb-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
				<h2 className="text-lg font-semibold text-gray-300">Where it sits among your sides</h2>
				<p className="mt-1 text-2xl font-semibold tracking-tight text-amber-200">{title}.</p>
				<p className="mt-1 text-gray-400">{detail}</p>
				<div role="tablist" className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
					{view.sides.map((s) => {
						const mark = marks.get(s.id)
						const cover = titlesOf(view.titles, s.here)[0]
						const on = s.id === picked.id
						return (
							<button
								key={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setPickedId(s.id)}
								className={`relative flex w-60 shrink-0 cursor-pointer items-center gap-3 rounded-xl border-2 p-2 pr-4 text-left transition md:w-auto md:flex-1 ${
									mark === "on" ? "border-amber-500 bg-amber-950/40" : mark === "past" ? "border-dashed border-sky-400 bg-sky-950/30" : "border-gray-800 bg-gray-900/40 hover:border-gray-500"
								} ${on && !mark ? "border-gray-400" : ""}`}
							>
								{cover?.poster && <img src={`https://image.tmdb.org/t/p/w185${cover.poster}`} alt="" className="w-10 shrink-0 rounded-md" />}
								<span className="min-w-0">
									<span className="block font-bold leading-tight">{names ? s.name : `${s.count} titles you love`}</span>
									<span className="mt-0.5 block text-sm text-gray-400">{Math.round(s.share * 100)}% of what you love</span>
								</span>
								{mark && self?.poster && (
									<span className={`absolute -right-1 -top-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black ${mark === "on" ? "bg-amber-400" : "bg-sky-300"}`}>
										<img src={`https://image.tmdb.org/t/p/w92${self.poster}`} alt="" className="h-4 w-auto rounded-sm" />
										{mark === "on" ? "Here" : p.edge?.kind === "bridge" ? "Between" : "Just past"}
									</span>
								)}
							</button>
						)
					})}
				</div>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<div className="flex gap-2">
						{shown.slice(0, 6).map((t) => (
							<ProtoPoster key={t.key} t={t} className="w-14 md:w-16" />
						))}
					</div>
					<div className="ml-auto">
						<WatchNextLink side={picked} names={names} />
					</div>
				</div>
				<p className="mt-2 text-xs text-gray-500">{picked === home ? "The titles you love that are closest to this one." : "The titles that most make this side."}</p>
			</section>
		</div>
	)
}
