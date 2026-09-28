// The desktop room's geometry: where the TV sits in the photo, where the hand holds the Remote, and how both are
// placed in a window of any size. Pure; the scene measures the window once per resize and calls `layoutRoom`.
import handAvif from "~/img/living-room/hand.avif"
import handWebp from "~/img/living-room/hand.webp"
import room1280Avif from "~/img/living-room/room-1280.avif"
import room1280Webp from "~/img/living-room/room-1280.webp"
import room1920Avif from "~/img/living-room/room-1920.avif"
import room1920Webp from "~/img/living-room/room-1920.webp"
import room2560Avif from "~/img/living-room/room-2560.avif"
import room2560Webp from "~/img/living-room/room-2560.webp"

/** The room photo in 1672 x 941 coordinates (the generation size); the files are larger, same aspect. */
export const ROOM = {
	w: 1672,
	h: 941,
	tv: { x: 531, y: 90, w: 611, h: 330 },
	alt: "A cozy living room at dusk: a teal wall, a paper lantern, a rust sofa, and a TV on a walnut sideboard",
	avif: `${room1280Avif} 1280w, ${room1920Avif} 1920w, ${room2560Avif} 2560w`,
	webp: `${room1280Webp} 1280w, ${room1920Webp} 1920w, ${room2560Webp} 2560w`,
	fallback: room1920Webp,
} as const

export const HAND_IMAGE = { avif: handAvif, webp: handWebp }

/** The TV screens are drawn on a fixed canvas that scales to cover the TV. */
export const TV_CANVAS = { w: 960, h: 528 } as const

/** The Remote's natural width. */
export const REMOTE_W = 312

/** The hand photo (1024 x 1536) and the placeholder the Remote replaces in it. */
export const HAND = { w: 1024, h: 1536, x: 321, y: 68, pw: 382, ph: 1060 }

/** In the hand the Remote is as long as the placeholder; the extra length is a plain grip with the logo. */
export const REMOTE_H = Math.round((REMOTE_W * HAND.ph) / HAND.pw)

/** The Remote leans back toward the screen, and turns at most this far toward what it points at. */
export const REMOTE_TILT_DEG = 12
export const REMOTE_TURN_MAX_DEG = 6

export type RoomLayout = {
	/** The photo's box in window pixels (it always covers the window). */
	photo: { left: number; top: number; width: number; height: number }
	/** The TV's box in window pixels. */
	tv: { left: number; top: number; width: number; height: number }
	/** The canvas scale that covers the TV. */
	canvasScale: number
	/** The Remote's box in window pixels at its scale, and the hand photo behind it. */
	remote: { left: number; top: number; scale: number }
	hand: { left: number; top: number; width: number; height: number }
}

/**
 * Places the room so the TV fills the upper middle, and the hand with the Remote centered below it. The Remote's
 * grip (about the bottom sixth) may run below the fold.
 */
export function layoutRoom(width: number, height: number): RoomLayout {
	const tvCenter = { x: width * 0.5, y: height * 0.235 }
	const aspect = ROOM.tv.w / ROOM.tv.h
	const tvWidth = Math.min(width * 0.8, height * 0.41 * aspect)
	const s = Math.max(tvWidth / ROOM.tv.w, width / ROOM.w, height / ROOM.h)
	const W = ROOM.w * s
	const H = ROOM.h * s
	const left = Math.min(
		0,
		Math.max(width - W, tvCenter.x - (ROOM.tv.x + ROOM.tv.w / 2) * s),
	)
	const top = Math.min(
		0,
		Math.max(height - H, tvCenter.y - (ROOM.tv.y + ROOM.tv.h / 2) * s),
	)
	const tv = {
		left: left + ROOM.tv.x * s,
		top: top + ROOM.tv.y * s,
		width: ROOM.tv.w * s,
		height: ROOM.tv.h * s,
	}

	const remoteTop = height * 0.47
	const scale = Math.min(
		1.1,
		(height - remoteTop) / (REMOTE_H * 0.83 * 0.97),
		(width * 0.3) / REMOTE_W,
	)
	const remote = {
		left: width / 2 - (REMOTE_W * scale) / 2,
		top: remoteTop,
		scale,
	}
	const k = (REMOTE_W * scale) / HAND.pw
	const hand = {
		left: (REMOTE_W * scale) / 2 - (HAND.x + HAND.pw / 2) * k,
		top: -HAND.y * k,
		width: HAND.w * k,
		height: HAND.h * k,
	}
	return {
		photo: { left, top, width: W, height: H },
		tv,
		canvasScale: Math.max(tv.width / TV_CANVAS.w, tv.height / TV_CANVAS.h),
		remote,
		hand,
	}
}

/**
 * The Remote's turn toward a point, in degrees: the angle from the Remote's bottom center to the point, clamped
 * to REMOTE_TURN_MAX_DEG either way.
 */
export function remoteTurnToward(
	layout: RoomLayout,
	point: { x: number; y: number },
): number {
	const pivot = {
		x: layout.remote.left + (REMOTE_W * layout.remote.scale) / 2,
		y: layout.remote.top + REMOTE_H * layout.remote.scale,
	}
	const deg = (Math.atan2(point.x - pivot.x, pivot.y - point.y) * 180) / Math.PI
	return Math.max(-REMOTE_TURN_MAX_DEG, Math.min(REMOTE_TURN_MAX_DEG, deg))
}
