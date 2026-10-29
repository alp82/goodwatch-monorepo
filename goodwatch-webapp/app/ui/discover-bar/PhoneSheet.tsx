// Phones: the Discover sheet's frame. It has one fixed height (94% of the screen) and moves only by translateY, so
// opening, closing and dragging never change its layout; the backdrop only fades. Nothing blurs behind it. It drags
// by its handle and header and closes when dragged down past a quarter of its height or flicked down, on the backdrop,
// or with Escape. It's a labeled modal dialog with a focus trap and returns focus to the control that opened it.
import {
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "framer-motion"
import {
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"

const SHEET_SPRING = {
	type: "spring",
	stiffness: 420,
	damping: 40,
	mass: 0.8,
} as const
/** Dragged down past this share of its height, the sheet closes. */
const CLOSE_PAST = 0.25
/** A flick down faster than this (px per ms) closes it too. */
const CLOSE_FLICK = 0.6

export function PhoneSheet({
	open,
	onClose,
	label,
	header,
	footer,
	children,
	initialFocus,
}: {
	open: boolean
	onClose: () => void
	/** The dialog's accessible name. */
	label: string
	header?: ReactNode
	footer?: ReactNode
	children?: ReactNode
	initialFocus?: RefObject<HTMLElement>
}) {
	const panel = useRef<HTMLDivElement>(null)
	// The distance below its open place; the sheet's height while closed. Starts off screen.
	const y = useMotionValue(10_000)
	const drag = useRef<{
		y: number
		start: number
		t: number
		v: number
	} | null>(null)
	useModalDialog({ open, onClose, container: panel, initialFocus })
	const reduced = useReducedMotion()
	// Keep the scrollbar's room while the page behind the sheet stays put.
	useEffect(() => {
		if (!open) return
		const html = document.documentElement
		const styles = [html.style, document.body.style]
		const overflowProperties = ["overflow", "overflow-x", "overflow-y"]
		const before = styles.map((style) =>
			overflowProperties.map((property) => ({
				property,
				value: style.getPropertyValue(property),
				priority: style.getPropertyPriority(property),
			})),
		)
		const gutter = html.style.scrollbarGutter
		const { scrollX, scrollY } = window
		html.style.scrollbarGutter = "stable"
		for (const style of styles) style.overflow = "hidden"
		return () => {
			styles.forEach((style, index) => {
				for (const property of overflowProperties)
					style.removeProperty(property)
				for (const { property, value, priority } of before[index])
					if (value) style.setProperty(property, value, priority)
			})
			html.style.scrollbarGutter = gutter
			window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" })
		}
	}, [open])

	// The content stays mounted while the sheet closes.
	const [mounted, setMounted] = useState(open)
	const shown = open || mounted
	useEffect(() => {
		const height = panel.current?.offsetHeight ?? window.innerHeight
		if (open) setMounted(true)
		const target = open ? 0 : height
		// Closed and already off screen (the first render): nothing to move.
		if (reduced || (!open && y.get() >= height)) {
			y.set(target)
			if (!open) setMounted(false)
			return
		}
		if (open && y.get() > height) y.set(height)
		const control = animate(y, target, SHEET_SPRING)
		control.then(() => !open && setMounted(false))
		return () => control.stop()
	}, [open, y, reduced])

	// The backdrop follows the sheet: clear when it is off screen, 55% black when open.
	const backdrop = useTransform(y, (value) => {
		const height = panel.current?.offsetHeight || 1
		return Math.max(0, Math.min(1, 1 - value / height))
	})

	const onDown = (event: PointerEvent) => {
		// Buttons and fields in the header stay what they are; drag from the handle or empty space.
		if ((event.target as HTMLElement).closest("button, a, input, label")) return
		;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
		drag.current = {
			y: event.clientY,
			start: y.get(),
			t: performance.now(),
			v: 0,
		}
	}
	const onMove = (event: PointerEvent) => {
		const d = drag.current
		if (!d) return
		const now = performance.now()
		const moved = d.start + (event.clientY - d.y)
		// Above its open place it gives a little and no more.
		const next = moved < 0 ? moved * 0.15 : moved
		d.v = (next - y.get()) / Math.max(1, now - d.t)
		d.t = now
		y.set(next)
	}
	const onUp = () => {
		const d = drag.current
		drag.current = null
		if (!d) return
		const height = panel.current?.offsetHeight ?? window.innerHeight
		if (y.get() > height * CLOSE_PAST || d.v > CLOSE_FLICK) onClose()
		else animate(y, 0, SHEET_SPRING)
	}

	return (
		<div className="pointer-events-none fixed inset-0 z-[1001]">
			<motion.div
				aria-hidden
				style={{ opacity: backdrop }}
				className={`fixed inset-0 bg-black/55 ${open ? "pointer-events-auto" : ""} ${shown ? "" : "invisible"}`}
				onClick={onClose}
			/>
			<motion.div
				// biome-ignore lint/a11y/useSemanticElements: an animated sheet with its own focus trap; <dialog> can't animate out
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				aria-hidden={!open}
				style={{ y }}
				className={`pointer-events-auto absolute inset-x-0 bottom-0 flex h-[94vh] flex-col overflow-hidden rounded-t-[28px] bg-gray-950 ring-1 ring-white/10 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)] will-change-transform supports-[height:100svh]:h-[94svh] ${shown ? "" : "invisible"}`}
			>
				<div
					className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
					onPointerDown={onDown}
					onPointerMove={onMove}
					onPointerUp={onUp}
					onPointerCancel={onUp}
				>
					<div className="flex justify-center pt-2.5 pb-1.5">
						<span className="h-1.5 w-10 rounded-full bg-white/25" />
					</div>
					{header}
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{shown && children}
				</div>
				{shown && footer}
			</motion.div>
		</div>
	)
}
