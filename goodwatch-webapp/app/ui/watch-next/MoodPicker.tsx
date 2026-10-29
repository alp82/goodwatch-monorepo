// The picker in the docked strip (#677, decided in #659): the picks as small poster chips with a remove button, a
// button that opens the dropdown, and the dropdown itself: the taste shelf (TasteShelf.tsx) with moods, themes,
// styles, and the member's taste groups, "k of 3", Clear, and Done. A fourth pick is refused with a hint (the page
// announces it in a live region). The phone's drawer reuses the shelf and the hint.
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { MAX_PICKS } from "~/domain/taste-picker"
import type { WatchNext } from "~/server/watch-next.server"
import { PickChip, type ShelfLines, TasteShelf } from "./TasteShelf"
import { pickHint } from "./labels"
import { EASE } from "./style"

export interface MoodControl {
	/** The choices, their counts, and the picks. */
	picker: WatchNext["picker"]
	/** "on your services" or "on your Wishlist": what the counts count. */
	countScope: string
	open: boolean
	setOpen: (open: boolean) => void
	/** Picks or unpicks a choice ("m:funny", "t:crime", "g1"); a fourth pick is refused. */
	toggle: (id: string) => void
	clear: () => void
	/** The choice last refused, by name, with a counter so the same refusal shows again. */
	refused: { name: string; at: number } | null
}

export const refusalText = (name: string) =>
	`Three is the most. Remove one to add ${name}.`

/** The mood colors that stand for "Any mood". */
export const SPECTRUM: readonly MoodKey[] = [
	"funny",
	"romance",
	"crime",
	"worlds",
]

// Four mood colors in a small fan, for the "Any mood" button.
function Spectrum() {
	return (
		<span className="flex -space-x-2" aria-hidden>
			{SPECTRUM.map((mood) => (
				<span
					key={mood}
					className="h-6 w-6 rounded-full ring-2 ring-gray-900"
					style={{ background: MOOD_BY_KEY[mood].hue }}
				/>
			))}
		</span>
	)
}

/** The picks as poster chips. Each opens the dropdown; its × removes the pick. */
export function PickedMoods({
	control,
	pinned,
}: {
	control: MoodControl
	pinned: boolean
}) {
	return (
		<>
			{control.picker.picks.map((id) => (
				<PickChip key={id} control={control} id={id} pinned={pinned} />
			))}
		</>
	)
}

