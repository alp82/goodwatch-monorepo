// PROTOTYPE (start page lab, 2026-10-27): a generated living room scene and where its TV screen and poster slots are.
// Written by the scene scripts (scripts/prototype-start-lab/scene-slots-*.py) next to each image in
// public/prototype-start-lab/scenes/<id>.json. Every coordinate is normalized 0..1 by the image's width and height.

/** Four corners: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [[number, number], [number, number], [number, number], [number, number]]

export type SceneRegion = {
	quad: Quad
	/** x, y, w, h */
	box: [number, number, number, number]
}

export type SceneSlot = SceneRegion & {
	/** A wall frame, a case standing face-out on a shelf, or a case lying on a table. */
	kind: "frame" | "case-shelf" | "case-table" | string
}

export type SceneMeta = {
	id: string
	title: string
	perspective: string
	style: string
	orientation: "landscape" | "portrait"
	width: number
	height: number
	/** Null for a scene without a TV (the round 2 stage scenes). */
	tv: SceneRegion | null
	slots: SceneSlot[]
	/** Stage scenes (round 7): the box (x, y, w, h) around the dog and its seat, which the page keeps visible
	 * between the search chips and the results. */
	focus?: [number, number, number, number]
	notes?: string
}

/** A landscape scene and, when there is one, its phone version (`<id>-portrait`). */
export type ScenePair = {
	id: string
	landscape: SceneMeta
	portrait: SceneMeta | null
}

export const sceneImage = (id: string, ext: "avif" | "webp") => `/prototype-start-lab/scenes/${id}.${ext}`
