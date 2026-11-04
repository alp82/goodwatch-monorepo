// PROTOTYPE - throwaway (discover search preferences, see README.md). The pieces every read-line variant shares:
// - QualityMark: one fingerprint quality. Favored: a colored dot. Ranked lower: a minus mark and a colored
//   strikethrough, no visible "Not" (the meaning is in the label for screen readers and the tooltip). Everything sits
//   on one centered line, so marks and words align.
// - ReadToggle: one thing the search read from the words, switched with a press. Off is gray, dimmed and struck through
//   in gray, never colored, so it can't be mistaken for a quality the ranking holds against titles.
// - MatchesRead: the Matches popout's list of every read part, each with the same switch as the line, then the
//   fingerprint qualities as an explanation of what the switched-on words read as.
import { CalendarDaysIcon, ChatBubbleBottomCenterTextIcon, MinusIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, useState } from "react"
import { MOODS } from "~/domain/moods"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { Knob } from "~/ui/filter-bar/motion"
import type { Item } from "./interpretation"

export const switchable = (items: readonly Item[]) => items.filter((item) => !item.aside)

export function qualitiesOf(reading: readonly ReadingChip[]) {
	return reading.filter((chip) => (chip.kind === "want" || chip.kind === "avoid") && chip.key)
}

export function QualityMark({ chip, size = "md" }: { chip: ReadingChip; size?: "sm" | "md" }) {
	const meta = getFingerprintMeta(chip.key as string)
	const avoid = chip.kind === "avoid"
	const text = size === "sm" ? "text-[12px]" : "text-[13px]"
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-1.5 leading-none ${text}`}
			style={{ "--quality": meta.color } as CSSProperties}
			title={`${avoid ? "Ranked lower" : "Ranked higher"}: ${chip.description ?? meta.label}`}
		>
			{avoid ? (
				<span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--quality)_38%,transparent)] text-[color-mix(in_oklab,var(--quality)_55%,#ffffff)]">
					<MinusIcon className="h-3 w-3" aria-hidden />
				</span>
			) : (
				<span className="h-2 w-2 shrink-0 rounded-full bg-[color-mix(in_oklab,var(--quality)_85%,#ffffff)]" aria-hidden />
			)}
			<span className="sr-only">{avoid ? "Ranked lower:" : "Ranked higher:"}</span>
			<span
				className={
					avoid
						? "font-[650] text-[color-mix(in_oklab,var(--quality)_40%,#dbe3ee)] line-through decoration-[color-mix(in_oklab,var(--quality)_70%,#ffffff)] decoration-[2.5px]"
						: "font-[650] text-[color-mix(in_oklab,var(--quality)_55%,#ffffff)]"
				}
			>
				{meta.label}
			</span>
		</span>
	)
}

/** A mood's own color, a calendar for years, a speech mark for plain words; else a small neutral dot. */
export function ItemMarker({ item }: { item: Item }) {
	if (item.words) return <ChatBubbleBottomCenterTextIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
	if (item.params.some(([key]) => key === "minYear" || key === "maxYear"))
		return <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0 text-amber-300/80" aria-hidden />
	const mood = item.params.find(([key]) => key === "moods")
	const hue = mood ? MOODS.find((m) => m.key === mood[1])?.hue : undefined
	return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue ?? "#94a3b8" }} aria-hidden />
}

export function itemTitle(item: Item) {
	if (item.aside) return `Set aside: your ${item.aside} choice takes over, so these words aren't read. Remove that choice to read them again.`
	if (!item.on) return "Switched off: the search doesn't read these words. Press to switch on."
	if (item.words) return "Read as words: they shape the text and fingerprint ranking. Press to switch off."
	if (item.soft) return "Read from your search. Titles that fit rank higher; others still show. Press to switch off."
	return "Read from your search. Only matching titles show. Press to switch off."
}

/** The Matches note: a hard filter's real hide count, one short word for everything that only ranks. */
export function itemNote(item: Item, hides?: number) {
	if (item.aside) return `set aside by your ${item.aside}`
	if (!item.on) return "off"
	if (item.soft || item.words) return "Preferred"
	if (hides === undefined) return "…"
	return hides === 0 ? "hides none" : `hides ${hides.toLocaleString("en")}`
}

export const PREFERRED_TITLE = "Preferred: titles that fit rank higher; none are hidden."
export const HIDES_TITLE =
	"Titles this filter keeps out: the same words searched without it, counted with every other filter."

/** Filters first, then what only ranks (read preferences, then the words), then words your own choice set aside. */
export function matchesOrder(items: readonly Item[]) {
	const rank = (item: Item) => (item.aside ? 3 : item.words ? 2 : item.soft ? 1 : 0)
	return [...items].sort((a, b) => rank(a) - rank(b))
}

