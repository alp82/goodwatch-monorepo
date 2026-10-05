// The type filter's choices: a popover from md up, a bottom sheet on phones. TypeFilter.tsx loads this module, and
// the animation library with it, when a visitor reaches for the filter's button.
import { AnimatePresence, motion } from "framer-motion"
import { type RefObject, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
	ALL_TITLE_TYPES,
	ANIME_CHOICES,
	ANIME_SHORT_NAMES,
	TITLE_FORMATS,
	TITLE_FORMAT_NAMES,
	isAllTitleTypes,
} from "~/domain/title-type"
import { SnapSheet } from "~/ui/filter-bar/SnapSheet"
import { radioKeys } from "~/ui/filter-bar/controls"
import { MENU } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import { FOCUS, GLASS, type TypeFilterProps } from "./TypeFilter"

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

export interface TypeFilterPanelProps
	extends Pick<TypeFilterProps, "value" | "onChange" | "align"> {
	/** Which of the two is open. */
	shown: "sheet" | "popover" | null
	onShown: (shown: "sheet" | "popover" | null) => void
	/** The sheet mounts with its first opening, in the body: clear of the page's stacking and clipping. */
	sheet: boolean
	/** The filter's root element. A press outside it closes the popover. */
	root: RefObject<HTMLDivElement>
}

export default function TypeFilterPanel({
	value,
	onChange,
	align = "left",
	shown,
	onShown,
	sheet,
	root,
}: TypeFilterPanelProps) {
	const popover = useRef<HTMLDivElement>(null)
	useModalDialog({
		open: shown === "popover",
		onClose: () => onShown(null),
		container: popover,
	})
	useEffect(() => {
		if (shown !== "popover") return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) onShown(null)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [shown, root, onShown])
	return (
		<>
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
						onIndex={(index) => onShown(index < 0 ? null : "sheet")}
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
		</>
	)
}
