// What the map tells its pixel effects layer (mapEffects.ts). Types only, so the map and its engine can describe the
// effects' inputs without loading the effects, which arrive in their own chunk once the map is up.

export type EffectKind =
	/** The pointer moved onto an island. */
	| "hover"
	/** An island was picked for the combination. */
	| "pick"
	/** An island was let go. */
	| "unpick"
	/** A combination rose in the middle. */
	| "combine"
	/** A poster opened its details (the panel or the big screen). */
	| "open"
	/** The camera came to rest after a long flight, or the big screen went back into the map. */
	| "land"

export interface EffectIsland {
	id: string
	/** The island's name as shown, e.g. "Scary", "Cozy", "1980s", "Japan". */
	name: string
	/** The grouping (region) id, e.g. "mood", "theme", "style", "occasion", "decade", "country". */
	group?: string
	/** Screen position (CSS pixels) of the island's middle and its rough radius. */
	x: number
	y: number
	r: number
	/** "#rrggbb". */
	color: string
}

export interface EffectTitle {
	name: string
	year?: number | null
	/** "movie" or "tv". */
	kind?: string
}

export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

/** The live combination as the effects see it. */
export interface EffectCombination {
	/** The middle where the combination rises: screen position and radius (CSS pixels). */
	hub: { x: number; y: number; r: number }
	/** 0 while it starts rising, 1 once it's up. */
	rise: number
	/** Whether its titles have arrived. */
	ready: boolean
	/** The picked islands feeding it: screen position, radius and "#rrggbb". */
	picked: { id: string; x: number; y: number; r: number; color: string }[]
}

export interface MapEffects {
	/** The map's size in CSS pixels. */
	resize(w: number, h: number): void
	/** Every map frame: the islands on screen. The hovered one (or the one zoomed into) plays its ambient loop. */
	ambient(islands: EffectIsland[]): void
	/** A one-shot effect at a screen point. */
	burst(kind: EffectKind, x: number, y: number, opts?: { color?: string }): void
	/** Plays a title's pun effect over its poster if one matches; whether one played. */
	pun(title: EffectTitle, rect: Rect): boolean
	/** How far the map is zoomed in: the camera scale over the scale that shows one region. Pixels grow with it. */
	setZoom(z: number): void
	/** Every frame while a combination exists (null once there is none): drives its streams, warm-up, reveal and loop. */
	combination(state: EffectCombination | null): void
	/** The island the pointer is on (null when none): it plays the ambient loop. */
	setFocus(id: string | null): void
	/** Lifts the effects above the big screen while a poster is on it, so its pun shows. */
	raise(on: boolean): void
	destroy(): void
}
