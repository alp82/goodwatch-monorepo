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