export function ReadToggle({
	item,
	onToggle,
	showField = true,
	marker = false,
	className = "",
}: {
	item: Item
	onToggle: () => void
	showField?: boolean
	marker?: boolean
	className?: string
}) {
	const live = item.on && !item.aside
	const body = (
		<>
			{marker && <ItemMarker item={item} />}
			{item.field && showField && (
				<span className={live ? "text-[#92a5bf]" : "text-gray-600"}>{item.field}</span>
			)}
			<span
				className={
					live
						? `font-[650] text-white ${item.soft && !item.words ? "underline decoration-white/35 decoration-dotted underline-offset-[4px]" : ""}`
						: "font-[650] text-gray-400 line-through decoration-gray-300 decoration-2"
				}
			>
				{item.label}
			</span>
			<span className="sr-only">, {itemNote(item)}</span>
		</>
	)
	const base = `inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 leading-none ${live ? "" : "opacity-80"} ${className}`
	if (item.aside)
		return (
			<span className={`${base} cursor-default`} title={itemTitle(item)}>
				{body}
			</span>
		)
	return (
		<button
			type="button"
			role="switch"
			aria-checked={item.on}
			onClick={onToggle}
			title={itemTitle(item)}
			className={`${base} cursor-pointer hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400 outline-none`}
		>
			{body}
		</button>
	)
}

export function ClearRead({ items, onAll, className = "" }: { items: readonly Item[]; onAll: (off: boolean) => void; className?: string }) {
	const usable = switchable(items)
	if (!usable.length) return null
	const anyOn = usable.some((item) => item.on)
	return (
		<button
			type="button"
			onClick={() => onAll(anyOn)}
			title={anyOn ? "Switch off everything read from your search" : "Switch everything read from your search back on"}
			className={`shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-gray-400 hover:bg-white/[0.06] hover:text-white ${className}`}
		>
			{anyOn ? "Clear" : "Restore"}
		</button>
	)
}

const SHOW_FIRST = 6

/** In the Matches popout: every read part, each with its switch, then what the switched-on words read as. */
export function MatchesRead({
	items,
	reading,
	onToggle,
	onAll,
	hides,
}: {
	items: readonly Item[]
	reading: readonly ReadingChip[]
	onToggle: (item: Item) => void
	onAll: (off: boolean) => void
	/** Hard filters' hide counts by phrase (lowercase), from the answer that is on screen. */
	hides: ReadonlyMap<string, number>
}) {
	const [all, setAll] = useState(false)
	if (!items.length) return null
	const ordered = matchesOrder(items)
	const shown = all ? ordered : ordered.slice(0, SHOW_FIRST)
	const noteOf = (item: Item) => itemNote(item, hides.get(item.phrase.toLowerCase()))
	const titleOf = (item: Item) =>
		item.on && !item.aside ? (item.soft || item.words ? PREFERRED_TITLE : HIDES_TITLE) : itemTitle(item)
	const qualities = qualitiesOf(reading)
	return (
		<li className="mt-1">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase">Filters</span>
				<ClearRead items={items} onAll={onAll} className="-mr-2" />
			</div>
			<ul className="mt-1 flex flex-col">
				{shown.map((item) => (
					<li key={item.phrase} className="flex h-9 items-center">
						{item.aside ? (
							<span className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-0 text-left" title={itemTitle(item)}>
								<span className="grid w-2.5 shrink-0 place-items-center opacity-40"><ItemMarker item={item} /></span>
								<span className="min-w-0 flex-1 truncate text-gray-400 line-through decoration-gray-300 decoration-2">
									{item.field ? `${item.field} ` : ""}
									{item.label}
								</span>
								<span className="shrink-0 text-xs text-gray-500">{noteOf(item)}</span>
								<span className="w-[42px]" aria-hidden />
							</span>
						) : (
							<button
								type="button"
								role="switch"
								aria-checked={item.on}
								aria-label={`${item.field ? `${item.field} ` : ""}${item.label}`}
								title={titleOf(item)}
								onClick={() => onToggle(item)}
								className="-ml-2 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg pr-1 pl-2 text-left outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className={`grid w-2.5 shrink-0 place-items-center ${item.on ? "" : "opacity-40"}`}><ItemMarker item={item} /></span>
								<span className={`min-w-0 flex-1 truncate ${item.on ? "text-gray-200" : "text-gray-400 line-through decoration-gray-300 decoration-2"}`}>
									{item.field && <span className="text-gray-500">{item.field} </span>}
									{item.label}
								</span>
								<span className="shrink-0 text-xs tabular-nums text-gray-400">{noteOf(item)}</span>
								<span className="shrink-0 origin-center scale-75" aria-hidden>
									<Knob on={item.on} />
								</span>
							</button>
						)}
					</li>
				))}
			</ul>
			{items.length > SHOW_FIRST && (
				<button type="button" onClick={() => setAll(!all)} className="mt-0.5 cursor-pointer text-xs font-semibold text-amber-400 hover:text-amber-300">
					{all ? "Show fewer" : `Show all ${items.length}`}
				</button>
			)}
			{qualities.length > 0 && (
				<div className="mt-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
					<p className="text-[11px] text-gray-500">Search based on</p>
					<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
						{qualities.map((chip, i) => (
							<QualityMark key={`${chip.key}:${i}`} chip={chip} size="sm" />
						))}
					</div>
				</div>
			)}
		</li>
	)
}
