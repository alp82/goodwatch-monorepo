// The start page's room: two paintings of the same sofa nook (app/img/start-room/), one for desktops and landscape
// screens, one for upright phones, and the TV corner of the same room for How it works.
//
// Every coordinate is normalized 0..1 by the picture's width and height.
// - `slots`: the face-out Blu-ray cases on the bookcases, where the shelf covers go (ShelfCovers.tsx). Each has its
//   quad (top-left, top-right, bottom-right, bottom-left) and the room's light around it, read from the painting
//   once: the tint a cover is multiplied with, and the angle and strength of the shade away from the light.
// - `fcx`: the sofa's center across, which the picture keeps in the stage's middle.
// - `window` and `floor`, as shares of the picture's height (stage/placement.ts): the window's top and middle (the
//   search block ends over its middle until the card opens), and the strip of floor in front of the sofa that the
//   ledge stands on (the card grows up from its bottom edge).
import type { Quad } from "./homography"

export type SlotLight = {
	/** The room's color around the slot, dimmed by how dark that corner is: a multiply layer over the cover. */
	tint: string
	/** The CSS gradient angle the cover darkens toward (away from the light), and how dark its far edge gets (0..1). */
	shadeAngle: number
	shade: number
}

export type ShelfSlot = { quad: Quad; light: SlotLight }

export type RoomScene = {
	width: number
	height: number
	slots: readonly ShelfSlot[]
	fcx: number
	window: { top: number; middle: number }
	floor: { top: number; bottom: number }
}

const slot = (
	quad: Quad,
	[r, g, b]: [number, number, number],
	shadeAngle: number,
	shade: number,
): ShelfSlot => ({
	quad,
	light: { tint: `rgb(${r},${g},${b})`, shadeAngle, shade },
})

/** The desktop and landscape room, 1536 × 1024: 11 cases on the right-hand bookcase. */
export const START_ROOM: RoomScene = {
	width: 1536,
	height: 1024,
	fcx: 0.5,
	window: { top: 0.33, middle: 0.44 },
	floor: { top: 0.625, bottom: 0.895 },
	slots: [
		slot(
			[
				[0.8574, 0.0898],
				[0.8854, 0.084],
				[0.8828, 0.1514],
				[0.8548, 0.1553],
			],
			[216, 171, 136],
			98,
			0.2,
		),
		slot(
			[
				[0.8672, 0.5947],
				[0.8971, 0.5957],
				[0.8939, 0.665],
				[0.8639, 0.6631],
			],
			[213, 168, 136],
			87,
			0.34,
		),
		slot(
			[
				[0.8678, 0.4697],
				[0.8971, 0.4697],
				[0.8939, 0.5381],
				[0.8646, 0.5381],
			],
			[214, 167, 133],
			85,
			0.34,
		),
		slot(
			[
				[0.8698, 0.2158],
				[0.8991, 0.2119],
				[0.8958, 0.2812],
				[0.8665, 0.2832],
			],
			[219, 174, 140],
			99,
			0.19,
		),
		slot(
			[
				[0.8743, 0.3438],
				[0.903, 0.3408],
				[0.9004, 0.4092],
				[0.8711, 0.4111],
			],
			[217, 171, 138],
			114,
			0.21,
		),
		slot(
			[
				[0.8945, 0.0811],
				[0.9232, 0.0752],
				[0.9199, 0.1445],
				[0.8913, 0.1494],
			],
			[219, 173, 136],
			183,
			0.16,
		),
		slot(
			[
				[0.8965, 0.7188],
				[0.9271, 0.7217],
				[0.9232, 0.791],
				[0.8926, 0.7852],
			],
			[208, 164, 136],
			160,
			0.27,
		),
		slot(
			[
				[0.9049, 0.4697],
				[0.9342, 0.4688],
				[0.931, 0.5391],
				[0.9017, 0.5381],
			],
			[212, 167, 131],
			261,
			0.21,
		),
		slot(
			[
				[0.9049, 0.5957],
				[0.9355, 0.5967],
				[0.9323, 0.667],
				[0.9017, 0.666],
			],
			[210, 165, 135],
			154,
			0.16,
		),
		slot(
			[
				[0.9069, 0.2119],
				[0.9368, 0.207],
				[0.9336, 0.2773],
				[0.9043, 0.2803],
			],
			[217, 171, 136],
			250,
			0.18,
		),
		slot(
			[
				[0.9121, 0.3408],
				[0.9414, 0.3379],
				[0.9382, 0.4072],
				[0.9089, 0.4092],
			],
			[215, 168, 134],
			104,
			0.24,
		),
	],
}

