// The new room's geometry (the TV revamp, docs/implementation/tv-screen-revamp): where the TV, the Remote and
// the room photo sit in a scene of any size. Pure, and free of imports so the tests run it as it is; the scene
// measures itself once per resize and calls `layoutRoom` or, under PHONE_BELOW of width, `layoutPhoneRoom`.
//
// The numbers of the photos, the hand and the Remote are room.ts's (ROOM, PHONE_ROOM, HAND, REMOTE_W, REMOTE_H);
// room-render.test-support.tsx checks that they still agree.

export type Rect = { left: number; top: number; width: number; height: number }

/** The room photo in 1672 x 941 coordinates, and its TV. */
export const ROOM_PHOTO = {
	w: 1672,
	h: 941,
	tv: { x: 531, y: 90, w: 611, h: 330 },
} as const

/** The portrait room photo in 1068 x 1602 coordinates, and its TV. */
export const PHONE_ROOM_PHOTO = {
	w: 1068,
	h: 1602,
	tv: { x: 229, y: 90, w: 611, h: 330 },
} as const

/**
 * The Remote in its own pixels: as long as its keys and a short grip with the mark (the owner, 2026-10-22: a
 * natural remote, no long empty body). Its end lies in the hand's palm (`HAND`).
 */
export const REMOTE_W = 312
export const REMOTE_H = 610

/** The hand photo (1024 x 1536) and the placeholder the Remote replaces in it. */
export const HAND = {
	w: 1024,
	h: 1536,
	x: 321,
	y: 68,
	pw: 382,
	ph: 1060,
} as const

/** The TV screens are drawn on a fixed canvas that scales to cover the TV. */
export const TV_CANVAS = { w: 1200, h: 648 } as const

/** The phone's canvas: one fixed 16:9 screen, drawn at the scale of the phone's TV. */
export const PHONE_TV_CANVAS = { w: 480, h: 270 } as const

/** A scene narrower than this is the phone's room. */
export const PHONE_BELOW = 768

/**
 * The Remote in the hand at rest: it leans back toward the screen, about the wrist. The wrist is 62% down the
 * Remote's box, just under the streaming keys, so they hardly move when the Remote aims (pointing, slice 4).
 */
export const REMOTE_WRIST = 0.62
export const REMOTE_TILT_DEG = 12
export const REMOTE_PERSPECTIVE = 1400
export const REMOTE_REST_TRANSFORM = `perspective(${REMOTE_PERSPECTIVE}px) rotateX(${REMOTE_TILT_DEG}deg)`

// ---------------------------------------------------------------------------------------------------------
// The desktop

/** Under the TV it shows whole: its streaming keys end at 522, its grip with the mark at REMOTE_H. */
const REMOTE_SHOWN_UNDER = REMOTE_H
/**
 * Under the TV the Remote's top reaches this far over the picture, in screen pixels: over the margin every
 * screen keeps free at its bottom edge, so it covers no type and no focus target.
 */
const REMOTE_OVER_TV = 18
/** The Remote's scale where the height leaves it free to choose: its size for a scene of that height. */
const remoteScaleFor = (h: number) => Math.max(0.5, Math.min(0.68, h / 1800))
/** Under the TV the Remote may shrink this far before it moves under the fold; smaller, its wheel stops being a control. */
const REMOTE_MIN_UNDER = 0.46
/** Under the Remote's streaming keys and fingertips, in scene pixels: room for the lip's tab beside it. */
const REMOTE_FOOT = 8
/** Type of 20 canvas pixels prints at 18 once the TV shows its canvas at 0.9. */
export const TV_MIN_WIDTH = TV_CANVAS.w * 0.9

/** Where the desktop's Remote is: under the TV, always (the owner, 2026-10-21: no Remote beside a smaller TV). */
export type RemotePlace = "below"

