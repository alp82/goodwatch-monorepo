// PROTOTYPE - throwaway. The phone's room: the same room as the desktop's, on one screen without scrolling. From
// the top: the teal wall with the TV on it (a bezel, a stand, its light on the wall), the soundbar and the walnut
// sideboard under it, and in front of them the Remote (phone-remote.tsx). The wall and the furniture are the
// portrait room photo the start page already has; nothing new is loaded.
import { HAND, PHONE_ROOM } from "~/ui/living-room/room"
import type { Rect } from "~/ui/prototype-tv-flow/engine"
import { assetUrl } from "~/utils/asset-url"
import { PHONE_CANVAS } from "./base"
import { PHONE_REMOTE, type PhoneRemoteKey } from "./phone-remote"

/** The wall left and right of the TV, the TV's bezel, the wall over it, and the stand's neck under it. */
const WALL = 9
const BEZEL = 5
const TOP = 8
const STAND = 9
/** The site's dock and its round key reach this far into the scene from below; no key of the Remote sits there. */
const DOCK = 20
/** A TV is wider than tall: the picture is never taller than its width by this. */
const TV_ASPECT = 1.2
/** The photo row where the wall ends and the soundbar begins, a little wall included. */
const CUT = 478
/** The photo row that sits at the top of the window. */
const SKY = 30
/** In the hand photo the fingers begin this far under the top of the Remote's place. */
const FINGERS = 612

export type PhoneLayout = ReturnType<typeof layoutPhoneRoom>

/**
 * Seats the TV and the Remote on a phone of `w` x `h` (the scene, without the site's header and dock).
 * - The Remote is held in the hand wherever that leaves the TV its full height. Held, it is 46 px taller than
 *   lying; in a window too short for that it lies on the table instead, as the desktop's Remote moves beside the
 *   TV in a small window. That is a scene shorter than 279 + (w - 28) / 1.2 px: a window under about 697 px tall
 *   at 375 wide, 709 at 390 (the site's header and dock take 128). `want` forces a form.
 * - The TV takes the width but for a little wall, and is as tall as a TV may be (`TV_ASPECT`) or as the Remote
 *   leaves, whichever is less. Its canvas keeps its width, so a shorter TV shows less, not smaller.
 * - The Remote is as small as its keys allow (44 px) on a short phone and grows with the phone.
 * - What is left shows the room: the sideboard between the TV and the Remote, and more of the hand under the
 *   Remote's keys.
 */
export function layoutPhoneRoom(w: number, h: number, want: PhoneRemoteKey | "auto") {
	const outerW = w - 2 * WALL
	const pw = outerW - 2 * BEZEL
	const k = pw / PHONE_CANVAS.w
	const left = h - DOCK - 6 - TOP - 2 * BEZEL
	const strip = STAND + 4
	const auto: PhoneRemoteKey = left - strip - PHONE_REMOTE.hand.keys >= pw / TV_ASPECT ? "hand" : "table"
	const form = want === "auto" ? auto : want
	const R = PHONE_REMOTE[form]
	const ph = Math.min(pw / TV_ASPECT, left - strip - R.keys)
	// The Remote: by the width it may take, and never so tall that the TV or the strip gives way.
	const u = Math.max(1, Math.min(R.grow, (w * R.share) / R.w, (left - ph - strip) / R.keys))
	const spare = left - ph - strip - R.keys * u
	// The spare height: half above the Remote (the sideboard shows), half under its keys (the grip and the hand).
	const above = strip + (form === "table" ? Math.min(spare * 0.78, 150) : Math.min(spare * 0.5, 84))
	const outer: Rect = { left: WALL, top: TOP, width: outerW, height: ph + 2 * BEZEL }
	const tv: Rect = { left: WALL + BEZEL, top: TOP + BEZEL, width: pw, height: ph }
	const seam = outer.top + outer.height + STAND
	const remoteTop = outer.top + outer.height + above
	const remoteW = R.w * u
	const remoteLeft = (w - remoteW) / 2
	// The room photo, as wide as makes its TV ours; a little less, so its TV hides behind ours.
	const s = (outerW / PHONE_ROOM.tv.w) * 0.985
	const photoLeft = w / 2 - (PHONE_ROOM.tv.x + PHONE_ROOM.tv.w / 2) * s
	const kh = remoteW / HAND.pw
	const keysEnd = remoteTop + R.keys * u
	// How the Remote aims at a finger on the picture (pointing.tsx). Held, it turns about the hand's grip under its
	// keys, a few degrees, and leans back. Lying, it can only turn a little on the table, about its middle.
	const pivot = form === "hand" ? keysEnd + 30 * u : remoteTop + (R.keys * u) / 2
	const rig = { x: w / 2, y: pivot, arm: pivot - remoteTop, half: remoteW / 2, clear: Math.max(0, above - 3), ...(form === "hand" ? { swing: 11, lean: 11, slide: 8, turn: 0.65 } : { swing: 3.5, lean: 0, slide: 6, turn: 0.2 }) }
	return {
		place: "phone" as const,
		form,
		auto,
		rig,
		w,
		h,
		tv,
		outer,
		seam,
		canvas: { w: PHONE_CANVAS.w, h: ph / k },
		k,
		remote: { left: remoteLeft, top: remoteTop, u, width: remoteW, keysEnd },
		// The wall is the photo above the soundbar, stretched to our TV's height; the furniture follows unstretched.
		wall: { left: photoLeft, top: -SKY * (seam / (CUT - SKY)), width: PHONE_ROOM.w * s, height: PHONE_ROOM.h * (seam / (CUT - SKY)) },
		floor: { left: photoLeft, top: -CUT * s, width: PHONE_ROOM.w * s, height: PHONE_ROOM.h * s },
		// The hand, for the Remote that is held: its fingers come round the body at the streaming keys.
		hand: form === "hand" ? { left: remoteLeft - HAND.x * kh, top: remoteTop + R.fingers * u - (HAND.y + FINGERS) * kh, width: HAND.w * kh, height: HAND.h * kh } : null,
	}
}

