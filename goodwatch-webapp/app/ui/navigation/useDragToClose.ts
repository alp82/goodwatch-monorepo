// Drag down to close, for the phone sheets (the hub and the search drawer). A touch that starts where nothing inside
// the sheet is scrolled moves the sheet with the finger while it pulls down; letting go far enough, or with a flick,
// closes it, otherwise it springs back. A pull up, or a touch inside scrolled content, scrolls as usual.
import { useEffect, useRef, useState } from "react"

/** Pulling the sheet down this far closes it. */
const CLOSE_DISTANCE = 96
/** A flick this fast (px per ms) closes it from any distance. */
const CLOSE_VELOCITY = 0.6
/** A drag farther than this doesn't count as a tap on what it started on. */
const TAP_SLOP = 6
const EASE = "200ms ease-out"
// Tailwind v4 moves elements with `translate`; the sheet's own transition classes animate it and opacity.
const SETTLE = `transform ${EASE}, translate ${EASE}, opacity ${EASE}`

function scrolledWithin(target: EventTarget | null, panel: HTMLElement) {
	for (
		let element = target instanceof Element ? target : null;
		element && panel.contains(element);
		element = element.parentElement
	)
		if (element.scrollTop > 0) return true
	return false
}

/**
 * Returns the ref for the sheet's panel. A callback ref: the dialog mounts its panel in a portal, a render after it
 * opens.
 */
export function useDragToClose(onClose: () => void) {
	const [element, setElement] = useState<HTMLElement | null>(null)
	const close = useRef(onClose)
	close.current = onClose
	useEffect(() => {
		if (!element) return
		element.style.transform = ""
		element.style.transition = ""
		let tracking = false
		let dragging = false
		let startY = 0
		let lastY = 0
		let lastTime = 0
		let distance = 0
		let velocity = 0

		const onStart = (event: TouchEvent) => {
			tracking =
				event.touches.length === 1 && !scrolledWithin(event.target, element)
			dragging = false
			startY = lastY = event.touches[0].clientY
			lastTime = event.timeStamp
			distance = velocity = 0
		}
		const onMove = (event: TouchEvent) => {
			if (!tracking) return
			const y = event.touches[0].clientY
			distance = Math.max(0, y - startY)
			if (!dragging) {
				// A pull up scrolls the content; only a pull down moves the sheet.
				if (y < startY) tracking = false
				if (y <= startY) return
				dragging = true
				element.style.transition = "none"
			}
			event.preventDefault()
			velocity = (y - lastY) / Math.max(1, event.timeStamp - lastTime)
			lastY = y
			lastTime = event.timeStamp
			element.style.transform = `translateY(${distance}px)`
		}
		const onEnd = () => {
			tracking = false
			if (!dragging) return
			dragging = false
			element.style.transition = SETTLE
			if (distance > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
				element.style.transform = "translateY(100%)"
				close.current()
			} else element.style.transform = ""
			if (distance > TAP_SLOP) {
				const swallow = (click: MouseEvent) => {
					click.preventDefault()
					click.stopPropagation()
				}
				element.addEventListener("click", swallow, {
					capture: true,
					once: true,
				})
				setTimeout(
					() =>
						element.removeEventListener("click", swallow, { capture: true }),
					400,
				)
			}
		}

		element.addEventListener("touchstart", onStart, { passive: true })
		// Not passive: a pull down at the top must not scroll or bounce the content.
		element.addEventListener("touchmove", onMove, { passive: false })
		element.addEventListener("touchend", onEnd)
		element.addEventListener("touchcancel", onEnd)
		return () => {
			element.removeEventListener("touchstart", onStart)
			element.removeEventListener("touchmove", onMove)
			element.removeEventListener("touchend", onEnd)
			element.removeEventListener("touchcancel", onEnd)
		}
	}, [element])
	return setElement
}
