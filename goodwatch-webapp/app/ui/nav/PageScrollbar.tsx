import { useEffect } from "react"

// How close to the right edge the mouse must be, and how long the thumb stays lit after the mouse leaves.
const NEAR_PX = 56
const LEAVE_MS = 1000

/**
 * Lights up the page scrollbar's thumb while the mouse is near the right edge or drags the thumb: it sets
 * `data-scrollbar-near` on <html>, and main.css picks the brighter color. The browser still draws the scrollbar and
 * decides when it shows, so classic scrollbars stay visible and overlay scrollbars (Mac trackpads, phones) appear
 * only while scrolling. Touch and pen get the page colors only. See docs/research/scrollbar-ux.md.
 */
export function PageScrollbar() {
	useEffect(() => {
		if (!matchMedia("(pointer: fine)").matches) return
		const html = document.documentElement
		let near = false
		let dragging = false
		let off: ReturnType<typeof setTimeout> | undefined
		const update = () => {
			if (near || dragging) {
				clearTimeout(off)
				off = undefined
				html.setAttribute("data-scrollbar-near", "")
			} else if (!off && html.hasAttribute("data-scrollbar-near")) {
				off = setTimeout(() => {
					off = undefined
					html.removeAttribute("data-scrollbar-near")
				}, LEAVE_MS)
			}
		}
		const onMove = (e: PointerEvent) => {
			if (e.pointerType !== "mouse") return
			const next = window.innerWidth - e.clientX <= NEAR_PX
			if (next === near) return
			near = next
			update()
		}
		const onLeave = () => {
			near = false
			update()
		}
		// A press in the gutter is a press on the scrollbar itself.
		const onDown = (e: PointerEvent) => {
			if (e.pointerType !== "mouse" || e.clientX < html.clientWidth) return
			dragging = true
			update()
		}
		const onUp = () => {
			if (!dragging) return
			dragging = false
			update()
		}
		window.addEventListener("pointermove", onMove, { passive: true })
		window.addEventListener("pointerdown", onDown, { passive: true })
		window.addEventListener("pointerup", onUp, { passive: true })
		html.addEventListener("pointerleave", onLeave)
		return () => {
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("pointerup", onUp)
			html.removeEventListener("pointerleave", onLeave)
			clearTimeout(off)
			html.removeAttribute("data-scrollbar-near")
		}
	}, [])
	return null
}
