// The type filter every page shares (see domain/title-type): the format and anime, two independent choices. Wide, a
// segmented control (All, Movies, Shows) and an Anime chip with a menu of three; narrow, one button that says the
// choice and opens both as segmented controls, in a bottom sheet on phones and a popover otherwise. Every change
// applies at once. Dark glass, so it sits on the Explorer's map and on the site's dark pages alike.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	ALL_TITLE_TYPES,
	ANIME_CHOICES,
	ANIME_NAMES,
	ANIME_SHORT_NAMES,
	ANIME_STATE_NAMES,
	type AnimeChoice,
	TITLE_FORMATS,
	TITLE_FORMAT_NAMES,
	type TitleTypeFilter,
	isAllTitleTypes,
	titleTypeNoun,
	titleTypeSummary,
} from "~/domain/title-type"
import { SnapSheet } from "~/ui/filter-bar/SnapSheet"
import { SortItems, radioKeys, useMenu } from "~/ui/filter-bar/controls"
import type { SortOption } from "~/ui/filter-bar/labels"
import { MENU } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"

/** From which width the wide form shows; below it, the one button. "wide" is 1520px. */
export type TypeFilterExpand =
	| "always"
	| "md"
	| "lg"
	| "xl"
	| "2xl"
	| "wide"
	| "never"

export interface TypeFilterProps {
	value: TitleTypeFilter
	onChange: (next: TitleTypeFilter) => void
	/** "md" by default: the wide form from 768px. */
	expandFrom?: TypeFilterExpand
	/** "md" is 44px high (a touch target); "sm" is 36px, for dense filter rows. */
	size?: "md" | "sm"
	/** Which edge of the control the menu and the popover line up with. */
	align?: "left" | "right"
	className?: string
}

// Whole class names, so Tailwind finds them.
const EXPAND: Record<TypeFilterExpand, [wide: string, narrow: string]> = {
	always: ["flex", "hidden"],
	md: ["hidden md:flex", "md:hidden"],
	lg: ["hidden lg:flex", "lg:hidden"],
	xl: ["hidden xl:flex", "xl:hidden"],
	"2xl": ["hidden 2xl:flex", "2xl:hidden"],
	wide: ["hidden min-[1520px]:flex", "min-[1520px]:hidden"],
	never: ["hidden", ""],
}

const PHONE = "(max-width: 767px)"
const GLASS = "bg-[#0a0e1a]/60 ring-1 ring-inset ring-white/10 backdrop-blur-xl"
const LIT =
	"bg-linear-to-b from-amber-400/15 to-amber-400/5 text-white ring-1 ring-inset ring-amber-400/55 backdrop-blur-xl"
const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
const SIZES = {
	md: {
		group: "rounded-[14px] p-1",
		radio: "h-9 rounded-[10px] px-3.5 text-[15px]",
		button: "h-11 rounded-[13px] px-3.5 text-[15px]",
	},
	sm: {
		group: "rounded-xl p-1",
		radio: "h-7 rounded-lg px-2.5 text-xs",
		button: "h-9 rounded-xl px-3 text-xs",
	},
}

const ANIME_OPTIONS: SortOption<AnimeChoice>[] = [
	{ key: "any", label: ANIME_NAMES.any, hint: "Next to everything else" },
	{ key: "only", label: ANIME_NAMES.only, hint: "Nothing but anime" },
	{ key: "none", label: ANIME_NAMES.none, hint: "Everything except anime" },
]

/** A radio group as a row of segments; arrow keys move and pick. */
function Segmented<K extends string>({
	label,
	options,
	names,
	value,
	onPick,
	size,
	full = false,
}: {
	label: string
	options: readonly K[]
	names: Record<K, string>
	value: K
	onPick: (key: K) => void
	size: "md" | "sm"
	full?: boolean
}) {
	const s = SIZES[size]
	return (
		<div
			role="radiogroup"
			aria-label={label}
			onKeyDown={(event) => radioKeys(event, (index) => onPick(options[index]))}
			className={`flex shrink-0 gap-0.5 ${s.group} ${GLASS} ${full ? "w-full" : ""}`}
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
						className={`cursor-pointer font-semibold whitespace-nowrap transition-colors ${s.radio} ${FOCUS} ${full ? "flex-1" : ""} ${on ? "bg-[#f4f6ff] text-[#0b0f1c] shadow-[0_4px_18px_rgba(160,190,255,.3)]" : "text-indigo-100/60 hover:bg-white/[0.06] hover:text-white"}`}
					>
						{names[key]}
					</button>
				)
			})}
		</div>
	)
}

