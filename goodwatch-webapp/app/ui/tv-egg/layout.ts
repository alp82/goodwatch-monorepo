// Where the little living room's parts sit in a scene of any size: the room photo, the TV on it, and the Remote in
// the hand under it. Pure, so the tests run it as it is. The numbers of the photos, the hand and the Remote are the
// start page's old living room's (ui/living-room/tv/room-layout.ts).
import {
	HAND,
	PHONE_BELOW,
	PHONE_ROOM_PHOTO,
	REMOTE_H,
	REMOTE_W,
	ROOM_PHOTO,
} from "../living-room/tv/room-layout.ts"

export type Box = { left: number; top: number; width: number; height: number }

export type EggLayout = {
	photo: Box
	tv: Box
	/** The Remote's box at its natural size (REMOTE_W x REMOTE_H) is scaled by `scale` from its top left. */
	remote: { left: number; top: number; scale: number }
	/** The hand photo, relative to the Remote's box. */
	hand: Box
	phone: boolean
	/** The scene's height: the window's, or taller where the TV and the Remote's keys don't both fit (the page then
	 *  scrolls to the Remote, as on a phone held sideways). */
	height: number
}

/** Under this width the site's bottom bar (MobileDock, `lg:hidden`) covers the scene's foot by DOCK_H. */
export const DOCK_BELOW = 1024
export const DOCK_H = 84
/** The Remote's streaming keys end this far down its body: they stay above the fold and the bottom bar. */
const KEYS_END = 530
/** Under the Remote's grip, in scene pixels. */
const FOOT = 8
/** The Remote's top reaches this far over the picture's bottom edge, as on the old start page. */
const OVER_TV = 18

/** The hand that holds a Remote drawn at `scale`, in the Remote's box. */
export function handFor(scale: number): Box {
	const k = (REMOTE_W * scale) / HAND.pw
	return {
		left: (REMOTE_W * scale) / 2 - (HAND.x + HAND.pw / 2) * k,
		// The Remote's end lies in the palm, where the hand photo's placeholder ends.
		top: REMOTE_H * scale - (HAND.y + HAND.ph) * k,
		width: HAND.w * k,
		height: HAND.h * k,
	}
}

/**
 * The room for a scene of `w` x `h` (the window under the site's header).
 * - Desktop: the Remote is sized first (the owner: a big Remote), then the TV, small enough that the room shows
 *   around it (the owner: "I want to see more of the room") but never so small that the photo, which scales with
 *   the TV, stops covering the scene.
 * - Phone, or any window taller than wide: the portrait room covers the scene from the top; the Remote rises from
 *   the foot, its keys above the bottom bar.
 */
export function layoutEgg(w: number, h: number): EggLayout {
	const dock = w < DOCK_BELOW ? DOCK_H : 0
	// A tall window (a tablet held upright) takes the portrait room like a phone: the wide photo would need a TV
	// almost as wide as the window to cover it.
	if (w >= PHONE_BELOW && h <= w) {
		const P = ROOM_PHOTO
		const top = Math.max(16, h * 0.06)
		const scale = Math.max(0.55, Math.min(0.8, (h - dock) / 1150))
		const shown = dock ? KEYS_END * scale : REMOTE_H * scale
		const aspect = P.tv.w / P.tv.h
		const want = Math.min(w * 0.4, h * 0.36 * aspect, Math.max(200, h - dock - top - FOOT - shown + OVER_TV) * aspect)
		const s = Math.max(want / P.tv.w, w / (P.w - 2), (h - top) / (P.h - P.tv.y - 2), top / P.tv.y)
		const tv = { left: (w - P.tv.w * s) / 2, top, width: P.tv.w * s, height: P.tv.h * s }
		// Under the TV at the latest, where the window is too short to hold both.
		const remoteTop = Math.max(h - dock - FOOT - shown, tv.top + tv.height - OVER_TV)
		return {
			photo: { left: tv.left - P.tv.x * s, top: tv.top - P.tv.y * s, width: P.w * s, height: P.h * s },
			tv,
			remote: { left: w / 2 - (REMOTE_W * scale) / 2, top: remoteTop, scale },
			hand: handFor(scale),
			phone: false,
			height: Math.max(h, remoteTop + shown + FOOT + dock),
		}
	}
	const P = PHONE_ROOM_PHOTO
	const c = Math.max(w / P.w, h / P.h)
	const photo = { left: (w - P.w * c) / 2, top: 0, width: P.w * c, height: P.h * c }
	const tv = { left: photo.left + P.tv.x * c, top: P.tv.y * c, width: P.tv.w * c, height: P.tv.h * c }
	const scale = Math.min(0.72, (w * 0.56) / REMOTE_W)
	const remote = {
		left: w / 2 - (REMOTE_W * scale) / 2,
		top: Math.max(tv.top + tv.height + 24, h - dock - FOOT - KEYS_END * scale),
		scale,
	}
	return {
		photo,
		tv,
		remote,
		hand: handFor(scale),
		phone: true,
		height: Math.max(h, remote.top + KEYS_END * scale + FOOT + dock),
	}
}
