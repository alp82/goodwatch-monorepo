// Where the opener's stage goes and how it grows out of the trailer card (FLIP: transform and opacity only).

/** idle: the card. pre: the stage laid out over the card, not yet shown. opening/closing: growing/shrinking. */
export type Phase = "idle" | "pre" | "opening" | "open" | "closing"
export const EASE = "cubic-bezier(.2,.8,.2,1)"
export const MS = 520
/** The site header's height. */
const HEADER = 64

export const reducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Where the stage goes, relative to the band's wrapper, and how big. */
export interface Geo {
	top: number
	left: number
	/** The player at full size. */
	W: number
	H: number
	/** Height for the player plus an open list (the viewport under the header, less the deck and a margin). */
	room: number
	phone: boolean
	/** The wrapper's place on the page, for the dimming layer that spans the window. */
	wrapTop: number
	wrapLeft: number
	vw: number
	vh: number
}

/** The largest 16:9 player that fits the window under the site header with its deck below it, centered. */
export function measure(wrap: HTMLElement): Geo {
	const vw = document.documentElement.clientWidth
	const vh = window.innerHeight
	const phone = vw < 640
	const gapTop = phone ? 0 : 16
	const side = phone ? 0 : 32
	const deck = phone ? 52 : 60
	const bottom = phone ? 12 : 16
	const room = Math.max(160, vh - HEADER - gapTop - deck - bottom)
	const H = Math.floor(Math.min(room, ((vw - 2 * side) * 9) / 16))
	const W = Math.floor((H * 16) / 9)
	const r = wrap.getBoundingClientRect()
	const wrapTop = r.top + window.scrollY
	return {
		top: HEADER + gapTop - wrapTop,
		left: Math.round((vw - W) / 2 - r.left),
		W,
		H,
		room,
		phone,
		wrapTop,
		wrapLeft: r.left,
		vw,
		vh,
	}
}

/** The transform that puts the stage's player (at scale k) exactly over the card. */
export function fromCard(
	card: HTMLElement,
	wrap: HTMLElement,
	geo: Geo,
	k: number,
): string {
	const c = card.getBoundingClientRect()
	const w = wrap.getBoundingClientRect()
	const s = c.width / (geo.W * k)
	const tx = c.left - w.left - geo.left - (s * (1 - k) * geo.W) / 2
	const ty = c.top - w.top - geo.top
	return `translate(${tx}px, ${ty}px) scale(${s})`
}
