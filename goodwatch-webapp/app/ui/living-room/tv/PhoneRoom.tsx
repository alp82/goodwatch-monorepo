// The phone's room: the same room as the desktop's, on one screen without scrolling. From the top: the teal wall
// with the TV on it (a bezel, a stand, its light on the wall), the soundbar and the walnut sideboard under it.
// This is everything of it that is behind the picture; the scene (TvRoom.tsx) puts the picture and the Remote
// in front. The wall and the furniture are the portrait room photo, drawn twice from one file.
//
// Without a layout (`L` null) the window is not measured yet: the parts are drawn for living-room.css to place
// (`tvr-f-*`, the first paint), and the same nodes take their measured place afterwards.
import type { CSSProperties } from "react"
import { assetUrl } from "~/utils/asset-url"
import { HERO_TIMING } from "~/utils/start-after-paint"
import { PHONE_ROOM } from "../room"
import { NOT_UPRIGHT_PHONE, NO_PICTURE, PHONE_ROOM_ART } from "./room-art"
import {
	type LandscapeRoomLayout,
	PHONE_ROOM_PHOTO,
	PHONE_STAND,
	type PhoneRoomLayout,
	type Rect,
} from "./room-layout"

/**
 * The wall's picture in its box: laid out in the photo's own shape and stretched to the box's height by a transform.
 * It looks the same as a stretched box, and an image box out of its file's shape reads as a distorted image to
 * Lighthouse (Best Practices: image aspect ratio). living-room.css does the same for the first paint.
 */
const stretched = (box: Rect): CSSProperties => {
	const height = (box.width * PHONE_ROOM_PHOTO.h) / PHONE_ROOM_PHOTO.w
	return {
		left: box.left,
		top: box.top,
		width: box.width,
		height,
		transformOrigin: "0 0",
		transform: `scaleY(${box.height / height})`,
	}
}

export function PhoneRoom({
	L,
	on,
}: { L: PhoneRoomLayout | null; on: boolean }) {
	const first = !L
	/** The first paint's class of a part, which living-room.css places; once measured, the part's own style. */
	const f = (part: string) => (first ? `tvr-f-up tvr-f-${part}` : "")
	const photo = (
		style: CSSProperties | undefined,
		part: string,
		lead: boolean,
	) => (
		<picture>
			{/* Before the window is measured: nothing is asked for where the phone's room is not drawn. */}
			{first && <source media={NOT_UPRIGHT_PHONE} srcSet={NO_PICTURE} />}
			<source type="image/avif" srcSet={assetUrl(PHONE_ROOM_ART.avif)} />
			<img
				{...(lead && { fetchpriority: "high" })}
				{...HERO_TIMING}
				src={assetUrl(PHONE_ROOM_ART.webp)}
				alt=""
				aria-hidden
				className={`absolute max-w-none select-none ${first ? `tvr-f-${part}` : ""}`}
				style={style}
				draggable={false}
			/>
		</picture>
	)
	const outer = L?.outer
	const middle = outer ? outer.left + outer.width / 2 : 0
	return (
		<>
			{/* The wall is the photo above the soundbar, stretched to our TV's height. */}
			<div
				className={`absolute inset-x-0 top-0 overflow-hidden ${f("wall")}`}
				style={L ? { height: L.seam } : undefined}
				role="img"
				aria-label={PHONE_ROOM.alt}
			>
				{photo(L ? stretched(L.wall) : undefined, "wallimg", true)}
			</div>
			{/* The furniture follows unstretched. */}
			<div
				className={`absolute inset-x-0 bottom-0 overflow-hidden ${f("floor")}`}
				style={L ? { top: L.seam } : undefined}
			>
				{photo(L?.floor, "floorimg", false)}
			</div>
			{/* The lights are low, and lower with the TV off; they fall off toward the corners. Plain layers, no blend mode. */}
			<div
				className={`tvr-dim absolute inset-0 ${f("dim")}`}
				style={{ opacity: on ? 0.3 : 0.62 }}
			/>
			<div
				className={`absolute inset-0 ${f("pgrad")}`}
				style={
					L && outer
						? {
								background: `radial-gradient(95% 62% at 50% ${((outer.top + outer.height / 2) / L.h) * 100}%, rgba(5,6,10,0) 42%, rgba(5,6,10,.5) 100%)`,
							}
						: undefined
				}
			/>
			{/* The stand: a neck and a foot, down to the soundbar. */}
			<div
				className={`absolute bg-gradient-to-b from-[#2b2d33] to-[#141518] ${f("neck")}`}
				style={
					outer
						? {
								left: middle - 20,
								top: outer.top + outer.height - 1,
								width: 40,
								height: PHONE_STAND + 2,
							}
						: undefined
				}
			/>
			<div
				className={`absolute rounded-[2px] bg-[#1d1e22] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_3px_6px_rgba(0,0,0,.6)] ${f("foot")}`}
				style={
					L
						? { left: middle - 62, top: L.seam - 2, width: 124, height: 5 }
						: undefined
				}
			/>
			{/* The TV's body: a thin dark bezel, and its light on the wall while it is on. */}
			<div
				data-tv-body
				data-tv-power={on ? "on" : "off"}
				className={`tvr-body absolute rounded-[8px] bg-gradient-to-b from-[#1a1b1f] to-[#0c0d0f] ${f("pbody")}`}
				style={outer}
			/>
		</>
	)
}

/**
 * The phone's room in landscape, in front of the desktop's room photo (TvRoom.tsx draws it, so that the photo is
 * one picture for both rooms): the lights and our framed TV on the left. The TV is taller than the photo's, so
 * its lower edge stands in front of the sideboard.
 */
export function LandscapeRoom({
	L,
	on,
}: { L: LandscapeRoomLayout | null; on: boolean }) {
	const first = !L
	const f = (part: string) => (first ? `tvr-f-side tvr-f-${part}` : "")
	const outer = L?.outer
	return (
		<>
			<div
				className={`tvr-dim absolute inset-0 ${f("dim")}`}
				style={{ opacity: on ? 0.34 : 0.66 }}
			/>
			<div
				className={`absolute inset-0 ${f("lgrad")}`}
				style={
					L && outer
						? {
								background: `radial-gradient(70% 95% at ${((outer.left + outer.width / 2) / L.w) * 100}% 50%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)`,
							}
						: undefined
				}
			/>
			<div
				data-tv-body
				data-tv-power={on ? "on" : "off"}
				className={`tvr-body absolute rounded-[8px] bg-gradient-to-b from-[#1a1b1f] to-[#0c0d0f] ${f("lbody")}`}
				style={outer}
			/>
		</>
	)
}
