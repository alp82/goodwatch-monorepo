// The room's pictures and the numbers that go with them: the room photos and where the TV sits in them, the hand
// that holds the Remote, the Remote's size, and the lip of the section below the room. The layouts that place them
// in a window are tv/room-layout.ts's, which keeps its own copies of these numbers (room-render.test-support.tsx
// checks that they agree).
import { assetUrl } from "~/utils/asset-url"
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
	get avif() {
		return `${assetUrl(room1280Avif)} 1280w, ${assetUrl(room1920Avif)} 1920w, ${assetUrl(room2560Avif)} 2560w`
	},
	get webp() {
		return `${assetUrl(room1280Webp)} 1280w, ${assetUrl(room1920Webp)} 1920w, ${assetUrl(room2560Webp)} 2560w`
	},
	fallback: room1920Webp,
} as const

export const HAND_IMAGE = { avif: handAvif, webp: handWebp }

/** The Remote's natural width. */
export const REMOTE_W = 312

/** The extended sleeve sprite and the Remote's registration box (its top is outside the cropped sprite). */
export const HAND = { w: 972, h: 1619, x: 111, y: -270, pw: 240, ph: 666 }

/**
 * The Remote's length: its keys and a short grip with the logo (the owner, 2026-10-22: no long empty body). It is
 * shorter than the hand's placeholder; its end lies in the palm, where the placeholder ends.
 */
export const REMOTE_H = 610

/** The Remote leans back toward the screen. */
export const REMOTE_TILT_DEG = 12

/** The portrait room (the desktop room extended down over the viewer's lap), in 1068 x 1602 coordinates. */
export const PHONE_ROOM = {
	w: 1068,
	h: 1602,
	tv: { x: 229, y: 90, w: 611, h: 330 },
	alt: "The living room at dusk seen from the sofa, a caramel knit blanket over your lap, the TV on the teal wall",
	avif: roomPhoneAvif,
	webp: roomPhoneWebp,
} as const

/**
 * The height of the lip of the section below the room on a phone (#352). It lies over the room's bottom edge, so
 * the Remote's keys end above it. living-room.css has the same number.
 */
export const PHONE_LIP = 60
