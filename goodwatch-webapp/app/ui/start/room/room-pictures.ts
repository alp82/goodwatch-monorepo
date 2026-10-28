// The start room's pictures (room/scene.ts describes them). Vite hashes the files: `start-room-phone-<hash>.avif`
// is the phone's largest picture, which the benchmark's budget knows by its name (goodwatch-benchmark/urls/budget.json,
// `lcp_element`). The phone's AVIF was re-encoded to about 114 KB for the image budget.
import startRoomAvif from "~/img/start-room/start-room-1536.avif"
import startRoomWebp from "~/img/start-room/start-room-1536.webp"
import startRoomPhoneAvif from "~/img/start-room/start-room-phone.avif"
import startRoomPhoneWebp from "~/img/start-room/start-room-phone.webp"
import tvCornerAvif from "~/img/start-room/tv-corner.avif"
import tvCornerWebp from "~/img/start-room/tv-corner.webp"

export const START_ROOM_ART = {
	avif: startRoomAvif,
	webp: startRoomWebp,
} as const
export const START_ROOM_PHONE_ART = {
	avif: startRoomPhoneAvif,
	webp: startRoomPhoneWebp,
} as const
/** How it works' TV corner: below the fold, loaded lazily. */
export const TV_CORNER_ART = { avif: tvCornerAvif, webp: tvCornerWebp } as const