/** Opens the dropdown: "Any mood" with nothing picked, "Add" or "Change" next to picked moods. */
export function MoodButton({
	control,
	buttonRef,
}: {
	control: MoodControl
	buttonRef: React.RefObject<HTMLButtonElement>
}) {
	const picked = control.picker.picks.length > 0
	return (
		<button
			ref={buttonRef}
			type="button"
			data-moodbutton
			aria-haspopup="dialog"
			aria-expanded={control.open}
			aria-label={picked ? "Change picks" : undefined}
			onClick={() => control.setOpen(!control.open)}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 ${picked ? "px-2.5" : "pl-1.5 pr-3"} ${control.open ? "bg-white/15" : "bg-white/10"}`}
		>
			{picked ? (
				control.picker.picks.length < MAX_PICKS ? (
					"Add"
				) : (
					"Change"
				)
			) : (
				<>
					<Spectrum />
					Any mood
				</>
			)}
			<ChevronDownIcon
				className={`h-4 w-4 opacity-70 transition-transform ${control.open ? "rotate-180" : ""}`}
				aria-hidden
			/>
		</button>
	)
}

/** The refusal of a fourth pick, shown for a few seconds in place of the title. */
export function useRefusalHint(control: MoodControl): string | null {
	const [hint, setHint] = useState<string | null>(null)
	useEffect(() => {
		if (!control.refused) return
		setHint(refusalText(control.refused.name))
		const id = setTimeout(() => setHint(null), 3200)
		return () => clearTimeout(id)
	}, [control.refused])
	return hint
}

/** The dropdown's top line: the title or the refusal hint, "k of 3", Clear, and Done. */
export function PanelHead({
	control,
	onDone,
	line,
}: {
	control: MoodControl
	onDone: () => void
	/** What follows "Pick up to three" (from 640 px); what another pick would do by default. */
	line?: string
}) {
	const k = control.picker.picks.length
	const hint = useRefusalHint(control)
	return (
		<div className="flex min-h-9 shrink-0 items-center gap-3 border-b border-white/8 px-3 py-2">
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p
						key="hint"
						data-hint
						initial={{ opacity: 0, x: -6 }}
						animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.35 }}
						className="min-w-0 flex-1 text-sm font-semibold text-amber-300"
					>
						{hint}
					</motion.p>
				) : (
					<motion.p
						key="title"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.08 } }}
						className="min-w-0 flex-1 text-sm text-gray-300"
					>
						<span className="font-semibold text-white">Pick up to three</span>
						<span className="hidden sm:inline">
							. {line ?? pickHint(control.picker)}
						</span>
					</motion.p>
				)}
			</AnimatePresence>
			<span
				className={`shrink-0 text-sm tabular-nums ${k === MAX_PICKS ? "font-semibold text-amber-300" : "text-gray-400"}`}
			>
				{k} of {MAX_PICKS}
			</span>
			{k > 0 && (
				<button
					type="button"
					onClick={control.clear}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
			<button
				type="button"
				onClick={onDone}
				className="shrink-0 cursor-pointer rounded-full bg-white px-3 py-1 text-sm font-bold text-black hover:bg-gray-200"
			>
				Done
			</button>
		</div>
	)
}

/**
 * The shelf's grid: two, three, or four columns in the dropdown, scrolling inside it. `dense` is the phone drawer's:
 * two columns of shorter tiles with the name and count (the rest stays in the label), scrolling with the drawer.
 */
export function MoodGrid({
	control,
	dense = false,
	shelf,
}: {
	control: MoodControl
	dense?: boolean
	/** The page's own shelf lines (TasteShelf). */
	shelf?: ShelfLines
}) {
	return (
		<div
			data-shelf
			className={
				dense
					? "grid grid-cols-2 gap-2"
					: "grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-3 lg:grid-cols-4"
			}
		>
			<TasteShelf control={control} dense={dense} shelf={shelf} />
		</div>
	)
}

/**
 * The dropdown, in a layer over the page under `anchor` (the strip), as wide as the strip. It follows the strip while
 * the page moves, closes on a tap outside, Escape, or Done, and gives focus back to the mood button.
 */
export function MoodPanel({
	control,
	anchor,
	returnFocus,
}: {
	control: MoodControl
	anchor: React.RefObject<HTMLElement | null>
	returnFocus: React.RefObject<HTMLButtonElement>
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{
		top: number
		left: number
		width: number
		max: number
	} | null>(null)
	const { open, setOpen } = control

	const close = (refocus: boolean) => {
		setOpen(false)
		if (refocus) returnFocus.current?.focus()
	}

	useLayoutEffect(() => {
		if (!open) return
		const place = () => {
			const el = anchor.current
			if (!el) return
			const r = el.getBoundingClientRect()
			if (r.bottom < 60) return setOpen(false)
			const vw = window.innerWidth
			const width = Math.min(r.width, vw - 16)
			const top = r.bottom + 8
			setBox({
				top,
				left: Math.max(8, Math.min(r.left, vw - width - 8)),
				width,
				max: window.innerHeight - top - 12,
			})
		}
		place()
		const observer = new ResizeObserver(place)
		if (anchor.current) observer.observe(anchor.current)
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => {
			observer.disconnect()
			window.removeEventListener("scroll", place)
			window.removeEventListener("resize", place)
		}
	}, [open, anchor, setOpen])

	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			if (
				!panel.current?.contains(target) &&
				!target.closest("[data-moodbutton]")
			)
				setOpen(false)
		}
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setOpen(false)
			returnFocus.current?.focus()
		}
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", onEscape)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", onEscape)
		}
	}, [open, setOpen, returnFocus])

	// Focus moves to the first choice when the dropdown opens.
	useEffect(() => {
		if (!open || !box) return
		const id = requestAnimationFrame(() =>
			panel.current?.querySelector<HTMLElement>("[data-choice]")?.focus(),
		)
		return () => cancelAnimationFrame(id)
	}, [open, !box])

	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{open && box && (
				<motion.div
					key="moods"
					ref={panel}
					// biome-ignore lint/a11y/useSemanticElements: an animated, non-modal popover positioned under the strip
					role="dialog"
					aria-label="Picks"
					data-panel
					initial={{ opacity: 0, y: -8, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 0.985 }}
					transition={{ duration: 0.2, ease: EASE }}
					className="fixed z-[70] flex origin-top flex-col overflow-hidden rounded-2xl bg-gray-900/95 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl"
					style={{
						top: box.top,
						left: box.left,
						width: box.width,
						maxHeight: box.max,
					}}
				>
					<PanelHead control={control} onDone={() => close(true)} />
					<MoodGrid control={control} />
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}
