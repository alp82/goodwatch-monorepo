// The geometry of How it works' TV corner and the camera push into it (HowItWorksCorner.tsx, IntroTheater.tsx).
// Pure numbers, so the corner's CSS and the push agree and both can be tested.
import { type Rect, quadBounds } from "../room/homography.ts"
import { TV_CORNER } from "../room/scene.ts"

export type { Rect }

/** Where the intro starts from: the TV on screen and the room around it, in viewport px. */
export type IntroFrom = {
	/** The TV screen's rectangle. */
	tvRect: Rect
	/** The corner's box, the room's crop. */
	roomRect: Rect
	/** The painting as drawn in that box (box px), and the file the browser chose for it. */
	image: {
		src: string
		left: number
		top: number
		width: number
		height: number
	}
}

/** The TV screen in the corner's painting, as fractions of its width and height. */
export const CORNER_TV = quadBounds(TV_CORNER.tv)

/** The crop is close enough that the TV is about a third of its width (never closer than 4×, never wider than cover). */
export const CORNER_ZOOM = Math.min(4, Math.max(1, 0.36 / CORNER_TV.width))

/** The point the crop keeps in the middle: the TV's center. */
export const CORNER_FOCUS = {
	x: CORNER_TV.left + CORNER_TV.width / 2,
	y: CORNER_TV.top + CORNER_TV.height / 2,
}

/**
 * How the painting sits in a w × h crop: it covers the box at CORNER_ZOOM, the TV in the middle, never leaving a gap
 * at an edge. The same rule as the corner's CSS (how-it-works.css), for checking it.
 */
export function cornerPlacement(w: number, h: number): Rect {
	const aspect = TV_CORNER.width / TV_CORNER.height
	const width = Math.max(w, h * aspect) * CORNER_ZOOM
	const height = width / aspect
	const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v))
	return {
		left: clamp(w / 2 - CORNER_FOCUS.x * width, w - width),
		top: clamp(h / 2 - CORNER_FOCUS.y * height, h - height),
		width,
		height,
	}
}

/** The TV screen's rectangle, given where the painting is drawn (any one coordinate space). */
export const tvRectIn = (image: Rect): Rect => ({
	left: image.left + CORNER_TV.left * image.width,
	top: image.top + CORNER_TV.top * image.height,
	width: CORNER_TV.width * image.width,
	height: CORNER_TV.height * image.height,
})

/** Where the push starts, from the corner's box and its painting as the browser drew them (viewport px). */
export function introFrom(box: Rect, image: Rect, src: string): IntroFrom {
	return {
		tvRect: tvRectIn(image),
		roomRect: box,
		image: {
			src,
			left: image.left - box.left,
			top: image.top - box.top,
			width: image.width,
			height: image.height,
		},
	}
}

/** The film's picture: as large as fits, between 16:9 and 1.85:1, centered in the given area. */
export function filmBox(area: Rect): Rect {
	const height = Math.min(area.height, (area.width * 9) / 16)
	const width = Math.min(area.width, height * 1.85)
	return {
		left: area.left + (area.width - width) / 2,
		top: area.top + (area.height - height) / 2,
		width,
		height,
	}
}

/**
 * The camera pushing into the room: transforms for the room's copy (fixed at `from.roomRect`, origin top-left) that
 * zoom about one fixed point until the TV covers `target`. The zoom is even in log scale, so it doesn't rush.
 */
export function pushFrames(
	from: IntroFrom,
	target: Rect,
	n = 20,
): { transform: string; offset: number }[] {
	const tv = from.tvRect
	const end =
		Math.max(
			target.width / Math.max(1, tv.width),
			target.height / Math.max(1, tv.height),
		) * 1.03
	const c0 = [tv.left + tv.width / 2, tv.top + tv.height / 2]
	const tc = [target.left + target.width / 2, target.top + target.height / 2]
	const L = [from.roomRect.left, from.roomRect.top]
	const near1 = Math.abs(1 - end) < 0.05
	// The fixed point: where the camera pushes in.
	const P = near1
		? c0
		: [(tc[0] - end * c0[0]) / (1 - end), (tc[1] - end * c0[1]) / (1 - end)]
	const frames: { transform: string; offset: number }[] = []
	for (let i = 0; i <= n; i++) {
		const t = i / n
		const s = Math.exp(Math.log(end) * t)
		const tx = near1 ? (tc[0] - c0[0]) * t : (1 - s) * (P[0] - L[0])
		const ty = near1 ? (tc[1] - c0[1]) * t : (1 - s) * (P[1] - L[1])
		frames.push({
			transform: `translate(${tx}px, ${ty}px) scale(${s})`,
			offset: t,
		})
	}
	return frames
}
