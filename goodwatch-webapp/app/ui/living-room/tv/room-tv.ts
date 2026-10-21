// The seam between the room (TvRoom.tsx) and the TV's machine (tv-machine.ts) with its hook (use-tv.ts). The room
// draws no TV screen and holds no TV state: it shows what `RoomTv` says and reports every key of the Remotes as a
// `RoomKey`. use-tv.ts turns a `RoomKey` into the machine's action (a `move` needs the measured boxes of the
// items, which the hook adds) and fills `RoomTv` from the machine's state.
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
	/** A streaming key, with its service's TMDB provider id. */
	| { type: "service"; service: number }
	/** The desktop Remote's power key, and any key of either Remote while the TV is dark (`on: true`). */
	| { type: "power"; on: boolean }

/** What the room shows of the TV's state, and where the Remotes' keys go. */
export type RoomTv = {
	power: "off" | "booting" | "on"
	/** The Expand key has the focus: brackets come out to the picture's corners (the picture keeps its size). */
	framed?: boolean
	menuOpen: boolean
	/** The search screen is showing: the Remotes' Search key is lit. */
	searching: boolean
	/** The service whose screen ("On <service>") is showing, by its TMDB provider id: its streaming key is lit. */
	openService: number | null
	press: (key: RoomKey) => void
	/** Pointing at an item of the TV's screen gives it the focus (pointing.ts): a finger has no hover to do it. */
	point: (item: string) => void
}

/** The canvas the TV's screens are drawn on: the desktop's, or the phone's with as much height as its picture shows. */
export type TvCanvas = {
	edition: "desktop" | "phone"
	w: number
	h: number
	/** How large the canvas is shown: its type prints at this times its size. */
	scale: number
	/**
	 * Drawn before the window is measured, on the server and while the page hydrates: both editions are in the
	 * HTML then and CSS shows the one that fits the window (living-room.css, `tvr-first`). The scale is not known yet.
	 */
	first?: boolean
}

/** The keyboard's keys for the Remote's. */
const KEYS: Record<string, RoomKey> = {
	ArrowUp: { type: "move", dir: "up" },
	ArrowDown: { type: "move", dir: "down" },
	ArrowLeft: { type: "move", dir: "left" },
	ArrowRight: { type: "move", dir: "right" },
	Enter: { type: "ok" },
	Escape: { type: "back" },
	Backspace: { type: "back" },
	h: { type: "home" },
	H: { type: "home" },
	m: { type: "menu" },
	M: { type: "menu" },
	s: { type: "search" },
	S: { type: "search" },
}

/**
 * The Remote's key a keyboard's keydown presses, "held" for a held Enter's repeat, or null for a key the TV
 * doesn't take. A held OK presses once: its repeats would choose again on what the first press brought, such as
 * the next title of the taste quiz (ui/scoring/score-ack.ts). The arrows repeat while held.
 */
export function keyboardKey(press: { key: string; repeat: boolean }): RoomKey | "held" | null {
	const key = KEYS[press.key] ?? null
	return key?.type === "ok" && press.repeat ? "held" : key
}
