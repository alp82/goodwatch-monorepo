// The room behind the start page's stage: the painting (the phone's on an upright phone), the shelf covers, and the
// night over them, in one box that scales (the camera). start.css places the painting from the first paint.
//
// - Both paintings are in the HTML, since the page cache forbids choosing by device; a `<source>` matching the other
//   window points at NO_PICTURE, so each window asks for one file. The server's 103 response preloads the one the
//   device likely draws (server/early-hints.ts). The painting is the first screen's largest picture (LCP): it is
//   never hidden or faded itself; only the night over it changes.
// - `night` (0 lit, 1 black) and `camera` (the scale) are the room's light and framing; their changes ease
//   (start.css). Layers that tint the room (the mood grade) go in `children`, between the room and the night.
import type { CSSProperties, ReactNode } from "react"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { HERO_TIMING } from "~/utils/start-after-paint"
import {
	NOT_UPRIGHT_PHONE,
	NO_PICTURE,
	UPRIGHT_PHONE,
} from "~/utils/upright-phone"
import { ShelfCovers, type ShelfTitle } from "./ShelfCovers"
import { START_ROOM_ART, START_ROOM_PHONE_ART } from "./room-pictures"
import { START_ROOM, START_ROOM_PHONE } from "./scene"

export function StartRoom({
	night,
	camera,
	titles,
	children,
}: {
	night: number
	camera: number
	/** The titles on the shelf, in slot order. */
	titles: readonly ShelfTitle[]
	children?: ReactNode
}) {
	return (
		<div
			className="start-camera"
			style={
				{ "--start-night": night, "--start-camera": camera } as CSSProperties
			}
		>
			<RoomPicture
				className="start-room-landscape"
				other={UPRIGHT_PHONE}
				art={START_ROOM_ART}
				scene={START_ROOM}
			/>
			<RoomPicture
				className="start-room-phone"
				other={NOT_UPRIGHT_PHONE}
				art={START_ROOM_PHONE_ART}
				scene={START_ROOM_PHONE}
			/>
			<ShelfCovers titles={titles} />
			{children}
			<div aria-hidden className="start-night" />
		</div>
	)
}

function RoomPicture({
	className,
	other,
	art,
	scene,
}: {
	className: string
	/** Where the other painting is drawn: there this one asks for nothing. */
	other: string
	art: { avif: string; webp: string }
	scene: { width: number; height: number }
}) {
	// Without credentials on the static hostname, as the 103 Early Hints response preloads it.
	const crossOrigin = assetBase() ? "anonymous" : undefined
	return (
		<picture className={`start-room-picture ${className}`}>
			<source media={other} srcSet={NO_PICTURE} />
			<source type="image/avif" srcSet={assetUrl(art.avif)} />
			<img
				{...{ fetchpriority: "high" }}
				{...HERO_TIMING}
				crossOrigin={crossOrigin}
				src={assetUrl(art.webp)}
				alt=""
				width={scene.width}
				height={scene.height}
				draggable={false}
			/>
		</picture>
	)
}
