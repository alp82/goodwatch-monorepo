// PROTOTYPE - throwaway (#658). Pieces the sides-on-Discover variants share. A side is shown without words by default:
// its number, the loved titles that stand for it, and its share of what the member loves. Its name, attribute line and
// edges show only with the names toggle on (the words gate, #656).
import type { TitleCard } from "~/server/title-cards.server"
import { posterUrl } from "~/ui/taste/tabs/parts"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { gridPosterPriority } from "~/utils/tmdb-image"
import { HUES, type SDSide, type SDView } from "./model"

export const pct = (share: number) => `${Math.round(share * 100)}%`
export const hue = (side: SDSide | number) => HUES[(typeof side === "number" ? side : side.index) % HUES.length]

/** Small overlapping posters of the loved titles that stand for a side. */
export function LovedStack({ side, view, n = 3, size = "h-9" }: { side: SDSide; view: SDView; n?: number; size?: string }) {
	const list = side.here.slice(0, n).flatMap((k) => (view.posters[k] ? [view.posters[k]] : []))
	return (
		<span className="flex shrink-0 -space-x-3">
			{list.map((t, i) => (
				<img
					key={t.key}
					src={posterUrl(t, "w185")}
					alt=""
					title={t.title}
					className={`${size} aspect-[2/3] rounded-sm object-cover ring-2 ring-gray-950`}
					style={{ zIndex: n - i }}
					draggable={false}
				/>
			))}
		</span>
	)
}

/** "Side 2", or its name with the names toggle on. */
export function sideLabel(side: SDSide, names: boolean) {
	return names ? side.name : `Side ${side.index + 1}`
}

/** A side's header for a row or a lane: loved posters, the label, its share, and with names its line and edges. */
export function SideHeader({ side, view, names, inList, compact = false }: { side: SDSide; view: SDView; names: boolean; inList: number; compact?: boolean }) {
	return (
		<div className="flex items-center gap-3">
			<LovedStack side={side} view={view} n={compact ? 3 : 4} size={compact ? "h-10" : "h-14"} />
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hue(side) }} aria-hidden />
					<h2 className={`${compact ? "text-base" : "text-lg md:text-xl"} truncate font-bold text-white`}>{sideLabel(side, names)}</h2>
				</div>
				<p className="text-sm text-gray-400">
					{pct(side.share)} of what you love · {inList} here
				</p>
				{names && !compact && <p className="text-xs text-gray-500">{side.line}</p>}
			</div>
		</div>
	)
}

/** Discover's card. `place` is the title's place in the whole list, shown with the places toggle. */
export function Card({ card, index, place }: { card: TitleCard; index: number; place?: number | null }) {
	const priority = gridPosterPriority(index)
	return (
		<div className="relative">
			<TitlePosterCard card={card} posterPriority={priority} skipOffscreen={priority === "lazy"} />
			{place != null && (
				<span className="pointer-events-none absolute top-1 right-1 z-20 rounded bg-fuchsia-600/90 px-1.5 text-[11px] font-bold tabular-nums text-white">#{place + 1}</span>
			)}
		</div>
	)
}

/** The loaded titles of one side (null: fits no side), in the list's order, with their place in the whole list. */
export function titlesOf(view: SDView, side: number | null) {
	return view.cards.flatMap((card) => ((view.sideOf[card.key] ?? null) === side ? [{ card, place: view.place[card.key] }] : []))
}

/** The list's first titles, as Discover shows them before any side grouping. */
export function topOf(view: SDView) {
	return view.cards.flatMap((card) => (view.place[card.key] < view.list ? [{ card, place: view.place[card.key] }] : []))
}

/** Sides in the order their first title comes in the list: personal order decides which side leads. */
export function sidesInListOrder(view: SDView) {
	const first = (i: number) => titlesOf(view, i)[0]?.place ?? Number.POSITIVE_INFINITY
	return [...view.sides].sort((a, b) => first(a.index) - first(b.index))
}

export const count = (n: number) => n.toLocaleString("en-US")