export type RoomLayout = {
	place: RemotePlace
	/** The TV's picture in scene pixels. */
	tv: Rect
	/** The photo's box: scaled so its TV sits exactly where ours is. */
	photo: Rect
	/** The canvas inside the TV: its scale, and its offset so it covers the TV from the middle. */
	canvas: { w: number; h: number; scale: number; x: number; y: number }
	/** The Remote's box in scene pixels at its scale. */
	remote: { left: number; top: number; scale: number }
	/** The hand photo, relative to the Remote's box. */
	hand: Rect
	/**
	 * How tall the room's content is: the scene's height, or more where the TV at the scene's width and the
	 * Remote under it don't both fit. The room then scrolls to the Remote (TvRoom.tsx).
	 */
	height: number
}

function canvasIn(tv: Rect, canvas: { w: number; h: number }) {
	const scale = Math.max(tv.width / canvas.w, tv.height / canvas.h)
	return {
		...canvas,
		scale,
		x: (tv.width - canvas.w * scale) / 2,
		y: (tv.height - canvas.h * scale) / 2,
	}
}

/**
 * The desktop room, in a scene of `w` x `h` (the window without the site's header, and without a scrollbar's
 * gutter): the TV at the top, as wide as the scene but for its margins, and the Remote centred under it, in the
 * hand, free to swing toward the cursor. At every size (the owner, 2026-10-21: only full-width TVs, with the
 * Remote centred).
 * - The TV's height follows from its width: in a wide, short window it is taller than the scene, and the room
 *   scrolls to its bottom and to the Remote.
 * - Where the height leaves room, the Remote shows down to its streaming keys inside the scene, at the size the
 *   height suggests or smaller, down to REMOTE_MIN_UNDER; its top reaches a little over the picture's bottom
 *   margin, which lets it sit higher and be larger.
 * - Where it doesn't, the Remote keeps the size the height suggests and stands under the TV, below the fold: the
 *   room's content is taller than the scene (`height`), and the room scrolls to it.
 */
