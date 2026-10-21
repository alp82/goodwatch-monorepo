// Where the Remote should be for the spot it points at: the geometry of pointing (pointing.ts), pure, so the
// tests run it as it is. Three Remotes aim in three ways:
// - in the hand on the desktop it turns about the wrist toward the cursor while that is over the picture (anywhere
//   else, even a pixel outside its edge, it rests): a swing of up to 42 degrees under the TV, a nod of 13 beside it,
//   where a swing would carry it over the picture;
// - the phone's Remote under the TV (portrait) stays in its place: it turns a few degrees about the grip, leans
//   back and slides a little, and only for a spot on the picture;
// - the phone's Remote beside the TV (landscape) turns about the grip toward the picture on its left, as far as
//   its top corner stays off the picture.
// An aim is the five numbers of one transform; the loop eases toward it.
import {
	type PhoneRig,
	REMOTE_H,
	REMOTE_PERSPECTIVE,
	REMOTE_TILT_DEG,
	REMOTE_W,
	REMOTE_WRIST,
	type Rect,
	type RemotePlace,
} from "./room-layout.ts"

/** Degrees about the wrist or grip (`rz`), leaning back (`rx`), rolling (`ry`), and pixels moved. */
export type Aim = { rz: number; rx: number; ry: number; tx: number; ty: number }

/** The desktop's Remote at rest leans back toward the screen. */
export const REST: Aim = { rz: 0, rx: REMOTE_TILT_DEG, ry: 0, tx: 0, ty: 0 }
/** The phone's Remote rests flat: its keys are exactly where they are drawn. */
export const FLAT: Aim = { rz: 0, rx: 0, ry: 0, tx: 0, ty: 0 }

/** How far the desktop's Remote turns about the wrist: 42 degrees reaches the top corners of a 16:9 window. */
export const SWING: Record<RemotePlace, number> = { below: 42, beside: 13 }

/** A press that moves further than this is a drag. Until then it points under the finger, however long it is held. */
export const DRAG = 10
/** Dragged, the ring stands this far above the finger. It goes there in `LIFT_MS`, so the target does not jump. */
export const LIFT = 46
export const LIFT_MS = 220
/** A spot this far outside the picture still points at it. */
export const AROUND = 24

/** What pointing knows of the scene, in scene pixels. */
export type AimScene = {
	/** The TV's picture. */
	tv: Rect
	width: number
	height: number
	/** False while the TV is off or booting, or the room is out of the window: no ring, the Remote at rest. */
	live: boolean
	/** The desktop's Remote in the hand: its box at rest and where it is seated. */
	hand: { left: number; top: number; scale: number; place: RemotePlace } | null
	/** The phone's Remote. */
	rig: PhoneRig | null
}

/** The cursor or the finger: where, whether it is in the window, and whether it is a finger on the picture. */
export type Spot = { x: number; y: number; here: boolean; tap: boolean }

const clamp = (n: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, n))
const degrees = (radians: number) => (radians * 180) / Math.PI
const radians = (deg: number) => (deg * Math.PI) / 180

/**
 * How far outside the picture's edges the cursor still has the desktop Remote aim at it: nowhere. Outside the TV's
 * screen the Remote stays still (owner, October 21, 2026); it used to follow a 40 px margin round the picture.
 */
export const AIM_PAD = 0

export const inside = (spot: { x: number; y: number }, r: Rect, pad = 0) =>
	spot.x >= r.left - pad &&
	spot.x <= r.left + r.width + pad &&
	spot.y >= r.top - pad &&
	spot.y <= r.top + r.height + pad

/** The Remote's transform for an aim, about the wrist or the grip. */
export const aimTransform = (a: Aim) =>
	`translate3d(${a.tx.toFixed(1)}px, ${a.ty.toFixed(1)}px, 0) perspective(${REMOTE_PERSPECTIVE}px) rotateZ(${a.rz.toFixed(2)}deg) rotateX(${a.rx.toFixed(2)}deg) rotateY(${a.ry.toFixed(2)}deg)`

/** The desktop Remote's box at rest, down to the scene's bottom edge. */
const handBox = (scene: AimScene): Rect | null =>
	scene.hand && {
		left: scene.hand.left,
		top: scene.hand.top,
		width: REMOTE_W * scene.hand.scale,
		height: scene.height - scene.hand.top,
	}

/** How far the leading top corner of a Remote rises when it turns by `deg` about a point `arm` under its top. */
const rise = (rig: PhoneRig, deg: number) => {
	const turn = radians(Math.abs(deg))
	return rig.half * Math.sin(turn) - rig.arm * (1 - Math.cos(turn))
}

/**
 * The phone's Remote. It aims only at the picture: a cursor or a finger over its own keys must find them where
 * they are drawn.
 */
