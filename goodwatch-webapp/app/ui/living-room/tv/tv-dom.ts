// What the TV's hook (use-tv.ts) reads from the page: the boxes of the items on show, for a direction move
// (tv-move.ts), and the row a focused item pages into view. The machine never measures; this is where it is done.
//
// The markup contract (kit.tsx): a screen and the menu are each a `[data-tv-layer]`, the focus moves inside the
// topmost one; an item is a `[data-tv-item="<id>"]`; a row that pages sideways is a `[data-tv-row]` whose items
// are its children.
import { ROOM_ID } from "../use-below-room"
import type { TvBox } from "./tv-move"

export const TV_LAYER_ATTR = "data-tv-layer"
export const TV_ITEM_ATTR = "data-tv-item"
export const TV_ROW_ATTR = "data-tv-row"
export const TV_CANVAS_ATTR = "data-tv-canvas"

/** How far from a row's edge a focused item stays, in TV canvas pixels, so the item before or after it shows. */
const ROW_MARGIN = 30

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

/**
 * Pages an item's row so the item is in view. The positions are the row's own (`offsetLeft`), so the canvas's
 * scale and the focused item's growth don't count.
 */
export function bringIntoView(item: HTMLElement, smooth: boolean) {
	const row = item.closest<HTMLElement>(`[${TV_ROW_ATTR}]`)
	if (!row || row.scrollWidth <= row.clientWidth) return
	const left = item.offsetLeft
	const right = left + item.offsetWidth
	const from = row.scrollLeft
	const to =
		left - ROW_MARGIN < from
			? left - ROW_MARGIN
			: right + ROW_MARGIN > from + row.clientWidth
				? right + ROW_MARGIN - row.clientWidth
				: from
	const target = Math.max(0, Math.min(to, row.scrollWidth - row.clientWidth))
	// "instant" also ends a smooth paging still on its way, so a measurement right after it sees the row at rest.
	row.scrollTo({ left: target, behavior: smooth ? "smooth" : "instant" })
}

/**
 * The boxes of the items of the topmost layer, on the window, with how many window pixels a canvas pixel is.
 * `focused` is brought into view first, so its row is where it will be.
 */
export function measureItems(focused: string): {
	boxes: TvBox[]
	scale: number
} {
	const layer = topLayer()
	if (!layer) return { boxes: [], scale: 1 }
	const at = itemElement(focused)
	if (at) bringIntoView(at, false)
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
