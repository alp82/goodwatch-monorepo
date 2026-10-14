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

/** The Remote in its own pixels. */
export const REMOTE_W = 312
export const REMOTE_H = 866

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

/** The phone's canvas keeps its width; a shorter TV shows less of its height, not a smaller picture. */
export const PHONE_TV_CANVAS = { w: 500, h: 417 } as const

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

/** Beside the TV the whole Remote shows at rest, in its own pixels from its top: all of it and the start of the palm. */
const REMOTE_SHOWN = 880
/** Under the TV it shows down to its streaming keys (they end at 522) and the fingertips under them. */
const REMOTE_SHOWN_UNDER = 548
/**
 * Under the TV the Remote's top reaches this far over the picture, in screen pixels: over the margin every
 * screen keeps free at its bottom edge, so it covers no type and no focus target.
 */
const REMOTE_OVER_TV = 18
/** Under the TV the Remote may shrink this far to keep the TV's type at 18 px; smaller, its wheel stops being a control. */
const REMOTE_MIN_UNDER = 0.46
/** How far the hand reaches past the Remote's sides, in Remote widths: the fingers on the left, the palm on the right. */
const HAND_LEFT = 0.3
const HAND_RIGHT = 0.42
/** Type of 20 canvas pixels prints at 18 once the TV shows its canvas at 0.9. */
export const TV_MIN_WIDTH = TV_CANVAS.w * 0.9

export type RemotePlace = "below" | "beside"

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
 * gutter). Two ways to seat the TV and the Remote:
 * - `below`: the TV centred at the top and the Remote under it, in the hand, free to swing toward the cursor.
 *   The TV is as tall as the scene leaves once the Remote shows down to its streaming keys; in a shorter scene
 *   the Remote gives way first, so the TV keeps the width that holds its type at 18 px. The Remote's top
 *   reaches a little over the picture's bottom margin, which lets it sit higher and be larger.
 * - `beside`: for a scene too small for that (under about 853 px tall or 1107 wide: a window under about 918 by
 *   1122): the TV on the left, as large as the scene allows, and the whole Remote to its right, its end on
 *   the scene's bottom edge.
 * `want` forces one; "auto" takes `below` wherever it keeps 18 px type.
 */