function rigAim(scene: AimScene, rig: PhoneRig, spot: Spot): Aim {
	if (!inside(spot, scene.tv, AROUND)) return FLAT
	const up = Math.max(40, rig.y - spot.y)
	// It leans back further for a spot higher up.
	const high = clamp(up / rig.y, 0, 1)
	const rx = rig.lean * (0.45 + 0.55 * high)
	if (rig.tv === "left") {
		// Landscape: the picture is to its left. It turns that way by the angle to the spot's share of a quarter
		// turn, rolls toward the TV's side for a spot further left, and lifts a little for one high up.
		const out = Math.max(0, rig.x - spot.x)
		const far = clamp(out / Math.max(1, rig.x - scene.tv.left), 0, 1)
		const rz = -Math.min(rig.swing, degrees(Math.atan2(out, up)) * rig.turn)
		// Turned, its leading corner rises. Over it is the scene's edge: it lifts no further than that leaves, and
		// where the corner would still pass it, the hand lowers the Remote by as much.
		const over = rise(rig, rz) - rig.clear
		return {
			rz,
			rx,
			ry: -far * rig.lean * 0.9,
			tx: 0,
			ty: over > 0 ? over : -Math.min(rig.slide * high, -over),
		}
	}
	// Portrait: it turns by a part of the angle to the spot and slides a little toward its side. Where its
	// leading corner would reach the TV over it, the hand lowers it by as much.
	const dx = spot.x - rig.x
	const side = clamp(dx / (scene.width / 2), -1, 1)
	const rz = clamp(
		degrees(Math.atan2(dx, up)) * rig.turn,
		-rig.swing,
		rig.swing,
	)
	return {
		rz,
		rx,
		ry: side * rig.lean * 0.9,
		tx: side * rig.slide,
		ty: Math.max(0, rise(rig, rz) - rig.clear),
	}
}

/**
 * Where the Remote should be for `spot`: aimed at it, or at rest (`REST` or `FLAT` themselves, so the loop can
 * tell). With reduced motion (`still`) the Remote does not aim.
 */
export function aimFor(scene: AimScene, spot: Spot, still: boolean): Aim {
	if (scene.rig)
		return still || !scene.live || !spot.here
			? FLAT
			: rigAim(scene, scene.rig, spot)
	const box = handBox(scene)
	// Over the Remote itself it settles at rest, so its keys are where they were and can be hit; away from the
	// picture it rests too. A finger on the picture counts as on the picture, also where the Remote's top reaches
	// over it.
	if (
		still ||
		!scene.live ||
		!scene.hand ||
		!box ||
		!spot.here ||
		(!spot.tap && (inside(spot, box, 12) || !inside(spot, scene.tv, AIM_PAD)))
	)
		return REST
	const { hand } = scene
	const pivot = {
		x: box.left + box.width / 2,
		y: hand.top + REMOTE_H * hand.scale * REMOTE_WRIST,
	}
	const dx = spot.x - pivot.x
	const up = Math.max(40, pivot.y - spot.y)
	// -1 at the scene's far edge on the left of the wrist, 1 at the far edge on its right.
	const side = clamp(dx / Math.max(pivot.x, scene.width - pivot.x), -1, 1)
	const reach = clamp(Math.hypot(dx, up) / (scene.height * 1.05), 0, 1)
	// With room to swing, the Remote turns by the angle to the spot. Held to a nod, it turns by a part of that
	// angle and rolls more instead.
	const swing = SWING[hand.place]
	const nod = hand.place === "beside"
	const rz = clamp(degrees(Math.atan2(dx, up)) * (nod ? 0.3 : 1), -swing, swing)
	return {
		rz,
		// It leans further back for a far spot and less for a near one.
		rx: REMOTE_TILT_DEG + clamp((reach - 0.75) * 40, -14, 14),
		ry: side * (nod ? 26 : 16),
		tx: side * (nod ? 10 : 44),
		// Turned, the streaming key on the far side dips by about a third of the Remote's width: the hand lifts
		// the Remote by that much, so the row stays in the window under the TV.
		ty:
			Math.min(0, (0.75 - reach) * 22) -
			Math.abs(Math.sin(radians(rz))) * REMOTE_W * 0.34 * hand.scale,
	}
}

/** How far above a dragging finger the ring is, `ms` after the drag began: eased up to `LIFT`. */
export function liftAt(ms: number, still: boolean): number {
	const t = still ? 1 : clamp(ms / LIFT_MS, 0, 1)
	return LIFT * (1 - (1 - t) ** 3)
}

/**
 * The ring for a dragging finger: `lift` above it and never off the picture. A finger that left the picture by
 * more than `AROUND` points at nothing (`on` is false).
 */
export function ringFor(
	finger: { x: number; y: number },
	tv: Rect,
	lift: number,
): { x: number; y: number; on: boolean } {
	return {
		x: clamp(finger.x, tv.left + 4, tv.left + tv.width - 4),
		y: clamp(finger.y - lift, tv.top + 4, tv.top + tv.height - 4),
		on:
			finger.x >= tv.left - AROUND &&
			finger.x <= tv.left + tv.width + AROUND &&
			finger.y >= tv.top - AROUND &&
			finger.y <= tv.top + tv.height + LIFT + AROUND,
	}
}
