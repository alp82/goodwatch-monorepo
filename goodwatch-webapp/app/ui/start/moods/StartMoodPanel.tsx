// The start page mood picker's panel (StartMoodPicker.tsx has the row and the rules): "Start with a mix" and then
// Moods, Themes, and Styles, folded. Its code loads on first use (StartMoodPicker.tsx asks for it on intent).
//
// The panel overlays: it hangs in a layer over the page under the picker row and scrolls with it, so nothing behind it
// moves and no scroll frame measures. It runs down to 16 px above the window's bottom (above the phone's dock); with
// less than 360 px left there, the page first scrolls it up to 72 px from the top. A resize places it again from the
// page as it is then. Solid gray-900 with no blur: the room's light changes behind it.
import { AnimatePresence, motion } from "framer-motion"
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	type MoodControl,
	MoodGrid,
	PanelHead,
} from "~/ui/watch-next/MoodPicker"
import type { ShelfLines } from "~/ui/watch-next/TasteShelf"
import { EASE } from "~/ui/watch-next/style"
import { afterPanelPaint, watchPanelPlacement } from "./panel-placement"
import { PANEL_LINE, type PanelBox } from "./start-picker"

const sameBox = (a: PanelBox, b: PanelBox) =>
	a.top === b.top &&
	a.left === b.left &&
	a.width === b.width &&
	a.maxHeight === b.maxHeight

export type StartMoodPanelProps = {
	control: MoodControl
	shelf: ShelfLines
	anchor: RefObject<HTMLElement | null>
	returnFocus: RefObject<HTMLButtonElement | null>
	onDone: () => void
}

export function StartMoodPanel({
	control,
	shelf,
	anchor,
	returnFocus,
	onDone,
}: StartMoodPanelProps) {
	const panel = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<PanelBox | null>(null)
	const { open, setOpen } = control
	const close = useCallback(() => setOpen(false), [setOpen])
	const openNow = useRef(open)
	openNow.current = open
	const doneFocus = useRef<(() => void) | null>(null)
	const cancelDoneFocus = useCallback(() => {
		doneFocus.current?.()
		doneFocus.current = null
	}, [])
	useEffect(() => cancelDoneFocus, [cancelDoneFocus])
	useEffect(() => {
		if (open) cancelDoneFocus()
	}, [open, cancelDoneFocus])
	const done = () => {
		const from = document.activeElement
		cancelDoneFocus()
		onDone()
		// Closing and opening the card provide the feedback first. Restore keyboard focus after that render paints,
		// unless the visitor has already entered another control or reopened the panel.
		doneFocus.current = afterPanelPaint(() => {
			doneFocus.current = null
			if (openNow.current) return
			const active = document.activeElement
			if (active === from || active === document.body || active === null)
				returnFocus.current?.focus({ preventScroll: true })
		})
	}

	// Measure after the opening commit has painted; coalesce resizes and wait for the block's motion without polling.
	useEffect(() => {
		if (!open) {
			setBox(null)
			return
		}
		const el = anchor.current
		if (!el) return
		return watchPanelPlacement(el, (next) => {
			setBox((current) => (current && sameBox(current, next) ? current : next))
			if (next.scrollBy)
				window.scrollBy({ top: next.scrollBy, behavior: "smooth" })
		})
	}, [open, anchor])

	// Closes on a tap outside the panel and the mood buttons, and on Escape (focus back on the button).
	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			const target = event.target as HTMLElement
			if (
				!panel.current?.contains(target) &&
				!target.closest("[data-moodbutton]")
			)
				close()
		}
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			close()
			returnFocus.current?.focus({ preventScroll: true })
		}
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", onEscape)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", onEscape)
		}
	}, [open, close, returnFocus])

	// Focus after the placed panel has painted, rather than forcing its new layout in its first animation frame.
	const placed = box !== null
	useEffect(() => {
		if (!open || !placed) return
		return afterPanelPaint(() => {
			// A fast keyboard user may already have entered the choices; keep their place.
			if (panel.current?.contains(document.activeElement)) return
			panel.current
				?.querySelector<HTMLElement>("[data-choice]")
				?.focus({ preventScroll: true })
		})
	}, [open, placed])

	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{open && box && (
				<motion.div
					key="start-moods"
					ref={panel}
					// biome-ignore lint/a11y/useSemanticElements: a non-modal popover under the picker row
					role="dialog"
					aria-label="Picks"
					initial={{ opacity: 0, y: -8, scale: 0.985 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 0.985 }}
					transition={{ duration: 0.2, ease: EASE }}
					className="absolute z-40 flex origin-top flex-col overflow-hidden rounded-2xl bg-gray-900 text-white shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12"
					style={{
						top: box.top,
						left: box.left,
						width: box.width,
						maxHeight: box.maxHeight,
					}}
				>
					<PanelHead control={control} onDone={done} line={PANEL_LINE} />
					<MoodGrid control={control} shelf={shelf} />
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}
