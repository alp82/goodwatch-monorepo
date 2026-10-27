// PROTOTYPE (start page lab): per-room shelf state shared by a shelf variant's Slot and Overlay (which slot is lifted,
// pulled out, or matched by a rail card). Keyed by the room element (`[data-lab-room]`), so two rooms on one page don't
// share it.
import { type RefObject, useEffect, useState, useSyncExternalStore } from "react"

export type ShelfState = {
	/** The lifted slot (mouse hover or a first tap). */
	lift: number | null
	/** Set by a tap (not a hover): the caption stays until a tap elsewhere. */
	pinned: boolean
	/** The slot pulled off the shelf (d), and whether it is on its way out, out, or going back. */
	pulled: number | null
	phase: "out" | "back" | null
	/** An overlay of this room handles taps (d falls back to plain links without one). */
	overlay: boolean
}

const EMPTY: ShelfState = { lift: null, pinned: false, pulled: null, phase: null, overlay: false }
const states = new Map<Element, ShelfState>()
const listeners = new Set<() => void>()

export function getShelf(room: Element | null): ShelfState {
	return (room && states.get(room)) || EMPTY
}

export function setShelf(room: Element | null, patch: Partial<ShelfState>) {
	if (!room) return
	states.set(room, { ...getShelf(room), ...patch })
	for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => listeners.delete(l)
}

export function useShelf(room: Element | null): ShelfState {
	return useSyncExternalStore(
		subscribe,
		() => getShelf(room),
		() => EMPTY,
	)
}

/** The room element around `ref`, after mount. */
export function useRoomEl(ref: RefObject<HTMLElement | null>): Element | null {
	const [room, setRoom] = useState<Element | null>(null)
	useEffect(() => {
		setRoom(ref.current?.closest("[data-lab-room]") ?? null)
	}, [ref])
	return room
}

/** Whether the pointer is a mouse (hover lifts) rather than a finger (first tap lifts). */
export const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