/** The upright phone's room, 1024 × 1536: 12 cases in two columns. */
export const START_ROOM_PHONE: RoomScene = {
	width: 1024,
	height: 1536,
	fcx: 0.4903,
	window: { top: 0.29, middle: 0.42 },
	floor: { top: 0.64, bottom: 0.955 },
	slots: [
		slot(
			[
				[0.8301, 0.084],
				[0.875, 0.0768],
				[0.874, 0.1204],
				[0.8281, 0.127],
			],
			[218, 179, 147],
			288,
			0.4,
		),
		slot(
			[
				[0.8301, 0.1934],
				[0.877, 0.1882],
				[0.876, 0.2337],
				[0.8281, 0.2389],
			],
			[212, 173, 141],
			306,
			0.39,
		),
		slot(
			[
				[0.8301, 0.3118],
				[0.876, 0.3079],
				[0.875, 0.3529],
				[0.8281, 0.3561],
			],
			[210, 170, 141],
			317,
			0.4,
		),
		slot(
			[
				[0.8311, 0.4225],
				[0.876, 0.4206],
				[0.876, 0.4648],
				[0.8281, 0.4668],
			],
			[211, 170, 143],
			324,
			0.38,
		),
		slot(
			[
				[0.833, 0.5293],
				[0.877, 0.5286],
				[0.876, 0.5742],
				[0.8438, 0.5736],
			],
			[234, 194, 162],
			59,
			0.4,
		),
		slot(
			[
				[0.8447, 0.6348],
				[0.8867, 0.6367],
				[0.8857, 0.6803],
				[0.8447, 0.6771],
			],
			[212, 167, 138],
			155,
			0.18,
		),
		slot(
			[
				[0.9287, 0.1816],
				[0.9766, 0.1764],
				[0.9756, 0.2214],
				[0.9258, 0.2272],
			],
			[210, 163, 133],
			23,
			0.34,
		),
		slot(
			[
				[0.9277, 0.5286],
				[0.9746, 0.528],
				[0.9746, 0.5755],
				[0.9268, 0.5755],
			],
			[210, 163, 134],
			22,
			0.32,
		),
		slot(
			[
				[0.9277, 0.304],
				[0.9756, 0.2995],
				[0.9746, 0.3444],
				[0.9268, 0.3483],
			],
			[208, 162, 133],
			17,
			0.4,
		),
		slot(
			[
				[0.9287, 0.4173],
				[0.9756, 0.4154],
				[0.9746, 0.4609],
				[0.9268, 0.4629],
			],
			[209, 162, 134],
			14,
			0.4,
		),
		slot(
			[
				[0.9297, 0.0684],
				[0.9756, 0.0618],
				[0.9746, 0.1048],
				[0.9277, 0.1113],
			],
			[210, 164, 134],
			28,
			0.4,
		),
		slot(
			[
				[0.9297, 0.638],
				[0.9756, 0.64],
				[0.9746, 0.6862],
				[0.9287, 0.6829],
			],
			[208, 161, 132],
			39,
			0.32,
		),
	],
}

/** The room's TV corner, 1536 × 1024, for How it works: the TV screen's quad. */
export const TV_CORNER = {
	width: 1536,
	height: 1024,
	tv: [
		[0.3053, 0.2568],
		[0.5879, 0.2568],
		[0.5879, 0.5068],
		[0.3053, 0.5059],
	] as Quad,
} as const
