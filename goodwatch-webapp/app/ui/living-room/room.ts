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
import roomPhoneAvif from "~/img/living-room/room-phone.avif"
import roomPhoneWebp from "~/img/living-room/room-phone.webp"

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

// ---------------------------------------------------------------------------------------------------------
// Phones (#189, #224). Portrait is the couch: the portrait room with the TV on top and the Remote in the hand
// below it. Landscape is the whole desktop room with the TV centered on top and the Remote under it; dragging
// the Remote up reveals its feature and streaming keys.

/** The portrait room (the desktop room extended down over the viewer's lap), in 1068 x 1602 coordinates. */
export const PHONE_ROOM = {
	w: 1068,
	h: 1602,
	tv: { x: 229, y: 90, w: 611, h: 330 },
	alt: "The living room at dusk seen from the sofa, a caramel knit blanket over your lap, the TV on the teal wall",
	avif: roomPhoneAvif,
	webp: roomPhoneWebp,
} as const

/** The phone edition of the TV screens: a smaller canvas, so the type prints at a readable size. */
export const PHONE_TV_CANVAS = { w: 560, h: 308 } as const

/** How far down the Remote its streaming keys end, in Remote pixels. */
const REMOTE_KEYS_END = 700

export type PhoneOrientation = "portrait" | "landscape"

export type PhoneLayout = RoomLayout & {
	orientation: PhoneOrientation
	/** How far the Remote moves up to show all of its keys (landscape only, else 0). */
	lift: number
}

type Rect = { x: number; y: number; w: number; h: number }

/**
 * Places a room so its TV lands centered at `top` with width `tvWidth`. The photo covers the width only: covering
 * the height of a tall window made the TV wider than the window (#224). Below a short photo, the page fades.
 */
function placeRoom(
	room: { w: number; h: number; tv: Rect },
	width: number,
	height: number,
	want: { top: number; tvWidth: number },
) {
	const s = Math.max(want.tvWidth / room.tv.w, width / room.w)
	const W = room.w * s
	const H = room.h * s
	const left = Math.min(
		0,
		Math.max(width - W, width / 2 - (room.tv.x + room.tv.w / 2) * s),
	)
	const rawTop = want.top - room.tv.y * s
	const top = Math.min(0, H >= height ? Math.max(height - H, rawTop) : rawTop)
	return {
		photo: { left, top, width: W, height: H },
		tv: {
			left: left + room.tv.x * s,
			top: top + room.tv.y * s,
			width: room.tv.w * s,
			height: room.tv.h * s,
		},
	}
}

function handFor(scale: number) {
	const k = (REMOTE_W * scale) / HAND.pw
	return {
		left: (REMOTE_W * scale) / 2 - (HAND.x + HAND.pw / 2) * k,
		top: -HAND.y * k,
		width: HAND.w * k,
		height: HAND.h * k,
	}
}

function phoneCanvasScale(tv: { width: number; height: number }) {
	return Math.max(tv.width / PHONE_TV_CANVAS.w, tv.height / PHONE_TV_CANVAS.h)
}

/** The phone layouts: portrait `couch`, or the whole room sideways. */
export function layoutPhone(
	width: number,
	height: number,
	orientation: PhoneOrientation,
): PhoneLayout {
	if (orientation === "portrait") {
		const { photo, tv } = placeRoom(PHONE_ROOM, width, height, {
			top: Math.max(14, height * 0.035),
			tvWidth: width * 0.92,
		})
		// Under the TV, over the coffee table and the blanket; the streaming keys stay on screen and the grip runs
		// off the bottom under the hand.
		const remoteTop = tv.top + tv.height + Math.max(26, height * 0.05)
		const scale = Math.max(
			0.3,
			Math.min(
				(width * 0.66) / REMOTE_W,
				(height - remoteTop - 10) / REMOTE_KEYS_END,
				1,
			),
		)
		return {
			orientation,
			photo,
			tv,
			canvasScale: phoneCanvasScale(tv),
			remote: {
				left: width / 2 - (REMOTE_W * scale) / 2,
				top: remoteTop,
				scale,
			},
			hand: handFor(scale),
			lift: 0,
		}
	}
	// Landscape: the TV centered on top at about 44% of the height, the Remote centered under it. Tipped back,
	// the Remote's top looks lower than it is, so it starts a little higher.
	const tvHeight = height * 0.44
	const { photo, tv } = placeRoom(ROOM, width, height, {
		top: height * 0.04,
		tvWidth: Math.min(width * 0.7, (tvHeight * ROOM.tv.w) / ROOM.tv.h),
	})
	const scale = Math.min(height / 760, 0.6)
	const remoteTop = tv.top + tv.height - 22
	return {
		orientation,
		photo,
		tv,
		canvasScale: phoneCanvasScale(tv),
		remote: {
			left: width / 2 - (REMOTE_W * scale) / 2,
			top: remoteTop,
			scale,
		},
		hand: handFor(scale),
		lift: Math.max(0, remoteTop + REMOTE_KEYS_END * scale - height + 8),
	}
}

/**
 * On a phone the Remote turns only a quarter of the way toward a tapped point, at most REMOTE_TURN_MAX_DEG
 * (#189), measured from the top of the Remote.
 */
export function phoneRemoteTurnToward(
	layout: RoomLayout,
	point: { x: number; y: number },
	lifted = 0,
): number {
	const tip = {
		x: layout.remote.left + (REMOTE_W * layout.remote.scale) / 2,
		y: layout.remote.top + lifted + 14 * layout.remote.scale,
	}
	const deg =
		((Math.atan2(point.x - tip.x, tip.y - point.y) * 180) / Math.PI) * 0.25
	return Math.max(-REMOTE_TURN_MAX_DEG, Math.min(REMOTE_TURN_MAX_DEG, deg))
}
