// The pieces the read strip and the Matches popout share while searching (docs/implementation/search-preferences.md):
// - QualityMark: one fingerprint quality. Favored: a colored dot. Ranked lower: a minus mark and a colored
//   strikethrough, no visible "Not" (the meaning is in the label for screen readers and the tooltip). Everything sits
//   on one centered line, so marks and words align.
// - ReadToggle: one thing the search read from the words, switched with a press. Off is gray, dimmed and struck through
//   in gray, never colored, so it can't be mistaken for a quality the ranking holds against titles.
// - ClearRead: switches everything read off, or back on.
// The Matches popout's list of read parts is MatchesRead.tsx, loaded on first use.
import { CalendarDaysIcon, ChatBubbleBottomCenterTextIcon, MinusIcon } from "@heroicons/react/20/solid"
import type { CSSProperties, ReactNode } from "react"
import { MOODS } from "~/domain/moods"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { SCOPE_COLOR, readColor } from "./read-colors"
import { HideNumber } from "~/ui/discover-bar/HideNumber"
import type { ReadItem as Item } from "./read-items"

export { SCOPE_COLOR, readColor }


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
	if (item.words) return "Searched: these words choose which titles the search finds and how they rank. Press to switch off."
	if (item.soft) return "Read from your search. Within the search, titles that fit rank higher; none are hidden by it. Press to switch off."
	return "Read from your search. Only matching titles show. Press to switch off."
}

/** A hide count and whether it's an estimate (a search-pool count: switching the filter changes what is found). */
export interface HideCount {
	n: number
	approx: boolean
}

export function itemNote(item: Item, count?: HideCount): ReactNode {
	const hides = count?.n
	if (item.aside) return `set aside by your ${item.aside}`
	if (!item.on) return "off"
	if (item.words) return ""
	if (item.soft) return "Preferred"
	if (hides === undefined) return "…"
	// An exact zero hides none; an estimated zero is still only about zero.
	if (hides === 0 && !count?.approx) return "hides none"
	return (
		<>
			hides <HideNumber n={hides} approx={count?.approx} />
		</>
	)
}

export const PREFERRED_TITLE = "Preferred: within your search, titles that fit rank higher; this hides none of them."
export const SCOPE_TITLE =
	"Titles your current search doesn't bring in: they pass every filter here but aren't in the results. One count for the whole search, on the whole catalog; it doesn't mean each title fails to match."
export const sharedTitle = (owner: string) =>
	`Part of your search. What the whole search leaves out is counted once, on ${owner}.`

export const ESTIMATE_TITLE =
	"About this many: titles this filter alone keeps out of what your words find without it. Switching it also changes what the search finds, so the list can change by a different number."
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
			<span className="sr-only">, {item.words && item.on && !item.aside ? "searched" : itemNote(item)}</span>
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
