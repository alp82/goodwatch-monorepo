// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). A layer that opens from an anchor: a panel under the
// anchor from `sm` up (it scrolls with the page), a bottom sheet on a phone. Closes on a press outside, Escape, and
// when the page changes. Transform and opacity only.
import { useLocation } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { EASE } from "../../kit/ui"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function Floating({
	open,
	onClose,
	anchor,
	alignTo,
	width,
	label,
	children,
}: {
	open: boolean
	onClose: () => void
	/** The control that opened it; the panel hangs under it. */
	anchor: RefObject<HTMLElement>
	/** From `sm` up: line the panel's left edge up with this element instead of the anchor. */
	alignTo?: RefObject<HTMLElement>
	/** The panel's width from `sm` up, in px. */
	width: number
	label: string
	children: ReactNode
}) {
	const reduce = useReducedMotion()
	const panel = useRef<HTMLDivElement>(null)
	const location = useLocation()
	const [pos, setPos] = useState<{
		left: number
		top: number
		w: number
	} | null>(null)
	const [sheet, setSheet] = useState(false)
	const opened = useRef(location.key)

	useIsoLayoutEffect(() => {
		if (!open) return
		opened.current = location.key
		const place = () => {
			const phone = !window.matchMedia("(min-width: 640px)").matches
			setSheet(phone)
			if (phone) return setPos({ left: 0, top: 0, w: 0 })
			const a = anchor.current?.getBoundingClientRect()
			if (!a) return
			const to = alignTo?.current?.getBoundingClientRect()
			const edge = to?.left ?? a.left
			const under = Math.max(a.bottom, to?.bottom ?? 0)
			const w = Math.min(width, document.documentElement.clientWidth - 24)
			const left = Math.min(Math.max(12, edge), document.documentElement.clientWidth - w - 12)
			setPos({
				left: left + window.scrollX,
				top: under + window.scrollY + 12,
				w,
			})
		}
		place()
		window.addEventListener("resize", place)
		return () => window.removeEventListener("resize", place)
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- placed once per opening
	}, [open, width])

	// The page changed under it (an ingredient was added): close.
	useEffect(() => {
		if (open && location.key !== opened.current) onClose()
	}, [location.key, open, onClose])

	useEffect(() => {
		if (!open) return
		const away = (e: PointerEvent) => {
			const t = e.target as Node
			if (panel.current?.contains(t) || anchor.current?.contains(t)) return
			onClose()
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			onClose()
			anchor.current?.focus()
		}
		window.addEventListener("pointerdown", away)
		window.addEventListener("keydown", key)
		return () => {
			window.removeEventListener("pointerdown", away)
			window.removeEventListener("keydown", key)
		}
	}, [open, onClose, anchor])

	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{open && pos && (
				<>
					{sheet && (
						<motion.div
							key="shade"
							aria-hidden
							className="fixed inset-0 z-[110] bg-black/60"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
						/>
					)}
					<motion.div
						key="panel"
						ref={panel}
						// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a non-modal panel; <dialog> would trap the page
						role="dialog"
						aria-label={label}
						className={
							sheet
								? "fixed inset-x-0 bottom-0 z-[111] max-h-[82vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-gray-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/15"
								: "absolute z-[65] overflow-hidden rounded-2xl bg-gray-900 shadow-2xl shadow-black/60 ring-1 ring-white/15"
						}
						style={sheet ? undefined : { left: pos.left, top: pos.top, width: pos.w }}
						initial={reduce ? { opacity: 0 } : sheet ? { y: "100%" } : { opacity: 0, y: -6 }}
						animate={reduce ? { opacity: 1 } : sheet ? { y: 0 } : { opacity: 1, y: 0 }}
						exit={reduce ? { opacity: 0 } : sheet ? { y: "100%" } : { opacity: 0, y: -4 }}
						transition={{ duration: sheet ? 0.28 : 0.16, ease: EASE }}
					>
						{sheet && (
							<div aria-hidden className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-white/20" />
						)}
						{children}
					</motion.div>
				</>
			)}
		</AnimatePresence>,
		document.body,
	)
}
