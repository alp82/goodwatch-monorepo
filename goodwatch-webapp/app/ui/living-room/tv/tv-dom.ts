// What the TV's hook (use-tv.ts) reads from the page: the boxes of the items on show, for a direction move
// (tv-move.ts), and the row a focused item pages into view. The machine never measures; this is where it is done.
//
// The markup contract (kit.tsx): a screen and the menu are each a `[data-tv-layer]`, the focus moves inside the
// topmost one; an item is a `[data-tv-item="<id>"]`; a row that pages sideways is a `[data-tv-row]` whose items
// are its children; the line a screen takes typing on is a `[data-tv-input]`.
import { ROOM_ID } from "../use-below-room"
import type { TvBox } from "./tv-move"

export const TV_LAYER_ATTR = "data-tv-layer"
export const TV_ITEM_ATTR = "data-tv-item"
export const TV_ROW_ATTR = "data-tv-row"
export const TV_CANVAS_ATTR = "data-tv-canvas"
/** The line a screen takes typing on: the search screen's (screens/Search.tsx). It is not an item. */
export const TV_INPUT_ATTR = "data-tv-input"

/** How far from a row's edge a focused item stays, in TV canvas pixels, so the item before or after it shows. */
const ROW_MARGIN = 30
const rowMotion = new WeakMap<HTMLElement, number>()

export function restoreRowPosition(row: HTMLElement, left: number) {
	const pending = rowMotion.get(row)
	if (pending !== undefined) cancelAnimationFrame(pending)
	rowMotion.delete(row)
	row.scrollTo({ left, behavior: "instant" })
}

/** The room: its TV is the one the keys drive. */
export const roomElement = () => document.getElementById(ROOM_ID)

/** The topmost layer of the TV in the room: the menu while it is open, else the screen. */
function topLayer(): HTMLElement | null {
	const layers = roomElement()?.querySelectorAll<HTMLElement>(
		`[${TV_LAYER_ATTR}]`,
	)
	return layers?.[layers.length - 1] ?? null
}

/** The element of an item on show, or null. */
export function itemElement(id: string): HTMLElement | null {
	return (
		topLayer()?.querySelector<HTMLElement>(
			`[${TV_ITEM_ATTR}="${CSS.escape(id)}"]`,
		) ?? null
	)
}

/** The line the screen on show takes typing on, or null: no screen under the open menu has one. */
export function inputElement(): HTMLInputElement | null {
	return (
		topLayer()?.querySelector<HTMLInputElement>(`[${TV_INPUT_ATTR}]`) ?? null
	)
}

/**
 * Pages an item's row so the item is in view. The positions are the row's own (`offsetLeft`), so the canvas's
 * scale and the focused item's growth don't count.
 */
export function bringIntoView(item: HTMLElement, smooth: boolean) {
	const vertical = item.closest<HTMLElement>("[data-tv-scroll]")
	if (vertical && vertical.scrollHeight > vertical.clientHeight) {
		const viewport = vertical.getBoundingClientRect()
		const box = item.getBoundingClientRect()
		const scale = viewport.height / vertical.clientHeight
		const delta =
			box.top < viewport.top
				? box.top - viewport.top
				: box.bottom > viewport.bottom
					? box.bottom - viewport.bottom
					: 0
		if (delta)
			vertical.scrollTo({
				top: vertical.scrollTop + delta / scale,
				behavior: "instant",
			})
	}
	const row = item.closest<HTMLElement>(`[${TV_ROW_ATTR}]`)
	if (!row || row.scrollWidth <= row.clientWidth) return
	const left = item.offsetLeft
	const right = left + item.offsetWidth
	// Reserve the next poster, rather than waiting for the current one to reach the rim.
	const margin = Math.max(
		ROW_MARGIN,
		Math.min(row.clientWidth * 0.28, (row.clientWidth - item.offsetWidth) / 2),
	)
	const from = row.scrollLeft
	const to =
		left - margin < from
			? left - margin
			: right + margin > from + row.clientWidth
				? right + margin - row.clientWidth
				: from
	const target = Math.max(0, Math.min(to, row.scrollWidth - row.clientWidth))
	const pending = rowMotion.get(row)
	if (pending !== undefined) cancelAnimationFrame(pending)
	if (!smooth || Math.abs(target - from) < 1) {
		row.scrollTo({ left: target, behavior: "instant" })
		rowMotion.delete(row)
		return
	}
	// Native smooth-scroll duration grows with distance and restarts under held arrows. Finish each move in a
	// bounded 120 ms; a new focus retargets from the current position, never queues another page of motion.
	const started = performance.now()
	const tick = (now: number) => {
		const p = Math.min(1, (now - started) / 120)
		row.scrollLeft = from + (target - from) * (1 - (1 - p) ** 3)
		if (p < 1 && row.isConnected)
			rowMotion.set(row, requestAnimationFrame(tick))
		else rowMotion.delete(row)
	}
	rowMotion.set(row, requestAnimationFrame(tick))
}

/**
 * The boxes of the items of the topmost layer, on the window, with how many window pixels a canvas pixel is.
 * Read the current geometry without cancelling the row's in-flight motion.
 */
export function measureItems(_focused: string): {
	boxes: TvBox[]
	scale: number
} {
	const layer = topLayer()
	if (!layer) return { boxes: [], scale: 1 }
	const canvas = layer.closest<HTMLElement>(`[${TV_CANVAS_ATTR}]`)
	const scale =
		canvas && canvas.offsetWidth > 0
			? canvas.getBoundingClientRect().width / canvas.offsetWidth
			: 1
	const boxes = Array.from(
		layer.querySelectorAll<HTMLElement>(`[${TV_ITEM_ATTR}]`),
		(el) => {
			const { left, top, width, height } = el.getBoundingClientRect()
			return {
				id: el.getAttribute(TV_ITEM_ATTR) as string,
				left,
				top,
				width,
				height,
			}
		},
	)
	return { boxes, scale }
}
