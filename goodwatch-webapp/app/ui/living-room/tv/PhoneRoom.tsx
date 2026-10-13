// The phone's room: the same room as the desktop's, on one screen without scrolling. From the top: the teal wall
// with the TV on it (a bezel, a stand, its light on the wall), the soundbar and the walnut sideboard under it.
// This is everything of it that is behind the picture; the scene (TvRoom.tsx) puts the picture and the Remote
// in front. The wall and the furniture are the portrait room photo, drawn twice from one file.
import { assetUrl } from "~/utils/asset-url"
import { PHONE_ROOM, ROOM } from "../room"
import { PHONE_ROOM_ART, ROOM_ART } from "./room-art"
import {
	type LandscapeRoomLayout,
	PHONE_STAND,
	type PhoneRoomLayout,
	ROOM_PHOTO,
	type Rect,
} from "./room-layout"

export function PhoneRoom({ L, on }: { L: PhoneRoomLayout; on: boolean }) {
	const photo = (style: Rect, first: boolean) => (
		<picture>
			<source type="image/avif" srcSet={assetUrl(PHONE_ROOM_ART.avif)} />
			<img
				{...(first && { fetchpriority: "high" })}
				src={assetUrl(PHONE_ROOM_ART.webp)}
				alt=""
				aria-hidden
				className="absolute max-w-none select-none"
				style={style}
				draggable={false}
			/>
		</picture>
	)
	const { outer } = L
	const middle = outer.left + outer.width / 2
	return (
		<>
			{/* The wall is the photo above the soundbar, stretched to our TV's height. */}
			<div
				className="absolute inset-x-0 top-0 overflow-hidden"
				style={{ height: L.seam }}
				role="img"
				aria-label={PHONE_ROOM.alt}
			>
				{photo(L.wall, true)}
			</div>
			{/* The furniture follows unstretched. */}
			<div
				className="absolute inset-x-0 bottom-0 overflow-hidden"
				style={{ top: L.seam }}
			>
				{photo(L.floor, false)}
			</div>
			{/* The lights are low, and lower with the TV off; they fall off toward the corners. Plain layers, no blend mode. */}
			<div
				className="tvr-dim absolute inset-0"
				style={{ opacity: on ? 0.3 : 0.62 }}
			/>
			<div
				className="absolute inset-0"
				style={{
					background: `radial-gradient(95% 62% at 50% ${((outer.top + outer.height / 2) / L.h) * 100}%, rgba(5,6,10,0) 42%, rgba(5,6,10,.5) 100%)`,
				}}
			/>
			{/* The stand: a neck and a foot, down to the soundbar. */}
			<div
				className="absolute bg-gradient-to-b from-[#2b2d33] to-[#141518]"
				style={{
					left: middle - 20,
					top: outer.top + outer.height - 1,
					width: 40,
					height: PHONE_STAND + 2,
				}}
			/>
			<div
				className="absolute rounded-[2px] bg-[#1d1e22] shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_3px_6px_rgba(0,0,0,.6)]"
				style={{ left: middle - 62, top: L.seam - 2, width: 124, height: 5 }}
			/>
			{/* The TV's body: a thin dark bezel, and its light on the wall while it is on. */}
			<div
				data-tv-body
				data-tv-power={on ? "on" : "off"}
				className="tvr-body absolute rounded-[8px] bg-gradient-to-b from-[#1a1b1f] to-[#0c0d0f]"
				style={outer}
			/>
		</>
	)
}

/**
 * The phone's room in landscape: the desktop's room photo with our framed TV in front of its TV, on the left.
 * The TV is taller than the photo's, so its lower edge stands in front of the sideboard.
 */
export function LandscapeRoom({
	L,
	on,
}: { L: LandscapeRoomLayout; on: boolean }) {
	const { outer } = L
	return (
		<>
			<div className="absolute" style={L.photo}>
				<picture>
					<source type="image/avif" srcSet={assetUrl(ROOM_ART.avif)} />
					<img
						{...{ fetchpriority: "high" }}
						src={assetUrl(ROOM_ART.webp)}
						alt={ROOM.alt}
						width={ROOM_PHOTO.w}
						height={ROOM_PHOTO.h}
						className="absolute inset-0 h-full w-full select-none"
						draggable={false}
					/>
				</picture>
			</div>
			<div
				className="tvr-dim absolute inset-0"
				style={{ opacity: on ? 0.34 : 0.66 }}
			/>
			<div
				className="absolute inset-0"
				style={{
					background: `radial-gradient(70% 95% at ${((outer.left + outer.width / 2) / L.w) * 100}% 50%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)`,
				}}
			/>
			<div
				data-tv-body
				data-tv-power={on ? "on" : "off"}
				className="tvr-body absolute rounded-[8px] bg-gradient-to-b from-[#1a1b1f] to-[#0c0d0f]"
				style={outer}
			/>
		</>
	)
}
