// PROTOTYPE (start page lab, round 12): mood lighting b, c and d as tables. b is a's grade (jk-grade GRADES) at about
// twice the color and darkening; c adds film effects per mood (EFFECTS); d adds letterbox bars and dimmed shelf lights
// for the dramatic moods (CINEMA). Every value is a layer's opacity; layers only ever fade (opacity) or slide (transform).
// Round 13: c (and d, built on it) grade the bright moods at about a third of b (GRADES_FILM; "the bright ones are way
// too extreme"), and get six more effects: dust, sweep, fog, flicker, sepia, moon. "mystery" is a grade of its own
// (crime's layers; c adds fog), for the mystery themes and genre and a reading's mystery and intrigue.
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

/** "mystery" grades as crime in a and b (jk-grade maps mystery choices to it; c adds its fog). */
GRADES_STRONG.mystery = GRADES_STRONG.crime

/**
 * c and d · the grade: b's, with the bright moods at about a third of b (a gentle lift, not a wash). Scary and
 * crime (and every other mood) keep b's.
 */
export const GRADES_FILM: Record<string, Layer[]> = {
	...GRADES_STRONG,
	//            b: soft-light .9, screen .2
	feelgood: [
		{ bg: hue("feelgood"), blend: "soft-light", o: 0.32 },
		{ bg: "rgb(255 196 130)", blend: "screen", o: 0.07 },
	],
	//            b: soft-light .8, screen .16
	funny: [
		{ bg: hue("funny"), blend: "soft-light", o: 0.28 },
		{ bg: "rgb(255 236 150)", blend: "screen", o: 0.06 },
	],
	//            b: soft-light .9, screen .14
	romance: [
		{ bg: hue("romance"), blend: "soft-light", o: 0.32 },
		{ bg: "rgb(255 150 190)", blend: "screen", o: 0.05 },
	],
	//            b: soft-light .88, multiply .36
	worlds: [
		{ bg: hue("worlds"), blend: "soft-light", o: 0.3 },
		{ bg: "rgb(20 60 80)", blend: "multiply", o: 0.14 },
	],
	//            b: soft-light .72, screen .18
	growing: [
		{ bg: hue("growing"), blend: "soft-light", o: 0.25 },
		{ bg: "rgb(255 220 250)", blend: "screen", o: 0.06 },
	],
}

/** b · a vocabulary choice without its own grade tints with its own color (a: .4). */
export const COLOR_STRONG = 0.72

/** The film effects c and d can lay over the room. */
export type Effect = "grain" | "vignette" | "bloom" | "scan" | "contrast" | "dust" | "sweep" | "fog" | "flicker" | "sepia" | "moon"

/**
 * c · FILM EFFECTS per mood (on top of c's grade, GRADES_FILM), as opacities:
 * - grain: animated film grain (a tiled noise image, stepped with transform), overlay-blended.
 * - vignette: dark edges (a static radial gradient).
 * - bloom: the scene's bright parts (lamps, fairy lights, windows) blurred and screened back over it; drawn once.
 * - scan: thin scanlines, a slow rolling band, and a magenta/cyan edge tint.
 * - contrast: the scene soft-lit with itself (an S curve: darker darks, brighter lights).
 * Round 13:
 * - dust: soft motes drifting slowly up through the lamp's light (two tiled canvases, translated; masked to the lamp).
 * - sweep: a soft diagonal band of light that crosses the room every few seconds (translated).
 * - fog: a faint cool haze over the floor and the seat, drifting sideways (a tiled gradient, translated).
 * - flicker: the lamp's warm glow breathing a little (an opacity loop on a static radial).
 * - sepia: a brown color cast (static).
 * - moon: cool blue light falling from the window over the seat (static).
 * The lamp is found in each scene (its brightest spot off the side shelves); the window sits over the focus (the seat).
 */
export const EFFECTS: Record<string, Partial<Record<Effect, number>>> = {
	//            r12: bloom .75
	feelgood: { bloom: 0.25, flicker: 0.7 },
	//            r12: bloom .35
	funny: { bloom: 0.12, sweep: 0.3 },
	//            r12: bloom .85, vignette .35
	romance: { bloom: 0.28, vignette: 0.35, flicker: 0.6 },
	action: { contrast: 0.85, vignette: 0.35, sweep: 0.6 },
	scary: { grain: 0.26, vignette: 0.95 },
	crime: { grain: 0.18, vignette: 0.6, contrast: 0.4 },
	// Crime's effects plus the fog.
	mystery: { grain: 0.18, vignette: 0.6, contrast: 0.4, fog: 0.8 },
	mind: { scan: 1, moon: 0.45 },
	heavy: { vignette: 0.85, grain: 0.1, dust: 0.65 },
	//            r12: bloom .4
	worlds: { bloom: 0.14, moon: 0.75 },
	history: { grain: 0.14, vignette: 0.45, dust: 0.5, sepia: 0.45 },
	//            r12: bloom .45
	growing: { bloom: 0.15, dust: 0.35 },
}

/**
 * d · CINEMATIC per mood (on top of c): letterbox bars slide in at the room's top and bottom (true/false), and the
 * shelf lights at the sides dim (opacity of a dark side gradient).
 */
export const CINEMA: Record<string, { bars: boolean; shelves: number }> = {
	scary: { bars: true, shelves: 0.85 },
	crime: { bars: true, shelves: 0.7 },
	mystery: { bars: true, shelves: 0.7 },
	action: { bars: true, shelves: 0.5 },
	heavy: { bars: true, shelves: 0.75 },
}

/** The chosen mood lighting: the URL's, else the round's default, else "a"; an unknown key falls back to "a". */
export function lightKeyOf(choice: Choice): string {
	const want = choice.light ?? DEFAULTS[choice.round].light ?? "a"
	return VARIANTS.some((v) => v.key === want) ? want : "a"
}
