import { type RefObject, useEffect, useRef } from "react"

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",")

/** The Tab stops in `root`: shown, and not taken out of the Tab order (a roving tab index's other items). */
const focusables = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) =>
			(el.offsetParent !== null || el === document.activeElement) &&
			el.tabIndex >= 0,
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
		let fallbackRoot: HTMLElement | undefined
		const focusRoot = (root: HTMLElement) => {
			if (!root.hasAttribute("tabindex")) {
				root.tabIndex = -1
				fallbackRoot = root
			}
			root.focus({ preventScroll: true })
		}
		const opener =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null
		const frame = requestAnimationFrame(() => {
			const root = container.current
			if (!root) return
			const target = initialFocus?.current ?? focusables(root)[0]
			if (target) target.focus({ preventScroll: true })
			else focusRoot(root)
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
				focusRoot(root)
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
			} else if (active && !items.includes(active as HTMLElement)) {
				// Arrow keys can focus a roving radio whose selection was rejected. It is not a Tab stop,
				// so continue from its place in the DOM, wrapping if there is no stop in that direction.
				const next = event.shiftKey
					? [...items]
							.reverse()
							.find((item) =>
								Boolean(
									active.compareDocumentPosition(item) &
										Node.DOCUMENT_POSITION_PRECEDING,
								),
							)
					: items.find((item) =>
							Boolean(
								active.compareDocumentPosition(item) &
									Node.DOCUMENT_POSITION_FOLLOWING,
							),
						)
				event.preventDefault()
				;(next ?? (event.shiftKey ? last : first)).focus()
			}
		}
		document.addEventListener("keydown", onKey, true)
		return () => {
			cancelAnimationFrame(frame)
			document.removeEventListener("keydown", onKey, true)
			fallbackRoot?.removeAttribute("tabindex")
			if (opener?.isConnected) opener.focus({ preventScroll: true })
		}
	}, [open, container, initialFocus])
}
