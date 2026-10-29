// Where the start page's room sits: placed by CSS from the first paint (start.css, `.start-stage`), so nothing waits
// for a script and nothing moves when scripts start.
//
// The stage is a column: the search block (a fixed height per breakpoint), a gap, and the card (a fixed height per
// breakpoint). The room's picture is as wide as the stage, and the top half of the scene's focus box (the sofa's
// cushions, FOCUS_BAND) is centered in the gap, with a little air above and below it. The gap is at least that band
// tall and takes the screen's spare height up to GAP_CAP; from 1024 px wide the band's need is capped too, and the
// picture zooms out (never in) to keep the band in the gap.
//
// This module holds the numbers and the same arithmetic as the CSS: STAGE_SIZES are start.css's values per
// breakpoint (placement.test.ts reads them there), `sceneVars` are the scene numbers the stage puts on its element,
// and `stageLayout` gives the result in pixels for a window, for the tests and for anything that must know where
// the room is without measuring it.
import type { RoomScene } from "../room/scene"

/** The part of the focus box, from its top, that the gap shows: the cushions, not the seat's base. */
export const FOCUS_BAND = 0.5

/** The most spare height the gap takes, and the band's cap from 1024 px wide (px). */
export const GAP_CAP = 300

/**
 * The stage's sizes per breakpoint, in px. Later entries override earlier ones where their media query matches.
 * - pad: the space above the search block (from 1024 px: `clamp(20px, 3vh, 48px)`, written as `padVh`).
 * - block: the search block's height: the H1 (one line), the search bar (101, 115, 119 px), and the mood row (52 px,
 *   56 px from 1024 px: a 44 or 48 px row with 4 px above and below), with their margins. Re-measure it when the block
 *   changes.
 * - card, cardBottom: the card's height and the space under it. The card's header and its poster row fill it
 *   (spotlight/spotlight.css, spotlight/poster-fit.ts): on phones a 68 px header, 14 px of room above the posters,
 *   posters up to 88 px wide (132 px tall, four per view) and the page dots' 52 px under them.
 * - gapMin, airAbove, airBelow: the gap's least height, and the air the focus band keeps from its edges.
 * - nightTop: where the night above the room starts to fade.
 * - capBand: the band's need is capped at GAP_CAP (the picture zooms out past it).
 */
export type StageSize = {
	pad: number
	padVh: { min: number; vh: number; max: number } | null
	block: number
	card: number
	cardBottom: number
	gapMin: number
	airAbove: number
	airBelow: number
	nightTop: number
	capBand: boolean
}

export type StageBreakpoint = {
	media: string
	minWidth: number
	maxHeight?: number
	minHeight?: number
	size: Partial<StageSize>
}

export const STAGE_SIZES: readonly StageBreakpoint[] = [
	{
		media: "",
		minWidth: 0,
		size: {
			pad: 12,
			padVh: null,
			block: 211,
			card: 266,
			cardBottom: 64,
			gapMin: 64,
			airAbove: 8,
			airBelow: 6,
			nightTop: 110,
			capBand: false,
		},
	},
	{
		media: "(min-width: 640px)",
		minWidth: 640,
		size: {
			pad: 44,
			block: 268,
			card: 356,
			cardBottom: 72,
			gapMin: 80,
			airAbove: 10,
			airBelow: 7,
			nightTop: 140,
		},
	},
	{
		media: "(min-width: 1024px)",
		minWidth: 1024,
		size: {
			padVh: { min: 20, vh: 3, max: 48 },
			block: 281,
			card: 420,
			gapMin: 100,
			airAbove: 12,
			airBelow: 8,
			nightTop: 200,
			capBand: true,
		},
	},
	{
		media: "(min-width: 1024px) and (max-height: 820px)",
		minWidth: 1024,
		maxHeight: 820,
		size: { pad: 20, padVh: null, block: 249, card: 378 },
	},
	{
		media: "(min-width: 1600px) and (min-height: 1000px)",
		minWidth: 1600,
		minHeight: 1000,
		size: { card: 436 },
	},
]

/** The stage's sizes in a window of vw × vh px. */
export function stageSizeAt(vw: number, vh: number): StageSize {
	let size = {} as StageSize
	for (const bp of STAGE_SIZES) {
		if (vw < bp.minWidth) continue
		if (bp.maxHeight !== undefined && vh > bp.maxHeight) continue
		if (bp.minHeight !== undefined && vh < bp.minHeight) continue
		size = { ...size, ...bp.size }
	}
	return size
}

/** The scene's numbers the CSS works with, as fractions of the picture's width (its height is `hw` of it). */
export function sceneVars(scene: RoomScene) {
	const [fx, fy, fw, fh] = scene.focus
	const hw = scene.height / scene.width
	const band = FOCUS_BAND * fh * hw
	const round = (v: number) => Number(v.toFixed(5))
	return {
		/** The focus band's height. */
		band: round(band),
		/** The picture's width per px of room for the band: zoomed out, the picture is `room × k` wide. */
		k: round(1 / band),
		hw: round(hw),
		/** The focus box's top. */
		fy: round(fy * hw),
		/** The focus box's center, across. */
		fcx: round(fx + fw / 2),
	}
}

/** The custom properties of `sceneVars` for both scenes, for the stage's `style` (`--start-landscape-band`, …). */
export function sceneStyle(
	landscape: RoomScene,
	phone: RoomScene,
): Record<string, string> {
	const out: Record<string, string> = {}
	for (const [name, scene] of [
		["landscape", landscape],
		["phone", phone],
	] as const)
		for (const [key, value] of Object.entries(sceneVars(scene)))
			out[`--start-${name}-${key}`] = String(value)
	return out
}

/**
 * The stage in px for a window of vw × vh px (`width` is the stage's width: the window without a scrollbar), as
 * start.css computes it.
 */
export function stageLayout(
	scene: RoomScene,
	vw: number,
	vh: number,
	width = vw,
) {
	const size = stageSizeAt(vw, vh)
	const v = sceneVars(scene)
	const pad = size.padVh
		? Math.min(
				size.padVh.max,
				Math.max(size.padVh.min, (size.padVh.vh * vh) / 100),
			)
		: size.pad
	const bandNeed = Math.max(
		size.gapMin,
		v.band * width + size.airAbove + size.airBelow,
	)
	const need = size.capBand ? Math.min(GAP_CAP, bandNeed) : bandNeed
	const spare = vh - 64 - pad - size.block - size.card - size.cardBottom
	const gap = Math.max(need, Math.min(GAP_CAP, spare))
	const gapTop = pad + size.block
	const room = gap - size.airAbove - size.airBelow
	const imgW = Math.min(width, room * v.k)
	const imgH = imgW * v.hw
	const focusTop = gapTop + size.airAbove + (room - imgW * v.band) / 2
	const imgTop = focusTop - imgW * v.fy
	const imgLeft = Math.min(width - imgW, Math.max(0, width / 2 - imgW * v.fcx))
	return {
		size,
		pad,
		gapTop,
		gap,
		/** The focus band's box in the stage. */
		band: { top: focusTop, height: imgW * v.band },
		img: { left: imgLeft, top: imgTop, width: imgW, height: imgH },
		/** The stage's height: the column, or the screen under the header when that is taller. */
		height: Math.max(vh - 64, gapTop + gap + size.card + size.cardBottom),
	}
}
