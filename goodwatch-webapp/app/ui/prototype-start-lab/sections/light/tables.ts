// PROTOTYPE (start page lab, round 12): mood lighting b, c and d as tables. b is a's grade (jk-grade GRADES) at about
// twice the color and darkening; c adds film effects per mood (EFFECTS); d adds letterbox bars and dimmed shelf lights
// for the dramatic moods (CINEMA). Every value is a layer's opacity; layers only ever fade (opacity) or slide (transform).
import { DEFAULTS } from "../../lab/choice"
import type { Choice } from "../../lab/choice"
import { moodHue } from "../stage/ab-shared"
import { VARIANTS } from "./index"

/** One full-size layer over the room, as in jk-grade: a color, how it blends, at an opacity. */
export type Layer = { bg: string; blend: "soft-light" | "screen" | "multiply" | "saturation" | "color" | "overlay"; o: number }

const GRAY = "#808080"
const hue = (k: string) => moodHue(k)

/**
 * b · STRONGER GRADE: a's layers per mood, each about twice as strong (soft-light caps at 1, so the warm moods also
 * get a second light layer). The darkening moods (scary, crime, heavy, action) multiply about twice as deep.
 */
export const GRADES_STRONG: Record<string, Layer[]> = {
	//            a: soft-light .5, screen .1
	feelgood: [
		{ bg: hue("feelgood"), blend: "soft-light", o: 0.9 },
		{ bg: "rgb(255 196 130)", blend: "screen", o: 0.2 },
	],
	//            a: soft-light .42, screen .08
	funny: [
		{ bg: hue("funny"), blend: "soft-light", o: 0.8 },
		{ bg: "rgb(255 236 150)", blend: "screen", o: 0.16 },
	],
	//            a: soft-light .5, screen .06
	romance: [
		{ bg: hue("romance"), blend: "soft-light", o: 0.9 },
		{ bg: "rgb(255 150 190)", blend: "screen", o: 0.14 },
	],
	//            a: overlay .24, soft-light dark .45
	action: [
		{ bg: hue("action"), blend: "overlay", o: 0.46 },
		{ bg: "rgb(40 10 10)", blend: "soft-light", o: 0.85 },
	],
	//            a: saturation .45, multiply .55, soft-light .16
	scary: [
		{ bg: GRAY, blend: "saturation", o: 0.75 },
		{ bg: "rgb(30 52 72)", blend: "multiply", o: 0.88 },
		{ bg: hue("scary"), blend: "soft-light", o: 0.32 },
	],
	//            a: saturation .45, color .32, multiply .32
	crime: [
		{ bg: GRAY, blend: "saturation", o: 0.8 },
		{ bg: hue("crime"), blend: "color", o: 0.6 },
		{ bg: "rgb(20 30 50)", blend: "multiply", o: 0.62 },
	],
	//            a: color .26, soft-light .4
	mind: [
		{ bg: hue("mind"), blend: "color", o: 0.5 },
		{ bg: hue("mind"), blend: "soft-light", o: 0.78 },
	],
	//            a: saturation .6, multiply .38
	heavy: [
		{ bg: GRAY, blend: "saturation", o: 0.92 },
		{ bg: "rgb(52 58 70)", blend: "multiply", o: 0.72 },
	],
	//            a: soft-light .45, multiply .18
	worlds: [
		{ bg: hue("worlds"), blend: "soft-light", o: 0.88 },
		{ bg: "rgb(20 60 80)", blend: "multiply", o: 0.36 },
	],
	//            a: saturation .4, soft-light .55
	history: [
		{ bg: GRAY, blend: "saturation", o: 0.72 },
		{ bg: hue("history"), blend: "soft-light", o: 1 },
	],
	//            a: soft-light .38, screen .09
	growing: [
		{ bg: hue("growing"), blend: "soft-light", o: 0.72 },
		{ bg: "rgb(255 220 250)", blend: "screen", o: 0.18 },
	],
}

/** b · a vocabulary choice without its own grade tints with its own color (a: .4). */
export const COLOR_STRONG = 0.72

/** The film effects c and d can lay over the room. */
export type Effect = "grain" | "vignette" | "bloom" | "scan" | "contrast"

/**
 * c · FILM EFFECTS per mood (on top of b's grade), as opacities:
 * - grain: animated film grain (a tiled noise image, stepped with transform), overlay-blended.
 * - vignette: dark edges (a static radial gradient).
 * - bloom: the scene's bright parts (lamps, fairy lights, windows) blurred and screened back over it; drawn once.
 * - scan: thin scanlines, a slow rolling band, and a magenta/cyan edge tint.
 * - contrast: the scene soft-lit with itself (an S curve: darker darks, brighter lights).
 */
export const EFFECTS: Record<string, Partial<Record<Effect, number>>> = {
	feelgood: { bloom: 0.75 },
	funny: { bloom: 0.35 },
	romance: { bloom: 0.85, vignette: 0.35 },
	action: { contrast: 0.85, vignette: 0.35 },
	scary: { grain: 0.26, vignette: 0.95 },
	crime: { grain: 0.18, vignette: 0.6, contrast: 0.4 },
	mind: { scan: 1 },
	heavy: { vignette: 0.85, grain: 0.1 },
	worlds: { bloom: 0.4 },
	history: { grain: 0.14, vignette: 0.45 },
	growing: { bloom: 0.45 },
}

/**
 * d · CINEMATIC per mood (on top of c): letterbox bars slide in at the room's top and bottom (true/false), and the
 * shelf lights at the sides dim (opacity of a dark side gradient).
 */
export const CINEMA: Record<string, { bars: boolean; shelves: number }> = {
	scary: { bars: true, shelves: 0.85 },
	crime: { bars: true, shelves: 0.7 },
	action: { bars: true, shelves: 0.5 },
	heavy: { bars: true, shelves: 0.75 },
}

/** The chosen mood lighting: the URL's, else the round's default, else "a"; an unknown key falls back to "a". */
export function lightKeyOf(choice: Choice): string {
	const want = choice.light ?? DEFAULTS[choice.round].light ?? "a"
	return VARIANTS.some((v) => v.key === want) ? want : "a"
}
