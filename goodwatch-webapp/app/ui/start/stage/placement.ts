// Where the start page's room and its parts sit: placed by CSS from the first paint (start.css, `.start-stage`), so
// nothing waits for a script and nothing moves when scripts start.
//
// The stage is a column over the room: the search block (a fixed height per breakpoint), then the card, whose bottom
// edge stands on the floor in front of the sofa. Before the card opens, only its bottom strip shows, as the ledge on
// that floor (the floor's strip, at most LEDGE_MAX of the card), and the search block waits lower: its top at the headroom's foot (the band above it, where a guest's
// opening plays), its bottom over the window's middle. Opening lifts the block to the stage's top and grows the card
// up from the ledge's bottom edge, up to just under the block.
//
// The picture is sized so the headroom, the block, the window-to-floor strip and the foot (the space under the
// ledge, the dock's on a phone) fill the screen under the header: between 70% and 115% of the stage's width,
// centered on the sofa. On a tall screen the picture stops at 115% and the foot takes what is left.
//
// This module holds the numbers and the same arithmetic as the CSS: STAGE_SIZES are start.css's values per
// breakpoint (placement.test.ts reads them there), `sceneVars` are the scene numbers the stage puts on its element,
// and `stageLayout` gives the result in pixels for a window, for the tests and for anything that must know where
// the room is without measuring it.
import type { RoomScene } from "../room/scene"

/** The site header's height (px): the stage starts under it. */
export const HEADER = 64

/** The space between the lifted search block and the open card's top (px). */
export const CARD_AIR = 16

/** The ledge is at most this share of the open card's height, so the card always grows out of it. */
export const LEDGE_MAX = 0.75

/** How far the picture zooms: its width as a share of the stage's, at least and at most. */
export const PICTURE_MIN = 0.7
export const PICTURE_MAX = 1.15

/**
 * A length that grows with the screen's height: `clamp(min, vh% of the height + offset, max)` in px.
 */
export type VhClamp = { min: number; vh: number; offset: number; max: number }

/**
 * The stage's sizes per breakpoint, in px. Later entries override earlier ones where their media query matches.
 * - pad: the space above the lifted search block (from 1024 px: `clamp(20px, 3vh, 40px)`, written as `padVh`).
 * - headroom: the space above the search block before the card opens, as a VhClamp.
 * - block: the search block's height: the H1 (one line), the search bar (101, 115, 119 px), and the mood row (52 px,
 *   56 px from 1024 px: a 44 or 48 px row with 4 px above and below), with their margins. Re-measure it when the block
 *   changes.
 * - card: the open card's height, when the space under the lifted block holds it (a guest's; a member's is
 *   start.css's `.start-member` rules). The tap-three panel's header and its poster row fill it.
 * - foot: the least space under the ledge. Below 1024 px the dock's height (`--nav-dock-height`, `dock` when it
 *   isn't known yet) plus 10 px.
 */
export type StageSize = {
	pad: number
	padVh: { min: number; vh: number; max: number } | null
	headroom: VhClamp
	block: number
	card: number
	foot: number
	dock: boolean
}

export type StageBreakpoint = {
	media: string
	minWidth: number
	maxHeight?: number
	size: Partial<StageSize>
}

/** The dock's height before it has measured itself (navigation/MobileDock.tsx). */
export const DOCK = 72

export const STAGE_SIZES: readonly StageBreakpoint[] = [
	{
		media: "",
		minWidth: 0,
		size: {
			pad: 14,
			padVh: null,
			headroom: { min: 96, vh: 15, offset: 0, max: 200 },
			block: 211,
			card: 330,
			foot: DOCK + 10,
			dock: true,
		},
	},
	{
		media: "(min-width: 640px)",
		minWidth: 640,
		size: {
			pad: 32,
			headroom: { min: 120, vh: 17, offset: 0, max: 260 },
			block: 268,
			card: 380,
		},
	},
	{
		media: "(min-width: 1024px)",
		minWidth: 1024,
		size: {
			padVh: { min: 20, vh: 3, max: 40 },
			headroom: { min: 120, vh: 20, offset: -20, max: 260 },
			block: 281,
			card: 410,
			foot: 24,
			dock: false,
		},
	},
	{
		media: "(min-width: 1024px) and (max-height: 820px)",
		minWidth: 1024,
		maxHeight: 820,
		size: { pad: 20, padVh: null, block: 249, card: 378 },
	},
]

/** The stage's sizes in a window of vw × vh px. */
export function stageSizeAt(vw: number, vh: number): StageSize {
	let size = {} as StageSize
	for (const bp of STAGE_SIZES) {
		if (vw < bp.minWidth) continue
		if (bp.maxHeight !== undefined && vh > bp.maxHeight) continue
		size = { ...size, ...bp.size }
	}
	return size
}

/** The scene's numbers the CSS works with: `hw` is the picture's height per width, the rest shares of its height. */
export function sceneVars(scene: RoomScene) {
	const round = (v: number) => Number(v.toFixed(5))
	return {
		hw: round(scene.height / scene.width),
		/** The sofa's center across, as a share of the picture's width. */
		fcx: round(scene.fcx),
		/** The window's top: the night above the room fades out by it. */
		wtop: scene.window.top,
		/** The window's middle: where the waiting search block ends. */
		win: scene.window.middle,
		/** The ledge's floor strip: its top and bottom. */
		lt: scene.floor.top,
		lb: scene.floor.bottom,
	}
}

/** The custom properties of `sceneVars` for both scenes, for the stage's `style` (`--start-landscape-hw`, …). */
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

const clamp = (min: number, v: number, max: number) =>
	Math.min(max, Math.max(min, v))

/**
 * The stage in px for a window of vw × vh px (`width` is the stage's width: the window without a scrollbar), as
 * start.css computes it. `cardWant` is the open card's height when there's room for it (a guest's by default).
 */
export function stageLayout(
	scene: RoomScene,
	vw: number,
	vh: number,
	{ width = vw, cardWant }: { width?: number; cardWant?: number } = {},
) {
	const size = stageSizeAt(vw, vh)
	const v = sceneVars(scene)
	const pad = size.padVh
		? clamp(size.padVh.min, (size.padVh.vh * vh) / 100, size.padVh.max)
		: size.pad
	const h = size.headroom
	const headroom = clamp(h.min, (h.vh * vh) / 100 + h.offset, h.max)
	const screen = vh - HEADER
	const fit = (screen - size.foot - headroom - size.block) / (v.lb - v.win)
	const imgW = clamp(PICTURE_MIN * width, fit / v.hw, PICTURE_MAX * width)
	const imgH = imgW * v.hw
	const imgTop = headroom + size.block - imgH * v.win
	const imgLeft = width / 2 - imgW * v.fcx
	const ledgeBottom = imgTop + imgH * v.lb
	const card = Math.min(
		cardWant ?? size.card,
		ledgeBottom - pad - size.block - CARD_AIR,
	)
	const ledgeTop =
		ledgeBottom - Math.min(imgH * (v.lb - v.lt), card * LEDGE_MAX)
	return {
		size,
		pad,
		headroom,
		img: { left: imgLeft, top: imgTop, width: imgW, height: imgH },
		/** The block's top while it waits, and once the card is open. */
		block: { waiting: headroom, open: pad },
		ledge: { top: ledgeTop, bottom: ledgeBottom },
		/** The open card's box: its bottom is the ledge's. */
		card: { top: ledgeBottom - card, height: card },
		/** The stage's height: the screen under the header (the foot takes what the column leaves). */
		height: Math.max(screen, ledgeBottom + size.foot),
	}
}