export function layoutRoom(
	w: number,
	h: number,
	want: RemotePlace | "auto" = "auto",
): RoomLayout {
	const aspect = ROOM_PHOTO.tv.w / ROOM_PHOTO.tv.h
	const pad = Math.max(14, Math.min(28, w * 0.0125))
	// Under the TV. The TV's size is settled first: what the scene leaves over a Remote of the size the height
	// suggests, or over a smaller one if that is what 18 px type costs.
	const leaves = (scale: number) =>
		Math.min(
			h - Math.max(8, h * 0.012) - 8 - REMOTE_SHOWN_UNDER * scale,
			(w - 2 * pad) / aspect,
		)
	const needed = TV_MIN_WIDTH / aspect
	let tvUnder = leaves(Math.max(0.5, Math.min(0.68, h / 1800)))
	if (tvUnder < needed) tvUnder = Math.min(needed, leaves(REMOTE_MIN_UNDER))
	const place: RemotePlace =
		want === "auto" ? (tvUnder >= needed - 0.5 ? "below" : "beside") : want
	let tv: Rect
	let remote: RoomLayout["remote"]
	if (place === "below") {
		// Then the Remote takes all the height under that TV, and a little of the TV.
		const top = Math.max(6, h * 0.008)
		const tvW = tvUnder * aspect
		const scale = Math.max(
			REMOTE_MIN_UNDER,
			Math.min(0.8, (h - top - tvUnder + REMOTE_OVER_TV) / REMOTE_SHOWN_UNDER),
		)
		tv = { left: (w - tvW) / 2, top, width: tvW, height: tvUnder }
		remote = {
			left: w / 2 - (REMOTE_W * scale) / 2,
			top: h - REMOTE_SHOWN_UNDER * scale,
			scale,
		}
	} else {
		const column = (scale: number) =>
			REMOTE_W * scale * (1 + HAND_LEFT + HAND_RIGHT)
		// As large as the height shows all of it, and no larger than a Remote in a hand looks next to this TV.
		let scale = Math.min(Math.max(0.9, h / 1130), 1.15, (h - 10) / REMOTE_SHOWN)
		const room = w - 3 * pad - TV_MIN_WIDTH
		if (column(scale) > room) scale = Math.max(0.5, room / column(1))
		const tvW = Math.min(w - 3 * pad - column(scale), h * 0.92 * aspect)
		const tvH = tvW / aspect
		const left = (w - (tvW + pad + column(scale))) / 2
		tv = {
			left,
			top: Math.max(10, (h - tvH) * 0.32),
			width: tvW,
			height: tvH,
		}
		remote = {
			left: left + tvW + pad + REMOTE_W * scale * HAND_LEFT,
			top: Math.max(6, h - REMOTE_SHOWN * scale),
			scale,
		}
	}
	const s = tv.width / ROOM_PHOTO.tv.w
	const k = (REMOTE_W * remote.scale) / HAND.pw
	return {
		place,
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
			top: -HAND.y * k,
			width: HAND.w * k,
			height: HAND.h * k,
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// The phone: one screen without scrolling. From the top: the teal wall with the TV on it (a bezel, a stand),
// the soundbar and the sideboard under it, and in front of them the Remote (PhoneRemote.tsx).

export type PhoneRemoteForm = "hand" | "table"

/**
 * The phone's Remote in each form at its smallest, where a key is 44 px: its width, how far down its keys end,
 * how much it may grow, the share of the phone's width it may take, and (held) where the fingers come round it.
 */
export const PHONE_REMOTE: Record<
	PhoneRemoteForm,
	{ w: number; keys: number; grow: number; share: number; fingers: number }
> = {
	hand: { w: 236, keys: 222, grow: 1.3, share: 0.68, fingers: 168 },
	table: { w: 336, keys: 176, grow: 1.25, share: 0.935, fingers: 0 },
}

/** The wall left and right of the TV, the TV's bezel, the wall over it, and the stand's neck under it. */
const WALL = 9
const BEZEL = 5
const TOP = 8
export const PHONE_STAND = 9
/** A TV is wider than tall: the picture is never taller than its width by this. */
const TV_ASPECT = 1.2
/** The photo row where the wall ends and the soundbar begins, a little wall included. */
const CUT = 478
/** The photo row that sits at the top of the scene. */
const SKY = 30
/** In the hand photo the fingers begin this far under the top of the Remote's place. */
const FINGERS = 612

export type PhoneRoomLayout = {
	form: PhoneRemoteForm
	/** The form the scene's height takes by itself, whatever `want` forced. */
	auto: PhoneRemoteForm
	w: number
	h: number
	/** The TV's picture, and the TV with its bezel. */
	tv: Rect
	outer: Rect
	/** Where the stand's foot meets the soundbar: the wall ends here. */
	seam: number
	/** The canvas: the phone's width, and as much height as the picture shows. */
	canvas: { w: number; h: number; scale: number; x: number; y: number }
	/** The Remote: its box at its scale `u`, and where its keys end. */
	remote: {
		left: number
		top: number
		u: number
		width: number
		keysEnd: number
	}
	/** The portrait photo twice: the wall, stretched to our TV's height, and the furniture under it, unstretched. */
	wall: Rect
	floor: Rect
	/** The hand, for the Remote that is held: its fingers come round the body at the streaming keys. */
	hand: Rect | null
	rig: PhoneRig
}

/**
 * How the phone's Remote aims at a spot on the picture (pointing-aim.ts): where the picture is from it, the point
 * it turns about, from there up to its top (`arm`) and half its width, the gap over its top (`clear`: to the TV
 * in portrait, to the scene's edge in landscape), how far it may turn, lean back and slide, and what part of the
 * angle to the spot it turns by.
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
 * Seats the TV and the Remote on a phone, in a scene of `w` x `h` (the window without the site's header and
 * dock). `reserve` is what lies over the scene's bottom edge and no key of the Remote may sit under: the lip of
 * the section below the room (PHONE_LIP in room.ts).
 * - The Remote is held in the hand wherever that leaves the TV its full height. Held, it is 46 px taller than
 *   lying; in a scene too short for that it lies on the table instead, as the desktop's Remote moves beside the
 *   TV in a small window. That is a scene shorter than reserve + 259 + (w - 28) / 1.2 px. `want` forces a form.
 * - The TV takes the width but for a little wall, and is as tall as a TV may be (`TV_ASPECT`) or as the Remote
 *   leaves, whichever is less. Its canvas keeps its width, so a shorter TV shows less, not smaller.
 * - The Remote is as small as its keys allow (44 px) on a short phone and grows with the phone.
 * - What is left shows the room: the sideboard between the TV and the Remote, and more of the hand under the
 *   Remote's keys.
 */
export function layoutPhoneRoom(
	w: number,
	h: number,
	reserve = 0,
	want: PhoneRemoteForm | "auto" = "auto",
): PhoneRoomLayout {
	const outerW = w - 2 * WALL
	const pw = outerW - 2 * BEZEL
	const k = pw / PHONE_TV_CANVAS.w
	const left = h - reserve - 6 - TOP - 2 * BEZEL
	const strip = PHONE_STAND + 4
	const auto: PhoneRemoteForm =
		left - strip - PHONE_REMOTE.hand.keys >= pw / TV_ASPECT ? "hand" : "table"
	const form = want === "auto" ? auto : want
	const R = PHONE_REMOTE[form]
	const ph = Math.min(pw / TV_ASPECT, left - strip - R.keys)
	// The Remote: by the width it may take, and never so tall that the TV or the strip gives way.
	const u = Math.max(
		1,
		Math.min(R.grow, (w * R.share) / R.w, (left - ph - strip) / R.keys),
	)
	const spare = left - ph - strip - R.keys * u
	// The spare height: part above the Remote (the sideboard shows), part under its keys (the grip and the hand).
	const above =
		strip +
		(form === "table" ? Math.min(spare * 0.78, 150) : Math.min(spare * 0.5, 84))
	const outer: Rect = {
		left: WALL,
		top: TOP,
		width: outerW,
		height: ph + 2 * BEZEL,
	}
	const tv: Rect = {
		left: WALL + BEZEL,
		top: TOP + BEZEL,
		width: pw,
		height: ph,
	}
	const seam = outer.top + outer.height + PHONE_STAND
	const remoteTop = outer.top + outer.height + above
	const remoteW = R.w * u
	const remoteLeft = (w - remoteW) / 2
	// The room photo, as wide as makes its TV ours; a little less, so its TV hides behind ours.
	const s = (outerW / PHONE_ROOM_PHOTO.tv.w) * 0.985
	const photoLeft =
		w / 2 - (PHONE_ROOM_PHOTO.tv.x + PHONE_ROOM_PHOTO.tv.w / 2) * s
	const kh = remoteW / HAND.pw
	const keysEnd = remoteTop + R.keys * u
	// Held, the Remote turns about the hand's grip under its keys, a few degrees, and leans back. Lying, it can
	// only turn a little on the table, about its middle.
	const pivot =
		form === "hand" ? keysEnd + 30 * u : remoteTop + (R.keys * u) / 2
	const stretch = seam / (CUT - SKY)
	return {
		form,
		auto,
		w,
		h,
		tv,
		outer,
		seam,
		canvas: { w: PHONE_TV_CANVAS.w, h: ph / k, scale: k, x: 0, y: 0 },
		remote: { left: remoteLeft, top: remoteTop, u, width: remoteW, keysEnd },
		wall: {
			left: photoLeft,
			top: -SKY * stretch,
			width: PHONE_ROOM_PHOTO.w * s,
			height: PHONE_ROOM_PHOTO.h * stretch,
		},
		floor: {
			left: photoLeft,
			top: -CUT * s,
			width: PHONE_ROOM_PHOTO.w * s,
			height: PHONE_ROOM_PHOTO.h * s,
		},
		hand:
			form === "hand"
				? {
						left: remoteLeft - HAND.x * kh,
						top: remoteTop + R.fingers * u - (HAND.y + FINGERS) * kh,
						width: HAND.w * kh,
						height: HAND.h * kh,
					}
				: null,
		rig: {
			tv: "above",
			x: w / 2,
			y: pivot,
			arm: pivot - remoteTop,
			half: remoteW / 2,
			clear: Math.max(0, above - 3),
			...(form === "hand"
				? { swing: 11, lean: 11, slide: 8, turn: 0.65 }
				: { swing: 3.5, lean: 0, slide: 6, turn: 0.2 }),
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// The phone in landscape (the owner's decision after the prototype, which did not design it): the TV on the
// left on the phone's canvas, the phone's Remote on the right. The room is the whole window there, above the
// site's header (living-room.css), so a phone of 844 x 390 is a scene of 844 x 390.

/**
 * In landscape the picture may be this much wider than tall at most: a canvas of 500 x 373, the shortest the
 * phone's screens are laid out for (the prototype's shortest was 375).
 */
const LANDSCAPE_MAX_ASPECT = 1.34
/** The scene's right edge cuts the palm off: this much of the scene stays free right of the held Remote. */
const PALM = 12
/** Turned toward the picture, the Remote's top corner stays this far from the picture's edge. */
const LANDSCAPE_GAP = 3
/** Held, the Remote turns no further than this however much room it has; lying, it only shifts on the table. */
const LANDSCAPE_SWING = { hand: 22, table: 3.5 } as const

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

export type LandscapeRoomLayout = {
	form: PhoneRemoteForm
	auto: PhoneRemoteForm
	w: number
	h: number
	tv: Rect
	outer: Rect
	canvas: PhoneRoomLayout["canvas"]
	remote: PhoneRoomLayout["remote"]
	/** The desktop's room photo, its TV behind ours. */
	photo: Rect
	hand: Rect | null
	rig: PhoneRig
}

/**
 * Seats the TV and the Remote on a phone in landscape, in a scene of `w` x `h`. `reserve` is what lies over
 * the scene's bottom edge: under the TV (`tv`) and under the Remote (`remote`). The lip of the section below
 * the room is a tab there, which living-room.css moves to the Remote's side, so the TV keeps the height.
 * - The TV comes first: as tall as the scene, and as wide as its canvas allows (`LANDSCAPE_MAX_ASPECT`) or as
 *   the Remote at its smallest leaves.
 * - The Remote is held in the hand where its keys fit the height, and lies on the table in a shorter scene. It
 *   grows into the width the TV leaves. Held, its fingers come round its left side, toward the TV, and the
 *   scene's right edge cuts the palm off.
 */
export function layoutPhoneLandscape(
	w: number,
	h: number,
	reserve: { tv: number; remote: number } = { tv: 0, remote: 0 },
	want: PhoneRemoteForm | "auto" = "auto",
): LandscapeRoomLayout {
	const keysMay = h - TOP - reserve.remote - 6
	const auto: PhoneRemoteForm =
		keysMay >= PHONE_REMOTE.hand.keys ? "hand" : "table"
	const form = want === "auto" ? auto : want
	const R = PHONE_REMOTE[form]
	// Left of the Remote: the fingers of the hand that holds it, or a little table. Right of it: the scene's edge.
	const beside = form === "hand" ? HAND_LEFT : 0.03
	const edge = form === "hand" ? PALM : WALL
	const column = (u: number) => R.w * u * (1 + beside) + edge
	const frame = 2 * WALL + 2 * BEZEL
	const phMax = Math.max(60, h - reserve.tv - 2 * TOP - 2 * BEZEL)
	const pw = Math.max(
		72,
		Math.min(w - frame - column(1), phMax * LANDSCAPE_MAX_ASPECT),
	)
	const ph = Math.min(phMax, pw / TV_ASPECT)
	const u = Math.max(
		1,
		Math.min(
			R.grow,
			(w - frame - pw - edge) / (R.w * (1 + beside)),
			keysMay / R.keys,
		),
	)
	const outer: Rect = {
		left: WALL,
		top: TOP + (phMax - ph) / 2,
		width: pw + 2 * BEZEL,
		height: ph + 2 * BEZEL,
	}
	const tv: Rect = {
		left: outer.left + BEZEL,
		top: outer.top + BEZEL,
		width: pw,
		height: ph,
	}
	const k = pw / PHONE_TV_CANVAS.w
	const remoteW = R.w * u
	// The Remote's column runs from the wall right of the TV to the scene's edge; what it does not need is
	// shared between its two sides.
	const columnLeft = outer.left + outer.width + WALL
	const spare = Math.max(0, w - columnLeft - column(u))
	const remoteLeft = columnLeft + beside * remoteW + spare / 2
	// Its keys sit a little above the middle of the height they may take; held, its body runs on under the edge.
	const remoteTop =
		TOP + Math.max(0, keysMay - R.keys * u) * (form === "hand" ? 0.4 : 0.5)
	const keysEnd = remoteTop + R.keys * u
	// The desktop's photo, as wide as makes its TV ours; a little less, so its TV hides behind ours. Larger where
	// that would not cover the scene.
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
	const kh = remoteW / HAND.pw
	const pivot =
		form === "hand" ? keysEnd + 30 * u : remoteTop + (R.keys * u) / 2
	const swing = turnLimit(
		remoteLeft + remoteW / 2 - (tv.left + tv.width) - LANDSCAPE_GAP,
		remoteW / 2,
		pivot - remoteTop,
		LANDSCAPE_SWING[form],
	)
	return {
		form,
		auto,
		w,
		h,
		tv,
		outer,
		canvas: { w: PHONE_TV_CANVAS.w, h: ph / k, scale: k, x: 0, y: 0 },
		remote: { left: remoteLeft, top: remoteTop, u, width: remoteW, keysEnd },
		photo: {
			left: cx - px * s,
			top: cy - py * s,
			width: ROOM_PHOTO.w * s,
			height: ROOM_PHOTO.h * s,
		},
		hand:
			form === "hand"
				? {
						left: remoteLeft - HAND.x * kh,
						top: remoteTop + R.fingers * u - (HAND.y + FINGERS) * kh,
						width: HAND.w * kh,
						height: HAND.h * kh,
					}
				: null,
		// The picture is left of the Remote here, not above it. The Remote turns about its grip toward the spot it
		// points at: by the angle to the spot's share of a quarter turn, so a spot straight over it leaves it
		// upright and one level with the grip turns it as far as it may go (`swing`). That is as far as its top
		// corner stays off the picture, and no further than a hand turns. Over the Remote is the scene's edge
		// (`clear`); it lifts by `slide` for a spot high up.
		rig: {
			tv: "left",
			x: remoteLeft + remoteW / 2,
			y: pivot,
			arm: pivot - remoteTop,
			half: remoteW / 2,
			clear: Math.max(0, remoteTop - 3),
			swing,
			turn: swing / 90,
			...(form === "hand" ? { lean: 11, slide: 8 } : { lean: 0, slide: 6 }),
		},
	}
}
