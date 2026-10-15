// PROTOTYPE - throwaway (#662). Variant "hero": the score sheet closes as today, and the title's own overview card
// gains a band under the ratings that stays: all the member's sides as one bar by share, the side this title joined
// lit, and that side's posters and Watch next. It reads as "where this title sits in your sides" for as long as the
// page is open (and could stay for rated titles, see #661). A score of 5 or less puts the #526 why row in the band.
import { useState } from "react"
import { SideMark, SideRef, WatchNextLink, WhyRow, pct, sideById, titlesOf } from "./bits"
import type { MomentView } from "./model"

export function HeroBand({ view, score, names }: { view: MomentView | null; score: number | null; names: boolean }) {
	const [dismissed, setDismissed] = useState(false)
	if (score === null || dismissed) return null
	if (score <= 5)
		return (
			<Band>
				<WhyRow score={score} onDone={() => setDismissed(true)} />
			</Band>
		)
	const o = view?.outcome
	if (!view || !o) return null
	const sides = view.after?.sides ?? []
	const lit = o.kind === "joins" || o.kind === "new" ? sideById(sides, o.side) : null
	if (!lit && o.kind !== "forming") return null
	const rest = Math.max(0, 1 - sides.reduce((s, x) => s + x.share, 0))
	return (
		<Band>
			<div className="flex items-center justify-between gap-3">
				<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">In your sides</p>
				<a href="/taste" className="text-xs font-semibold text-gray-400 hover:text-white">
					All sides →
				</a>
			</div>
			<div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Your sides by share of what you love">
				{sides.map((s) => (
					<span
						key={s.id}
						className="h-full transition-opacity duration-500"
						style={{ width: pct(s.share), background: s.hue, opacity: lit && s.id !== lit.id ? 0.28 : 1 }}
						title={names ? `${s.name}: ${pct(s.share)}` : pct(s.share)}
					/>
				))}
				<span
					className={`h-full ${o.kind === "forming" ? "border border-dashed border-white/70 bg-white/10" : "bg-white/10"}`}
					style={{ width: pct(rest) }}
					title="Loved titles that fit no side"
				/>
			</div>
			{lit && (
				<div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
					<SideMark view={view} side={lit} names={false} />
					<p className="min-w-0 flex-1 text-sm leading-snug text-gray-200">
						{o.kind === "new" ? "Starts " : "In "}
						<SideRef view={view} side={lit} names={names} />, {pct(lit.share)} of what you love
						{o.kind === "joins" && <span className="text-gray-400"> ({pct(o.shareBefore) === pct(o.shareAfter) ? `now ${o.countAfter} titles` : `was ${pct(o.shareBefore)}`})</span>}
					</p>
					<WatchNextLink side={lit} names={names} className="!px-3 !py-1.5 !text-xs" />
				</div>
			)}
			{o.kind === "forming" && (
				<p className="mt-2.5 text-sm leading-snug text-gray-200">
					Fits none of your sides yet. It goes with{" "}
					{titlesOf(view, o.with)
						.slice(0, 2)
						.map((t) => t.title)
						.join(" and ")}
					, which don't either: <span className="text-gray-400">the dashed part may become a side.</span>
				</p>
			)}
		</Band>
	)
}

function Band({ children }: { children: React.ReactNode }) {
	return <div className="mt-3.5 animate-[protoFade_.3s_ease-out] rounded-xl bg-black/50 p-3 ring-1 ring-white/10 md:max-w-xl">{children}<style>{"@keyframes protoFade{from{opacity:0}}"}</style></div>
}
