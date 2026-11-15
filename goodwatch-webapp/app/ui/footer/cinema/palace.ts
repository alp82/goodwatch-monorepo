// The footer cinema's room and its geometry. The show plays in a movie palace (gold proscenium, red curtains, wall
// lamps, an audience in silhouette) with a 35mm projector in the footer's bottom-right corner. Everything sits on one
// pixel grid of S CSS px per pixel, with S chosen so that the screen is exactly 222 x 120 pixels, and anchored to the
// footer's top-left corner, so the idle projector in the footer and the running one in the show land on the same pixels.

/** The screen in pixels (1.85:1). */
export const SCREEN = { w: 222, h: 120 } as const

/** The effects the room, the beam, the film look and the projector use, by pixelfx id. */
export const ROOM_FX = "cinema-show/room-palace"
export const BEAM_FX = "cinema-show/beam"
export const FILM_GATE_FX = "cinema-show/film-gate"
export const PROJECTOR_FX = "cinema-show/projector-35mm"

/** The house lights: the color the page fades to, and how far. */
export const HOUSE = { color: "#0b0507", opacity: 0.95 }
/** Smoke in the beam, 0..1. */
export const HAZE = 0.8

/** The lens, in pixels from the footer's bottom-right corner (above the phone dock on phones). */
const LENS = { x: 62, y: 26 }
const LENS_PHONE = { x: 52, y: 22 }

const isPhone = (vw: number) => vw < 640

/** The screen's CSS width and top in a window of vw x vh. */
export function screenFor(vw: number, vh: number) {
	if (isPhone(vw)) return { width: vw - 24, top: Math.round(vh * 0.2) }
	return {
		width: Math.min(vw * 0.55, vh * 0.43 * (SCREEN.w / SCREEN.h), 1000),
		top: Math.round(vh * 0.25),
	}
}

/** CSS px per pixel in a window of vw x vh. */
export function scaleFor(vw: number, vh: number) {
	return screenFor(vw, vh).width / SCREEN.w
}

/**
 * The lens in footer pixels (from the footer's top-left), for a footer of `footerWidth` x `footerHeight` CSS px whose
 * bottom `dock` CSS px the phone dock covers.
 */
export function lensInFooter(
	S: number,
	footerWidth: number,
	footerHeight: number,
	dock: number,
	vw: number,
) {
	const W = Math.floor(footerWidth / S)
	const bottom = Math.floor((footerHeight - dock) / S)
	const at = isPhone(vw) ? LENS_PHONE : LENS
	return { x: W - at.x, y: bottom - at.y }
}

/** How much of the footer's bottom the phone dock covers, in CSS px (the footer marks that spacer). */
export function dockHeight(footer: HTMLElement) {
	return (
		footer.querySelector<HTMLElement>("[data-footer-dock]")?.offsetHeight ?? 0
	)
}