/** The wall, the furniture and the TV's body: everything of the phone's room that is behind the picture. */
export function PhoneRoom({ L, on }: { L: PhoneLayout; on: boolean }) {
	const img = (style: Rect) => (
		<picture>
			<source type="image/avif" srcSet={assetUrl(PHONE_ROOM.avif)} />
			{/* The photo is softened like the desktop's: the eye is on the TV. Set once, never animated. */}
			<img src={assetUrl(PHONE_ROOM.webp)} alt="" aria-hidden className="absolute max-w-none select-none" style={{ ...style, filter: "blur(1.2px)" }} draggable={false} />
		</picture>
	)
	const { outer } = L
	return (
		<>
			<div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: L.seam }} role="img" aria-label={PHONE_ROOM.alt}>
				{img(L.wall)}
			</div>
			<div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: L.seam }}>
				{img(L.floor)}
			</div>
			{/* The lights are low, and lower with the TV off; they fall off toward the corners. */}
			<div className="absolute inset-0 bg-[#05060a] transition-opacity duration-700" style={{ opacity: on ? 0.3 : 0.62 }} />
			<div className="absolute inset-0" style={{ background: `radial-gradient(95% 62% at 50% ${((outer.top + outer.height / 2) / L.h) * 100}%, rgba(5,6,10,0) 42%, rgba(5,6,10,.5) 100%)` }} />
			{/* The stand: a neck and a foot, down to the soundbar. */}
			<div className="absolute bg-gradient-to-b from-[#2b2d33] to-[#141518]" style={{ left: outer.left + outer.width / 2 - 20, top: outer.top + outer.height - 1, width: 40, height: STAND + 2 }} />
			<div className="absolute rounded-[2px] bg-[#1d1e22] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_3px_6px_rgba(0,0,0,.6)]" style={{ left: outer.left + outer.width / 2 - 62, top: L.seam - 2, width: 124, height: 5 }} />
			{/* The TV's body: a thin dark bezel, and its light on the wall while it is on. */}
			<div
				data-tv-body
				className="absolute rounded-[8px] bg-gradient-to-b from-[#1a1b1f] to-[#0c0d0f] transition-shadow duration-700"
				style={{ ...outer, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.13), inset 0 0 0 4px #0b0c0e, 0 10px 24px rgba(0,0,0,.55)${on ? ", 0 0 70px 8px rgba(251,191,36,.16), 0 0 16px 1px rgba(251,191,36,.2)" : ""}` }}
			/>
		</>
	)
}
