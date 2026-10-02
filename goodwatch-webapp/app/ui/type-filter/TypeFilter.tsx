// The type filter every page shares (see domain/title-type): the format and anime, two independent choices behind
// one button. The button says the choice ("All types", "Shows · no anime") and opens both as segmented controls, in a
// bottom sheet on phones and a popover otherwise. Every change applies at once and the choices stay open, so both can
// be set in one visit. Dark glass, so it sits on the Explorer's map and on the site's dark pages alike.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	ALL_TITLE_TYPES,
	ANIME_CHOICES,
	ANIME_SHORT_NAMES,
	TITLE_FORMATS,
	TITLE_FORMAT_NAMES,
	type TitleTypeFilter,
	isAllTitleTypes,
	titleTypeNoun,
	titleTypeSummary,
} from "~/domain/title-type"
import { SnapSheet } from "~/ui/filter-bar/SnapSheet"
import { radioKeys } from "~/ui/filter-bar/controls"
import { MENU } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"

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
const GLASS = "bg-[#0a0e1a]/60 ring-1 ring-inset ring-white/10 backdrop-blur-xl"
const LIT =
	"bg-linear-to-b from-amber-400/15 to-amber-400/5 text-white ring-1 ring-inset ring-amber-400/55 backdrop-blur-xl"
const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
const BUTTON = {
	md: "h-11 rounded-[13px] px-3.5 text-[15px]",
	sm: "h-9 rounded-xl px-3 text-xs",
}

/** A radio group as a full-width row of segments; arrow keys move and pick. */
function Segmented<K extends string>({
	label,
	options,
	names,
	value,
	onPick,
}: {
	label: string
	options: readonly K[]
	names: Record<K, string>
	value: K
	onPick: (key: K) => void
}) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			onKeyDown={(event) => radioKeys(event, (index) => onPick(options[index]))}
			className={`flex w-full gap-0.5 rounded-[14px] p-1 ${GLASS}`}
		>
			{options.map((key) => {
				const on = key === value
				return (
					<button
						key={key}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						onClick={() => onPick(key)}
						className={`h-9 flex-1 cursor-pointer rounded-[10px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors ${FOCUS} ${on ? "bg-[#f4f6ff] text-[#0b0f1c] shadow-[0_4px_18px_rgba(160,190,255,.3)]" : "text-indigo-100/60 hover:bg-white/[0.06] hover:text-white"}`}
					>
						{names[key]}
					</button>
				)
			})}
		</div>
	)
}

const ROW_LABEL = "text-xs font-semibold uppercase tracking-wide text-gray-400"

/** Both choices as labeled rows of segments, and Reset once one is made: the body of the sheet and of the popover. */
function Rows({
	value,
	onChange,
}: Pick<TypeFilterProps, "value" | "onChange">) {
	const root = useRef<HTMLDivElement>(null)
	return (
		<div ref={root} className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<div className="flex h-4 items-center justify-between">
					<span aria-hidden className={ROW_LABEL}>
						Type
					</span>
					{!isAllTitleTypes(value) && (
						<button
							type="button"
							onClick={() => {
								onChange(ALL_TITLE_TYPES)
								// Reset goes with the choice; the focus stays in the choices.
								requestAnimationFrame(() =>
									root.current
										?.querySelector<HTMLElement>('[aria-checked="true"]')
										?.focus(),
								)
							}}
							className={`-m-2 cursor-pointer rounded-lg p-2 text-sm font-semibold text-amber-300 hover:text-amber-200 ${FOCUS}`}
						>
							Reset
						</button>
					)}
				</div>
				<Segmented
					label="Type"
					options={TITLE_FORMATS}
					names={TITLE_FORMAT_NAMES}
					value={value.format}
					onPick={(format) => onChange({ ...value, format })}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<span aria-hidden className={ROW_LABEL}>
					Anime
				</span>
				<Segmented
					label="Anime"
					options={ANIME_CHOICES}
					names={ANIME_SHORT_NAMES}
					value={value.anime}
					onPick={(anime) => onChange({ ...value, anime })}
				/>
			</div>
		</div>
	)
}

// Room for the two rows; a shorter screen scrolls them.
const SHEET_SNAPS = [0.42]

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
	const popover = useRef<HTMLDivElement>(null)
	const close = () => setShown(null)
	useModalDialog({
		open: shown === "popover",
		onClose: close,
		container: popover,
	})
	useEffect(() => {
		if (shown !== "popover") return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setShown(null)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [shown])
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
			<AnimatePresence>
				{shown === "popover" && (
					<motion.div
						// biome-ignore lint/a11y/useSemanticElements: an animated popover with its own focus trap; <dialog> can't animate out
						ref={popover}
						role="dialog"
						aria-modal="true"
						aria-label="Type"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] p-4 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${MENU}`}
					>
						<Rows value={value} onChange={onChange} />
					</motion.div>
				)}
			</AnimatePresence>
			{sheet &&
				createPortal(
					<SnapSheet
						index={shown === "sheet" ? 0 : -1}
						onIndex={(index) => setShown(index < 0 ? null : "sheet")}
						label="Type"
						snaps={SHEET_SNAPS}
						header={
							<h2 className="px-4 pb-3 text-base font-bold text-white">
								Movies, shows, and anime
							</h2>
						}
					>
						<div className="px-4 pt-1 pb-6">
							<Rows value={value} onChange={onChange} />
						</div>
					</SnapSheet>,
					document.body,
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
