// PROTOTYPE - throwaway. The old living room's geometry (ui/living-room/room.ts before the new TV replaced it), kept
// for the rooms of /prototype/watching, /prototype/watching-2, /prototype/watching-3 and /prototype/new-episodes,
// which frame their home variants in the old scene. The pictures and the Remote's numbers stay in room.ts.
import { useEffect, useLayoutEffect, useState } from "react"
import { HAND, PHONE_ROOM, REMOTE_H, REMOTE_W, ROOM } from "~/ui/living-room/room"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const PORTRAIT = "(max-width: 767px)"
const LANDSCAPE = "(orientation: landscape) and (max-height: 540px)"

/** Which phone layout the window wants: portrait when narrow, landscape when short and wide, else none. */
export function usePhoneOrientation(): PhoneOrientation | null {
	const [orientation, setOrientation] = useState<PhoneOrientation | null>(null)
	useIsoLayoutEffect(() => {
		const portrait = window.matchMedia(PORTRAIT)
		const landscape = window.matchMedia(LANDSCAPE)
		const update = () => setOrientation(portrait.matches ? "portrait" : landscape.matches ? "landscape" : null)
		update()
		portrait.addEventListener("change", update)
		landscape.addEventListener("change", update)
		return () => {
			portrait.removeEventListener("change", update)
			landscape.removeEventListener("change", update)
		}
	}, [])
	return orientation
}

/** The TV screens are drawn on a fixed canvas that scales to cover the TV. */
export const TV_CANVAS = { w: 960, h: 528 } as const

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

/** The phone edition of the TV screens: a smaller canvas, so the type prints at a readable size. */
export const PHONE_TV_CANVAS = { w: 560, h: 308 } as const

/** How far down the Remote its streaming keys end, in Remote pixels. living-room.css has the same number. */
const REMOTE_KEYS_END = 530

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
	/** Pixels at the bottom of a portrait window that the Remote's keys stay out of (the lip, #352). */
	reserve = 0,
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
				(height - reserve - remoteTop - 10) / REMOTE_KEYS_END,
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
