// The new room's photos: the room photos of room.ts with the softening in the file. The approved prototype drew
// the old files under a live blur (1.8 px on the desktop, 1.2 px on the phone), which the rendering budget (#190)
// rules out over the room photo. docs/implementation/tv-screen-revamp/room/soften-photos.py made these files.
//
// One desktop file, 1920 px wide: the room is drawn at about 1.8 times the window's width and softened, so no
// window gains from more pixels. The phone's file keeps `room-phone-` in its name: the benchmark's budget knows
// the phone's largest image by it (goodwatch-benchmark/urls/budget.json, `lcp_element`).
import roomPhoneSoftAvif from "~/img/living-room/room-phone-soft.avif"
import roomPhoneSoftWebp from "~/img/living-room/room-phone-soft.webp"
import roomSoftAvif from "~/img/living-room/room-soft-1920.avif"
import roomSoftWebp from "~/img/living-room/room-soft-1920.webp"

export const ROOM_ART = { avif: roomSoftAvif, webp: roomSoftWebp } as const
export const PHONE_ROOM_ART = {
	avif: roomPhoneSoftAvif,
	webp: roomPhoneSoftWebp,
} as const

/**
 * Before the window is measured both room photos are in the HTML (TvRoom.tsx), and a `<source>` that matches
 * where the other room is drawn keeps a photo from being asked for there: the desktop's while a phone is upright,
 * the phone's everywhere else. The queries are the layouts' (PHONE_BELOW and LANDSCAPE in TvRoom.tsx), in
 * window pixels: before the first paint no script has measured anything.
 */
export const UPRIGHT_PHONE =
	"(max-width: 767.98px) and (orientation: portrait), (max-width: 767.98px) and (min-height: 540.02px)"
export const NOT_UPRIGHT_PHONE =
	"(min-width: 768px), (orientation: landscape) and (max-height: 540px)"
/** A picture of nothing, for the photo the window does not draw. */
export const NO_PICTURE =
	"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
