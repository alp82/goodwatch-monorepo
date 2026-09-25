// Drag and drop for the share list editor, on pointer events so it works with a mouse and with touch.
// Touch starts a drag on a long press, so a normal swipe still scrolls; a mouse starts after a few pixels.
// Drop targets are found by hit-testing: a rank on the card ([data-card-preview] [data-slot]) or a gap in the
// ranking ([data-droplist] with [data-row] children). Near the top or bottom edge of a [data-drag-scroll] container,
// the container scrolls, so a title can travel to a target that's scrolled out of view.
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react"
import type { CardTitle } from "~/ui/share-card/model"

export type DropTarget =
	| { kind: "list"; index: number }
	| { kind: "slot"; index: number }
export type DragPayload = { item: CardTitle; from: number | null }
export type DragState = {
	payload: DragPayload
	x: number
	y: number
	over: DropTarget | null
}

const LONG_PRESS_MS = 220
const MOUSE_THRESHOLD_PX = 6
const EDGE_PX = 64
const MAX_SCROLL_PX = 18

// Which container to scroll this frame, and by how much: faster the closer the pointer is to the edge. Containers
// nest (the results grid sits inside the back panel), so the innermost one that can still move that way wins.
function edgeScroll(
	x: number,
	y: number,
): { el: HTMLElement; dy: number } | null {
	let el =
		(
			document.elementFromPoint(x, y) as HTMLElement | null
		)?.closest<HTMLElement>("[data-drag-scroll]") ?? null
	while (el) {
		const box = el.getBoundingClientRect()
		if (y < box.top + EDGE_PX && el.scrollTop > 0)
			return {
				el,
				dy: -MAX_SCROLL_PX * (1 - Math.max(0, y - box.top) / EDGE_PX),
			}
		if (
			y > box.bottom - EDGE_PX &&
			el.scrollTop + el.clientHeight < el.scrollHeight - 1
		)
			return {
				el,
				dy: MAX_SCROLL_PX * (1 - Math.max(0, box.bottom - y) / EDGE_PX),
			}
		el = el.parentElement?.closest<HTMLElement>("[data-drag-scroll]") ?? null
	}
	return null
}

function hitTest(x: number, y: number): DropTarget | null {
	const el = document.elementFromPoint(x, y) as HTMLElement | null
	const slot = el?.closest<HTMLElement>("[data-card-preview] [data-slot]")
	if (slot) return { kind: "slot", index: Number(slot.dataset.slot) }
	const list = el?.closest<HTMLElement>("[data-droplist]")
	if (!list) return null
	const rows = [...list.querySelectorAll<HTMLElement>("[data-row]")]
	return {
		kind: "list",
		index: rows.filter(
			(r) => r.getBoundingClientRect().top + r.offsetHeight / 2 < y,
		).length,
	}
}

export function useDragAndDrop(
	onDrop: (payload: DragPayload, target: DropTarget) => void,
) {
	const [drag, setDrag] = useState<DragState | null>(null)
	const dropRef = useRef(onDrop)
	dropRef.current = onDrop

	const start = (e: ReactPointerEvent, payload: DragPayload) => {
		if (e.button !== 0) return
		const touch = e.pointerType !== "mouse"
		// A mouse press would otherwise start a text selection that follows the drag. Touch keeps its default, so a
		// swipe still scrolls.
		if (!touch) e.preventDefault()
		const startX = e.clientX
		const startY = e.clientY
		let x = startX
		let y = startY
		let live = false
		let over: DropTarget | null = null
		let frame = 0
		const scrollLoop = () => {
			const scroll = edgeScroll(x, y)
			if (scroll) {
				scroll.el.scrollBy(0, scroll.dy)
				over = hitTest(x, y)
				setDrag({ payload, x, y, over })
			}
			frame = requestAnimationFrame(scrollLoop)
		}

		const begin = () => {
			live = true
			over = hitTest(x, y)
			setDrag({ payload, x, y, over })
			navigator.vibrate?.(10)
			frame = requestAnimationFrame(scrollLoop)
		}
		const timer = touch ? setTimeout(begin, LONG_PRESS_MS) : undefined
		const move = (ev: PointerEvent) => {
			x = ev.clientX
			y = ev.clientY
			if (!live) {
				if (Math.hypot(x - startX, y - startY) < MOUSE_THRESHOLD_PX) return
				// On touch, moving before the long press is a scroll, not a drag.
				if (touch) return end()
				begin()
			}
			over = hitTest(x, y)
			setDrag({ payload, x, y, over })
		}
		const blockScroll = (ev: TouchEvent) => {
			if (live) ev.preventDefault()
		}
		const up = () => {
			if (live) {
				// Swallow the click that follows a drop, so it doesn't open a dialog.
				const swallow = (c: MouseEvent) => c.stopPropagation()
				window.addEventListener("click", swallow, { capture: true, once: true })
				setTimeout(() => window.removeEventListener("click", swallow, true), 50)
				if (over) dropRef.current(payload, over)
			}
			end()
		}
		const end = () => {
			clearTimeout(timer)
			cancelAnimationFrame(frame)
			setDrag(null)
			document.body.style.userSelect = ""
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", up)
			window.removeEventListener("pointercancel", end)
			window.removeEventListener("touchmove", blockScroll)
		}
		document.body.style.userSelect = "none"
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", up)
		window.addEventListener("pointercancel", end)
		window.addEventListener("touchmove", blockScroll, { passive: false })
	}

	return { drag, start }
}
export type DragAndDrop = ReturnType<typeof useDragAndDrop>
