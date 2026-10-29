// The start page mood picker's panel (StartMoodPicker.tsx has the row and the rules): "Start with a mix" and then
// Moods, Themes, and Styles, folded. Its code loads on first use (StartMoodPicker.tsx asks for it on intent).
//
// The panel overlays: it hangs in a layer over the page under the picker row and scrolls with it, so nothing behind it
// moves and no scroll frame measures. It runs down to 16 px above the window's bottom (above the phone's dock); with
// less than 360 px left there, the page first scrolls it up to 72 px from the top. A resize places it again from the
// page as it is then. Solid gray-900 with no blur: the room's light changes behind it.
import { AnimatePresence, motion } from "framer-motion"
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import {
	type MoodControl,
	MoodGrid,
	PanelHead,
} from "~/ui/watch-next/MoodPicker"
import type { ShelfLines } from "~/ui/watch-next/TasteShelf"
import { EASE } from "~/ui/watch-next/style"
import { PANEL_LINE, type PanelBox, panelBox } from "./start-picker"

/** After a resize: how many frames the row holds its place before the panel counts as placed, and the longest wait. */
const SETTLE_FRAMES = 3
const SETTLE_MS = 2000

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

/** What the panel's place depends on, read from the page. */
function windowFacts(anchor: HTMLElement) {
	const vh = window.visualViewport?.height ?? window.innerHeight
	const dock = document.querySelector<HTMLElement>("[data-mobile-dock]")
	// The dock is fixed (no offsetParent); hidden from 1024 px.
	const dockBox = dock?.getBoundingClientRect()
	const dockTop = dockBox?.height ? dockBox.top : vh
	const column = (
		anchor.closest(".start-moods") ?? anchor
	).getBoundingClientRect()
	const scroller = document.scrollingElement ?? document.documentElement
	return {
		row: anchor.getBoundingClientRect(),
		column: { left: column.left + window.scrollX, width: column.width },
		bottom: Math.min(vh, dockTop),
		scrollY: window.scrollY,
		room: scroller.scrollHeight - vh - window.scrollY,
	}
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

	// Placed on open and after resizes (the window's or the visual viewport's), never per scroll frame.
	useLayoutEffect(() => {
		if (!open) {
			setBox(null)
			return
		}
		const el = anchor.current
		if (!el) return
		const first = panelBox(windowFacts(el))
		setBox(first)
		if (first.scrollBy)
			window.scrollBy({ top: first.scrollBy, behavior: "smooth" })
		// Placed again from the page as it is then: a rotation moves the row and reflows the column, and the page's own
		// layout keeps moving the row after (the search block's transform eases to its new place). So after a resize the
		// row is watched each frame until the block's move has ended and the row has held its place for SETTLE_FRAMES
		// frames (SETTLE_MS at most); the panel is then placed once and the page scrolls. Moving the panel every frame
		// would shift its layout every frame.
		let frame = 0
		let lastRow = Number.NaN
		let still = 0
		let until = 0
		const follow = () => {
			frame = 0
			if (!anchor.current) return
			const facts = windowFacts(anchor.current)
			const row = facts.row.bottom + facts.scrollY
			still = Math.abs(row - lastRow) < 1 ? still + 1 : 0
			lastRow = row
			const moving = anchor.current
				.closest(".start-block")
				?.getAnimations?.()
				.some((a) => a.playState === "running")
			const done =
				(!moving && still >= SETTLE_FRAMES) || performance.now() > until
			if (!done) {
				frame = requestAnimationFrame(follow)
				return
			}
			const next = panelBox(facts)
			setBox((current) => (current && sameBox(current, next) ? current : next))
			if (next.scrollBy)
				window.scrollBy({ top: next.scrollBy, behavior: "smooth" })
		}
		const onResize = () => {
			until = performance.now() + SETTLE_MS
			still = 0
			if (!frame) frame = requestAnimationFrame(follow)
		}
		window.addEventListener("resize", onResize)
		window.visualViewport?.addEventListener("resize", onResize)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("resize", onResize)
			window.visualViewport?.removeEventListener("resize", onResize)
		}
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

	// Focus moves to the first choice when the panel opens.
	const placed = box !== null
	useEffect(() => {
		if (!open || !placed) return
		const id = requestAnimationFrame(() =>
			panel.current
				?.querySelector<HTMLElement>("[data-choice]")
				?.focus({ preventScroll: true }),
		)
		return () => cancelAnimationFrame(id)
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
					<PanelHead control={control} onDone={onDone} line={PANEL_LINE} />
					<MoodGrid control={control} shelf={shelf} />
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}