/** Both choices as labeled rows of segments: the body of the sheet and of the popover. */
function Rows({
	value,
	onChange,
}: Pick<TypeFilterProps, "value" | "onChange">) {
	const row = (label: string, control: ReactNode) => (
		<div className="flex flex-col gap-1.5">
			<span
				aria-hidden
				className="text-xs font-semibold uppercase tracking-wide text-gray-400"
			>
				{label}
			</span>
			{control}
		</div>
	)
	return (
		<div className="flex flex-col gap-4">
			{row(
				"Movies or shows",
				<Segmented
					label="Movies or shows"
					options={TITLE_FORMATS}
					names={TITLE_FORMAT_NAMES}
					value={value.format}
					onPick={(format) => onChange({ ...value, format })}
					size="md"
					full
				/>,
			)}
			{row(
				"Anime",
				<Segmented
					label="Anime"
					options={ANIME_CHOICES}
					names={ANIME_SHORT_NAMES}
					value={value.anime}
					onPick={(anime) => onChange({ ...value, anime })}
					size="md"
					full
				/>,
			)}
		</div>
	)
}

/** The Anime chip and its menu of three. It says the choice once one is made, and lights up. */
function AnimeChip({
	value,
	onChange,
	size,
	align,
}: {
	value: AnimeChoice
	onChange: (anime: AnimeChoice) => void
	size: "md" | "sm"
	align: "left" | "right"
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const menuId = useId()
	useMenu(open, () => setOpen(false), root, trigger)
	return (
		<div ref={root} className="relative shrink-0">
			<button
				ref={trigger}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={() => setOpen((o) => !o)}
				className={`flex cursor-pointer items-center gap-1.5 font-semibold whitespace-nowrap transition-colors ${SIZES[size].button} ${FOCUS} ${value === "any" ? `${GLASS} text-indigo-100/60 hover:text-white` : LIT}`}
			>
				{ANIME_STATE_NAMES[value]}
				<ChevronDownIcon
					aria-hidden
					className={`-mr-1 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						id={menuId}
						role="menu"
						aria-label="Anime"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute z-40 mt-2 w-64 max-w-[calc(100vw-1.5rem)] p-1.5 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${MENU}`}
					>
						<SortItems
							options={ANIME_OPTIONS}
							value={value}
							dense
							onPick={(anime) => {
								onChange(anime)
								setOpen(false)
								trigger.current?.focus()
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

/** The narrow form: one button that says the choice, and both choices in a sheet (phones) or a popover. */
function OneButton({
	value,
	onChange,
	size,
	align,
}: Required<Pick<TypeFilterProps, "value" | "onChange" | "size" | "align">>) {
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
		<div ref={root} className="relative min-w-0">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={shown !== null}
				aria-label={`Type: ${summary}`}
				onClick={() => {
					if (shown) return close()
					const phone = window.matchMedia(PHONE).matches
					if (phone) setSheet(true)
					setShown(phone ? "sheet" : "popover")
				}}
				className={`flex max-w-full cursor-pointer items-center gap-1.5 font-semibold whitespace-nowrap transition-colors ${SIZES[size].button} ${FOCUS} ${isAllTitleTypes(value) ? `${GLASS} text-indigo-100/60 hover:text-white` : LIT}`}
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
							<h2 className="px-4 pb-3 text-base font-bold text-white">Type</h2>
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

// Room for the two rows; a shorter screen scrolls them.
const SHEET_SNAPS = [0.42]

/** The type filter: the format and anime. Controlled; the page keeps the value (in its URL). */
export function TypeFilter({
	value,
	onChange,
	expandFrom = "md",
	size = "md",
	align = "left",
	className = "",
}: TypeFilterProps) {
	const [wide, narrow] = EXPAND[expandFrom]
	return (
		<div className={`min-w-0 ${className}`}>
			{expandFrom !== "never" && (
				<div className={`${wide} items-center gap-2`}>
					<Segmented
						label="Movies or shows"
						options={TITLE_FORMATS}
						names={TITLE_FORMAT_NAMES}
						value={value.format}
						onPick={(format) => onChange({ ...value, format })}
						size={size}
					/>
					<AnimeChip
						value={value.anime}
						onChange={(anime) => onChange({ ...value, anime })}
						size={size}
						align={align}
					/>
				</div>
			)}
			{expandFrom !== "always" && (
				<div className={narrow}>
					<OneButton
						value={value}
						onChange={onChange}
						size={size}
						align={align}
					/>
				</div>
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
