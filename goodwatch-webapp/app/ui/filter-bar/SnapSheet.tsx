// A bottom sheet for phones that snaps to fractions of the screen height (by default 58% and 94%). It drags by its
// handle and header; content scrolls. It closes when dragged below 60% of the first snap, on the backdrop, or with
// Escape. It's a labeled modal dialog with a focus trap and returns focus to the control that opened it.
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useReducedMotion,
} from "framer-motion"
import {
	type PointerEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { useModalDialog } from "./useModalDialog"

export const SHEET_SNAPS = [0.58, 0.94]
const CLOSE_BELOW = 0.6
const SHEET_SPRING = {
	type: "spring",
	stiffness: 420,
	damping: 40,
	mass: 0.8,
} as const

export function SnapSheet({
	index,
	onIndex,
	label,
	snaps = SHEET_SNAPS,
	header,
	footer,
	children,
	initialFocus,
}: {
	/** The snap shown; -1 is closed. */
	index: number
	onIndex: (index: number) => void
	/** The dialog's accessible name. */
	label: string
	snaps?: number[]
	header?: ReactNode
	footer?: ReactNode
	children?: ReactNode
	initialFocus?: RefObject<HTMLElement>
}) {
	const wrap = useRef<HTMLDivElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const reduced = useReducedMotion()
	const [height, setHeight] = useState(800)
	const h = useMotionValue(0)
	const drag = useRef<{ y: number; h: number; t: number; v: number } | null>(
		null,
	)
	const open = index >= 0
	const px = useCallback((snap: number) => snap * height, [height])
	const close = useCallback(() => onIndex(-1), [onIndex])
	useModalDialog({ open, onClose: close, container: panel, initialFocus })

	useEffect(() => {
		const el = wrap.current
		if (!el) return
		const observer = new ResizeObserver(() => setHeight(el.clientHeight))
		observer.observe(el)
		setHeight(el.clientHeight)
		return () => observer.disconnect()
	}, [])

	// The content stays mounted while the sheet closes.
	const [mounted, setMounted] = useState(open)
	// Shown from the render that opens it, so the dialog can take focus right away.
	const shown = open || mounted
	useEffect(() => {
		if (open) setMounted(true)
		const target = open ? px(snaps[Math.min(index, snaps.length - 1)]) : 0
		if (reduced) {
			h.set(target)
			if (!open) setMounted(false)
			return
		}
		const control = animate(h, target, SHEET_SPRING)
		control.then(() => !open && setMounted(false))
		return () => control.stop()
	}, [index, open, px, snaps, h, reduced])

	const onDown = (event: PointerEvent) => {
		// Buttons and fields in the header stay what they are; drag from the handle or empty space.
		if ((event.target as HTMLElement).closest("button, a, input, label")) return
		;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
		drag.current = { y: event.clientY, h: h.get(), t: performance.now(), v: 0 }
	}
	const onMove = (event: PointerEvent) => {
		const d = drag.current
		if (!d) return
		const now = performance.now()
		const next = Math.max(
			0,
			Math.min(height * 0.98, d.h + (d.y - event.clientY)),
		)
		d.v = (next - h.get()) / Math.max(1, now - d.t)
		d.t = now
		h.set(next)
	}
	const onUp = () => {
		const d = drag.current
		drag.current = null
		if (!d) return
		if (Math.abs(h.get() - d.h) < 4) {
			// A tap on the handle steps up one snap, and from the top back to the first.
			onIndex(index >= snaps.length - 1 ? 0 : index + 1)
			return
		}
		const projected = h.get() + d.v * 180
		const points = snaps.map(px)
		let best = 0
		for (let i = 1; i < points.length; i++)
			if (Math.abs(points[i] - projected) < Math.abs(points[best] - projected))
				best = i
		if (projected < points[0] * CLOSE_BELOW) best = -1
		if (best === index) animate(h, points[best], SHEET_SPRING)
		onIndex(best)
	}

	return (
		<div ref={wrap} className="pointer-events-none fixed inset-0 z-[1001]">
			<AnimatePresence>
				{open && (
					<motion.div
						key="backdrop"
						aria-hidden
						className="pointer-events-auto fixed inset-0 bg-black/55 backdrop-blur-[2px]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={close}
					/>
				)}
			</AnimatePresence>
			<motion.div
				// biome-ignore lint/a11y/useSemanticElements: an animated sheet with its own focus trap; <dialog> can't animate out
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				aria-hidden={!open}
				style={{ height: h }}
				className={`pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] bg-gray-950/95 backdrop-blur-2xl ${shown ? "ring-1 ring-white/10 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)]" : "invisible"}`}
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