export function layoutRoom(w: number, h: number): RoomLayout {
	const aspect = ROOM_PHOTO.tv.w / ROOM_PHOTO.tv.h
	const pad = Math.max(14, Math.min(28, w * 0.0125))
	const top = Math.max(6, h * 0.008)
	const tvW = w - 2 * pad
	const tvH = tvW / aspect
	const under = h - top - tvH + REMOTE_OVER_TV - REMOTE_FOOT
	const fits = under >= REMOTE_SHOWN_UNDER * REMOTE_MIN_UNDER
	const scale = fits
		? Math.min(0.8, under / REMOTE_SHOWN_UNDER)
		: remoteScaleFor(h)
	const tv: Rect = { left: (w - tvW) / 2, top, width: tvW, height: tvH }
	const remote = {
		left: w / 2 - (REMOTE_W * scale) / 2,
		// Down to its streaming keys inside the scene where it fits; else right under the TV, below the fold.
		top: fits
			? h - REMOTE_FOOT - REMOTE_SHOWN_UNDER * scale
			: top + tvH - REMOTE_OVER_TV,
		scale,
	}
	const height = Math.max(
		h,
		remote.top + REMOTE_SHOWN_UNDER * scale + REMOTE_FOOT,
	)
	const s = tv.width / ROOM_PHOTO.tv.w
	const k = (REMOTE_W * remote.scale) / HAND.pw
	return {
		place: "below",
		tv,
		photo: {
			left: tv.left - ROOM_PHOTO.tv.x * s,
			top: tv.top - ROOM_PHOTO.tv.y * s,
			width: ROOM_PHOTO.w * s,
			height: ROOM_PHOTO.h * s,
		},
		canvas: canvasIn(tv, TV_CANVAS),
		remote,
		hand: {
			left: (REMOTE_W * remote.scale) / 2 - (HAND.x + HAND.pw / 2) * k,
			// The Remote's end lies in the palm, where the placeholder ends.
			top: REMOTE_H * remote.scale - (HAND.y + HAND.ph) * k,
			width: HAND.w * k,
			height: HAND.h * k,
		},
		height,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The phone, upright and on its side: a wide TV across the top, never taller than a TV is (16:9), and the Remote
// held in the hand under it (the owner, 2026-10-22). The screens are drawn on one fixed canvas, so every phone
// shows the same screen at its own scale and nothing on a screen scrolls. The Remote rests under the TV; where the
// window is too short to show its keys there, its top shows (`peek`) and a tap raises it over the TV's lower part
// (`lift`), without the TV changing size. Upright, the teal wall with the TV on it (a bezel, a stand), the
// sideboard under it; on its side, the desktop's room photo behind the TV.

/** The phone's Remote: always held. */
export type PhoneRemoteForm = "hand"

/**
 * The phone's Remote at its smallest, where a key is 44 px: its width, how far down its keys end, how long its
 * body is (the keys and a short grip with the mark), how much it may grow, the share of the window's width it may
 * take, and where the fingers come round it. The body ends in the hand's palm, so its length sets the hand.
 */
export const PHONE_REMOTE: Record<
	PhoneRemoteForm,
	{
		w: number
		keys: number
		body: number
		grow: number
		share: number
		fingers: number
	}
> = {
	// The fingers: where the palm, under them, holds the body's end (HAND: the palm ends 448 of its px under them).
	hand: { w: 236, keys: 288, body: 388, grow: 1.3, share: 0.68, fingers: 388 - (448 * 236) / 382 },
}

/** The wall left and right of the TV, the TV's bezel, the wall over it, and the stand's neck under it. */
const WALL = 9
const BEZEL = 5
const TOP = 8
export const PHONE_STAND = 9
/** A phone's TV is a TV's shape: 16:9, never taller. */
export const PHONE_TV_ASPECT = 16 / 9
/** Between the stand's foot and the Remote's top. */
const GAP = 14
/** The least of the Remote that shows under the TV at rest, in px: its top keys. */
export const PHONE_PEEK = 64
/** Under the raised Remote's keys, and under a resting Remote that shows whole, over the reserve. */
const KEYS_CLEAR = 10
/** The photo row where the wall ends and the soundbar begins, a little wall included. */
const CUT = 478
/** The photo row that sits at the top of the scene. */
const SKY = 30
/** In the hand photo the fingers begin this far under the top of the Remote's place, and the palm ends there. */
const FINGERS = 612

export type PhoneRoomLayout = {
	form: PhoneRemoteForm
	/** How tall the room's content is (`RoomLayout.height`): the scene's, the phone's room never scrolls. */
	height: number
	auto: PhoneRemoteForm
	w: number
	h: number
	/** The TV's picture, and the TV with its bezel. */
	tv: Rect
	outer: Rect
	/** Where the stand's foot meets the soundbar: the wall ends here. */
	seam: number
	/** The canvas: the phone's fixed one, scaled to the picture. */
	canvas: { w: number; h: number; scale: number; x: number; y: number }
	/**
	 * The Remote at rest: its box at its scale `u`, where its keys end, and where its body ends. `lift` is how far
	 * a tap raises it so its keys all show (0 where they show at rest); `peek`, whether they don't.
	 */
	remote: {
		left: number
		top: number
		u: number
		width: number
		keysEnd: number
		bodyEnd: number
		lift: number
		peek: boolean
	}
	/** The portrait photo twice: the wall, stretched to our TV's height, and the furniture under it, unstretched. */
	wall: Rect
	floor: Rect
	/** The hand round the Remote: its fingers come round the body, its palm holds the body's end. */
	hand: Rect
	rig: PhoneRig
}

/**
 * How the phone's Remote aims at a spot on the picture (pointing-aim.ts): where the picture is from it, the point
 * it turns about, from there up to its top (`arm`) and half its width, the gap over its top (`clear`), how far it
 * may turn, lean back and slide, and what part of the angle to the spot it turns by.
 */
export type PhoneRig = {
	tv: "above" | "left"
	x: number
	y: number
	arm: number
	half: number
	clear: number
	swing: number
	lean: number
	slide: number
	turn: number
}

/**
 * On its side the phone's TV takes the window's width (the owner, 2026-10-22: full width, wide, never tall) and
 * is wider than 16:9 where the height caps it; its canvas keeps the phone's 270 px of height and is as wide as the
 * picture's shape, up to 3:1.
 */
export const PHONE_WIDE_CANVAS = { min: PHONE_TV_CANVAS.w, max: 810 } as const

/** What the phone's TV and Remote share upright and on their side. */
function seatPhone(
	w: number,
	h: number,
	reserve: number,
	want: PhoneRemoteForm | "auto",
	side = false,
) {
	const form: PhoneRemoteForm = want === "auto" ? "hand" : want
	const R = PHONE_REMOTE[form]
	const avail = h - reserve
	// The TV: the width but for the wall, 16:9; shorter (and so narrower) where the Remote's top must still show.
	const widest = w - 2 * WALL - 2 * BEZEL
	const tallest = avail - TOP - 2 * BEZEL - PHONE_STAND - GAP - PHONE_PEEK
	const ph = Math.max(60, Math.min(widest / PHONE_TV_ASPECT, tallest))
	// Upright: 16:9 and the fixed canvas. On its side: the width (up to 3:1), the canvas as wide as the picture's
	// shape, the picture as wide as that canvas at its scale.
	const cw = side
		? Math.max(
				PHONE_WIDE_CANVAS.min,
				Math.min(PHONE_WIDE_CANVAS.max, Math.round((PHONE_TV_CANVAS.h * widest) / ph)),
			)
		: PHONE_TV_CANVAS.w
	const pw = side ? (cw * ph) / PHONE_TV_CANVAS.h : ph * PHONE_TV_ASPECT
	const outer: Rect = {
		left: (w - pw) / 2 - BEZEL,
		top: TOP,
		width: pw + 2 * BEZEL,
		height: ph + 2 * BEZEL,
	}
	const tv: Rect = {
		left: outer.left + BEZEL,
		top: TOP + BEZEL,
		width: pw,
		height: ph,
	}
	// The Remote: by the width it may take, and its keys never taller than the window.
	const u = Math.max(
		1,
		Math.min(R.grow, (w * R.share) / R.w, (avail - TOP - KEYS_CLEAR) / R.keys),
	)
	const seam = outer.top + outer.height + PHONE_STAND
	const under = seam + GAP
	// At rest under the TV; where the window is taller than the Remote needs, lower, so its whole body shows above
	// the reserve with the hand under it.
	const top = Math.max(under, avail - KEYS_CLEAR - R.body * u)
	const keysEnd = top + R.keys * u
	const lift = Math.max(
		0,
		Math.min(keysEnd + KEYS_CLEAR - avail, top - outer.top),
	)
	const width = R.w * u
	const left = (w - width) / 2
	const kh = width / HAND.pw
	const hand: Rect = {
		left: left - HAND.x * kh,
		top: top + R.fingers * u - (HAND.y + FINGERS) * kh,
		width: HAND.w * kh,
		height: HAND.h * kh,
	}
	// It turns about the hand's grip under its keys, a few degrees, and leans back.
	const pivot = keysEnd + 30 * u
	const rig: PhoneRig = {
		tv: "above",
		x: w / 2,
		y: pivot,
		arm: pivot - top,
		half: width / 2,
		clear: Math.max(0, top - outer.top - outer.height - 3),
		swing: 11,
		lean: 11,
		slide: 8,
		turn: 0.65,
	}
	return {
		form,
		auto: "hand" as const,
		w,
		h,
		height: h,
		tv,
		outer,
		seam,
		canvas: {
			w: cw,
			h: PHONE_TV_CANVAS.h,
			scale: ph / PHONE_TV_CANVAS.h,
			x: 0,
			y: 0,
		},
		remote: {
			left,
			top,
			u,
			width,
			keysEnd,
			bodyEnd: top + R.body * u,
			lift,
			peek: lift > 0,
		},
		hand,
		rig,
	}
}

/**
 * Seats the TV and the Remote on a phone upright, in a scene of `w` x `h` (the window without the site's header
 * and dock). `reserve` is what lies over the scene's bottom edge and no key of the Remote may sit under: the lip
 * of the section below the room (PHONE_LIP in room.ts).
 */
export function layoutPhoneRoom(
	w: number,
	h: number,
	reserve = 0,
	want: PhoneRemoteForm | "auto" = "auto",
): PhoneRoomLayout {
	const seat = seatPhone(w, h, reserve, want)
	const outerW = seat.outer.width
	// The room photo, as wide as makes its TV ours; a little less, so its TV hides behind ours.
	const s = (outerW / PHONE_ROOM_PHOTO.tv.w) * 0.985
	// The wall's photo is stretched to the TV's height, and at least as wide as the scene.
	const ws = Math.max(s, w / PHONE_ROOM_PHOTO.w)
	const wallLeft = w / 2 - (PHONE_ROOM_PHOTO.tv.x + PHONE_ROOM_PHOTO.tv.w / 2) * ws
	const stretch = seat.seam / (CUT - SKY)
	const fs = Math.max(s, w / PHONE_ROOM_PHOTO.w)
	const floorLeft = w / 2 - (PHONE_ROOM_PHOTO.tv.x + PHONE_ROOM_PHOTO.tv.w / 2) * fs
	return {
		...seat,
		wall: {
			left: wallLeft,
			top: -SKY * stretch,
			width: PHONE_ROOM_PHOTO.w * ws,
			height: PHONE_ROOM_PHOTO.h * stretch,
		},
		floor: {
			left: floorLeft,
			top: -CUT * fs,
			width: PHONE_ROOM_PHOTO.w * fs,
			height: PHONE_ROOM_PHOTO.h * fs,
		},
	}
}

/**
 * How far a Remote may turn about its grip toward a picture on its left, in degrees: until its top corner on
 * that side, `half` beside the grip and `arm` above it, has travelled `reach` toward the picture. At most `most`.
 */
export function turnLimit(
	reach: number,
	half: number,
	arm: number,
	most: number,
): number {
	const corner = Math.hypot(half, arm)
	if (reach >= corner) return most
	const turn =
		((Math.asin(Math.max(0, reach) / corner) - Math.atan2(half, arm)) * 180) /
		Math.PI
	return Math.max(0, Math.min(most, turn))
}

export type LandscapeRoomLayout = Omit<PhoneRoomLayout, "wall" | "floor" | "seam"> & {
	/** The desktop's room photo, its TV behind ours. */
	photo: Rect
}

/**
 * Seats the TV and the Remote on a phone on its side, in a scene of `w` x `h`: as upright (`seatPhone`), in front
 * of the desktop's room photo. `reserve` is what lies over the scene's bottom edge under the Remote: the lip's bar
 * under 768 px of width; from there the lip is a tab at the right, clear of the Remote in the middle.
 */
export function layoutPhoneLandscape(
	w: number,
	h: number,
	reserve = 0,
	want: PhoneRemoteForm | "auto" = "auto",
): LandscapeRoomLayout {
	const { seam: _seam, ...seat } = seatPhone(w, h, reserve, want, true)
	const { outer } = seat
	// The desktop's photo, as wide as makes its TV ours; a little less, so its TV hides behind ours. Larger where
	// that would not cover the room's content.
	const cx = outer.left + outer.width / 2
	const cy = outer.top + outer.height / 2
	const px = ROOM_PHOTO.tv.x + ROOM_PHOTO.tv.w / 2
	const py = ROOM_PHOTO.tv.y + ROOM_PHOTO.tv.h / 2
	const s = Math.max(
		(outer.width / ROOM_PHOTO.tv.w) * 0.985,
		cx / px,
		(w - cx) / (ROOM_PHOTO.w - px),
		cy / py,
		(h - cy) / (ROOM_PHOTO.h - py),
	)
	return {
		...seat,
		photo: {
			left: cx - px * s,
			top: cy - py * s,
			width: ROOM_PHOTO.w * s,
			height: ROOM_PHOTO.h * s,
		},
	}
}
