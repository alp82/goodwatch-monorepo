// The start room's paintings, with responsive landscape files capped at the original 1536 pixels. The phone's
// largest file keeps its name: the landing budget recognizes `start-room-phone-<hash>.avif` as its LCP element.
import type { HtmlLinkDescriptor } from "@remix-run/react"
import startRoom800Avif from "~/img/start-room/start-room-800.avif"
import startRoom800Webp from "~/img/start-room/start-room-800.webp"
import startRoom1280Avif from "~/img/start-room/start-room-1280.avif"
import startRoom1280Webp from "~/img/start-room/start-room-1280.webp"
import startRoomAvif from "~/img/start-room/start-room-1536.avif"
import startRoomWebp from "~/img/start-room/start-room-1536.webp"
import startRoomPhoneAvif from "~/img/start-room/start-room-phone.avif"
import startRoomPhoneWebp from "~/img/start-room/start-room-phone.webp"
import tvCornerAvif from "~/img/start-room/tv-corner.avif"
import tvCornerWebp from "~/img/start-room/tv-corner.webp"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { NOT_UPRIGHT_PHONE, UPRIGHT_PHONE } from "~/utils/upright-phone"
import { pictureSizes } from "./room-picture-sizes"
import { START_ROOM, START_ROOM_PHONE } from "./scene"

export const START_ROOM_ART = {
	avif: startRoomAvif,
	webp: startRoomWebp,
	avifCandidates: [
		{ width: 800, src: startRoom800Avif },
		{ width: 1280, src: startRoom1280Avif },
		{ width: 1536, src: startRoomAvif },
	],
	webpCandidates: [
		{ width: 800, src: startRoom800Webp },
		{ width: 1280, src: startRoom1280Webp },
		{ width: 1536, src: startRoomWebp },
	],
	sizes: pictureSizes(START_ROOM),
} as const
export const START_ROOM_PHONE_ART = {
	avif: startRoomPhoneAvif,
	webp: startRoomPhoneWebp,
	avifCandidates: [{ width: 1024, src: startRoomPhoneAvif }],
	webpCandidates: [{ width: 1024, src: startRoomPhoneWebp }],
	sizes: pictureSizes(START_ROOM_PHONE),
} as const
/** How it works' TV corner: below the fold, loaded lazily. */
export const TV_CORNER_ART = { avif: tvCornerAvif, webp: tvCornerWebp } as const

export type RoomArt = typeof START_ROOM_ART | typeof START_ROOM_PHONE_ART

/** Resolve while rendering: images and their preloads follow this response's static hostname together. */
export function roomPictureSources(art: RoomArt) {
	const srcset = (candidates: readonly { width: number; src: string }[]) =>
		candidates.map(({ width, src }) => `${assetUrl(src)} ${width}w`).join(", ")
	return {
		avif: srcset(art.avifCandidates),
		webp: srcset(art.webpCandidates),
		sizes: art.sizes,
	}
}

/**
 * Responsive image selection needs a viewport, which 103 Early Hints do not have. Put these in the HTML head,
 * with exactly the picture's srcset/sizes and orientation queries. Preload only AVIF: preloading WebP as well
 * would fetch both formats on browsers that support both. No href: older responsive-preload implementations
 * should discover the picture normally rather than fetch an unused fallback.
 */
export function startRoomPreloads(): HtmlLinkDescriptor[] {
	return [
		{ art: START_ROOM_ART, media: NOT_UPRIGHT_PHONE },
		{ art: START_ROOM_PHONE_ART, media: UPRIGHT_PHONE },
	].map(({ art, media }) => ({
		rel: "preload",
		as: "image",
		type: "image/avif",
		media,
		imageSrcSet: roomPictureSources(art).avif,
		imageSizes: art.sizes,
		...(assetBase() ? { crossOrigin: "anonymous" as const } : {}),
		fetchpriority: "high",
	}))
}
