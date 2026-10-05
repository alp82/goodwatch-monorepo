// The type filter every page shares (see domain/title-type): the format and anime, two independent choices behind
// one button. The button says the choice ("All types", "Shows · no anime") and opens both as segmented controls, in a
// bottom sheet on phones and a popover otherwise. Every change applies at once and the choices stay open, so both can
// be set in one visit. Dark glass, so it sits on the Explorer's map and on the site's dark pages alike.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Suspense, lazy, useCallback, useRef, useState } from "react"
import {
	ALL_TITLE_TYPES,
	type TitleTypeFilter,
	isAllTitleTypes,
	titleTypeNoun,
	titleTypeSummary,
} from "~/domain/title-type"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// The choices open from the button. Their code brings the animation library (35 KB compressed), so it loads when a
// visitor reaches for the button (pointer, touch or focus), or at the latest when the choices open.
const loadPanel = () => import("./TypeFilterPanel")
const TypeFilterPanel = lazy(reloadOnStaleChunk(loadPanel))
const preloadPanel = () => {
	void loadPanel().catch(() => {})
}

export interface TypeFilterProps {
	value: TitleTypeFilter
	onChange: (next: TitleTypeFilter) => void
	/** "md" is 44px high (a touch target); "sm" is 36px, for dense filter rows. */
	size?: "md" | "sm"
	/** Which edge of the button the popover lines up with. */
	align?: "left" | "right"
	className?: string
}

const PHONE = "(max-width: 767px)"
export const GLASS =
	"bg-[#0a0e1a]/60 ring-1 ring-inset ring-white/10 backdrop-blur-xl"
const LIT =
	"bg-linear-to-b from-amber-400/15 to-amber-400/5 text-white ring-1 ring-inset ring-amber-400/55 backdrop-blur-xl"
export const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
const BUTTON = {
	md: "h-11 rounded-[13px] px-3.5 text-[15px]",
	sm: "h-9 rounded-xl px-3 text-xs",
}

/** The type filter: the format and anime. Controlled; the page keeps the value (in its URL). */
export function TypeFilter({
	value,
	onChange,
	size = "md",
	align = "left",
	className = "",
}: TypeFilterProps) {
	const [shown, setShown] = useState<"sheet" | "popover" | null>(null)
	// The sheet mounts with its first opening, in the body: clear of the page's stacking and clipping.
	const [sheet, setSheet] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const close = () => setShown(null)
	const opened = useOpenedOnce(shown !== null)
	const onShown = useCallback(
		(next: "sheet" | "popover" | null) => setShown(next),
		[],
	)
	const summary = titleTypeSummary(value)
	return (
		<div ref={root} className={`relative min-w-0 ${className}`}>
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={shown !== null}
				aria-label={`Type: ${summary}`}
				// What it says in full, where the label is cut short.
				title={summary}
				onPointerEnter={preloadPanel}
				onTouchStart={preloadPanel}
				onFocus={preloadPanel}
				onClick={() => {
					if (shown) return close()
					const phone = window.matchMedia(PHONE).matches
					if (phone) setSheet(true)
					setShown(phone ? "sheet" : "popover")
				}}
				className={`flex max-w-full cursor-pointer items-center gap-1.5 font-semibold whitespace-nowrap transition-colors ${BUTTON[size]} ${FOCUS} ${isAllTitleTypes(value) ? `${GLASS} text-indigo-100/60 hover:text-white` : LIT}`}
			>
				<span className="truncate">{summary}</span>
				<ChevronDownIcon
					aria-hidden
					className={`-mr-1 h-4 w-4 shrink-0 transition-transform ${shown ? "rotate-180" : ""}`}
				/>
			</button>
			{opened && (
				<Suspense fallback={null}>
					<TypeFilterPanel
						value={value}
						onChange={onChange}
						align={align}
						shown={shown}
						onShown={onShown}
						sheet={sheet}
						root={root}
					/>
				</Suspense>
			)}
		</div>
	)
}

/** What an empty page says when the type filter is on, with the way out: "No anime movies here. Show all types". */
export function NoTitlesOfType({
	value,
	onReset,
	where = "here",
	className = "",
}: {
	value: TitleTypeFilter
	/** Called with every type; the page writes it to its URL. */
	onReset: (all: TitleTypeFilter) => void
	/** Where there are none: "here" by default, or "with these filters". */
	where?: string
	className?: string
}) {
	return (
		<span className={className}>
			No {titleTypeNoun(value)} {where}.{" "}
			<button
				type="button"
				onClick={() => onReset(ALL_TITLE_TYPES)}
				className={`pointer-events-auto cursor-pointer font-semibold text-white underline underline-offset-4 ${FOCUS}`}
			>
				Show all types
			</button>
		</span>
	)
}
