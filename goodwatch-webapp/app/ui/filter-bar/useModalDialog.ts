import { type RefObject, useEffect, useRef } from "react"

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",")

const focusables = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => el.offsetParent !== null || el === document.activeElement,
	)

/**
 * What a modal dialog needs while it's open: focus moves in (to `initialFocus`, else the first control), Tab and
 * Shift+Tab stay inside, Escape calls `onClose`, and focus returns to what had it before (the control that opened
 * it) once it closes. The caller renders `role="dialog"`, `aria-modal`, and a label.
 */
export function useModalDialog({
	open,
	onClose,
	container,
	initialFocus,
}: {
	open: boolean
	onClose: () => void
	container: RefObject<HTMLElement>
	initialFocus?: RefObject<HTMLElement>
}) {
	const close = useRef(onClose)
	close.current = onClose

	useEffect(() => {
		if (!open) return
		const opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null
		const frame = requestAnimationFrame(() => {
			const root = container.current
			if (!root) return
			const target = initialFocus?.current ?? focusables(root)[0] ?? root
			target.focus({ preventScroll: true })
		})
		const onKey = (event: KeyboardEvent) => {
			const root = container.current
			if (!root) return
			if (event.key === "Escape") {
				event.stopPropagation()
				close.current()
				return
			}
			if (event.key !== "Tab") return
			const items = focusables(root)
			if (!items.length) {
				event.preventDefault()
				return
			}
			const first = items[0]
			const last = items[items.length - 1]
			const active = document.activeElement
			if (!root.contains(active)) {
				event.preventDefault()
				first.focus()
			} else if (event.shiftKey && active === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && active === last) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener("keydown", onKey, true)
		return () => {
			cancelAnimationFrame(frame)
			document.removeEventListener("keydown", onKey, true)
			if (opener?.isConnected) opener.focus({ preventScroll: true })
		}
	}, [open, container, initialFocus])
}
