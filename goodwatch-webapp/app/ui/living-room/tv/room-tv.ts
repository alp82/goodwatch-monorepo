// SEAM between the room (slice 2) and the TV's machine (slice 1, tv-machine.ts) with its hook (slice 3,
// use-tv.ts). The room draws no TV screen and holds no TV state: it shows what `RoomTv` says and reports every
// key of the Remotes as a `RoomKey`. use-tv.ts turns a `RoomKey` into the machine's action (a `move` needs the
// measured boxes of the items, which the hook adds) and fills `RoomTv` from the machine's state. Until then
// room-stand-in.tsx plays that part on the preview address.
import type { RemoteServiceKey } from "../living-room-data"

export type RoomDirection = "up" | "down" | "left" | "right"

/** What a key of either Remote asks for. */
export type RoomKey =
	/** An arrow of the wheel. */
	| { type: "move"; dir: RoomDirection }
	/** Dragging around the desktop Remote's wheel, or scrolling over it: the next or previous item in reading order. */
	| { type: "step"; by: 1 | -1 }
	| { type: "ok" }
	| { type: "back" }
	| { type: "home" }
	| { type: "search" }
	| { type: "menu" }
	/** A streaming key, with the service's name as the catalog spells it. */
	| { type: "service"; service: string }
	/** The desktop Remote's power key, and any key of either Remote while the TV is dark (`on: true`). */
	| { type: "power"; on: boolean }

/** What the room shows of the TV's state, and where the Remotes' keys go. */
export type RoomTv = {
	power: "off" | "booting" | "on"
	menuOpen: boolean
	/** The search screen is showing: the Remotes' Search key is lit. */
	searching: boolean
	/** The service the lists are narrowed to, if any: its streaming key is lit. */
	activeService: string | null
	/** The service a streaming key stands for, as the catalog spells it. */
	serviceName: (key: RemoteServiceKey) => string
	press: (key: RoomKey) => void
}

/** The canvas the TV's screens are drawn on: the desktop's, or the phone's with as much height as its picture shows. */
export type TvCanvas = {
	edition: "desktop" | "phone"
	w: number
	h: number
	/** How large the canvas is shown: its type prints at this times its size. */
	scale: number
}
