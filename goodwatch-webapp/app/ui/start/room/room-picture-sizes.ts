// The HTML preload and picture use the same width as start.css, before layout or JavaScript. Keep the arithmetic
// tied to placement's breakpoint values: the room can be 70–115% of the stage, depending on the window's height.
import {
	HEADER,
	PICTURE_MAX,
	PICTURE_MIN,
	STAGE_SIZES,
	sceneVars,
	stageSizeAt,
} from "../stage/placement"
import type { RoomScene } from "./scene"

export function pictureSizes(scene: RoomScene): string {
	const v = sceneVars(scene)
	return [...STAGE_SIZES]
		.reverse()
		.map((bp) => {
			const size = stageSizeAt(
				bp.minWidth,
				bp.maxHeight ?? Number.POSITIVE_INFINITY,
			)
			const h = size.headroom
			const headroom = `clamp(${h.min}px, calc(${h.vh}svh${h.offset ? ` - ${-h.offset}px` : ""}), ${h.max}px)`
			const width = `clamp(${PICTURE_MIN * 100}vw, calc((100svh - ${HEADER}px - ${size.foot}px - ${headroom} - ${size.block}px) / ${Number((v.lb - v.win).toFixed(5))} / ${v.hw}), ${Math.round(PICTURE_MAX * 100)}vw)`
			return `${bp.media ? `${bp.media} ` : ""}${width}`
		})
		.join(", ")
}
