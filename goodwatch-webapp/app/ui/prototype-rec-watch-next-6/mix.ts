// PROTOTYPE - throwaway. The mood as picked swatches for /prototype/rec-watch-next-6 (#176, round 6).
// One swatch is a named mood; two swatches blend, and `w` says how far the blend leans from the first
// toward the second. The page holds one Mix so every place that shows the mood (strip, folded line,
// popover, bottom dock) agrees. It turns into round 5's point in mood space for ranking.
import type { M } from "~/ui/prototype-rec-watch-next-5/kit5"
import { ANCHOR, HUE, LONG, NAME, PATH } from "~/ui/prototype-rec-watch-next-5/mood"
import type { Mood } from "~/ui/prototype-rec-watch-next-2/model"

export type Mix = { picks: Mood[]; w: number }
export const NONE: Mix = { picks: [], w: 0.5 }

export function blendName(a: Mood, b: Mood, k: number) {
	if (k < 0.2) return LONG[a]
	if (k > 0.8) return LONG[b]
	if (Math.abs(k - 0.5) < 0.12) return `${NAME[a]} and ${NAME[b].toLowerCase()}`
	return k < 0.5 ? `${NAME[a]}, a little ${NAME[b].toLowerCase()}` : `${NAME[b]}, a little ${NAME[a].toLowerCase()}`
}

export function toM(x: Mix): M {
	const [a, b] = x.picks
	if (!a) return null
	if (!b) return { p: ANCHOR[a], s: null, name: LONG[a] }
	const k = x.w
	return { p: { x: ANCHOR[a].x + (ANCHOR[b].x - ANCHOR[a].x) * k, y: ANCHOR[a].y + (ANCHOR[b].y - ANCHOR[a].y) * k }, s: null, name: blendName(a, b, k) }
}

// Tap a swatch: add it (keeping the last two, in path order), or take it away.
export function tapMix(x: Mix, m: Mood): Mix {
	const picks = (x.picks.includes(m) ? x.picks.filter((p) => p !== m) : [...x.picks, m].slice(-2)).sort((a, b) => PATH.indexOf(a) - PATH.indexOf(b))
	return { picks, w: 0.5 }
}

const rgb = (h: string) => [1, 3, 5].map((j) => Number.parseInt(h.slice(j, j + 2), 16))
export function mixHex(a: string, b: string, k: number) {
	const pa = rgb(a)
	const pb = rgb(b)
	return `#${pa.map((v, j) => Math.round(v + (pb[j] - v) * k).toString(16).padStart(2, "0")).join("")}`
}

// The colour of the mix: the swatch, or the two blended.
export function mixHue(x: Mix, none = "#9ca3af") {
	const [a, b] = x.picks
	if (!a) return none
	if (!b) return HUE[a]
	return mixHex(HUE[a], HUE[b], x.w)
}

// Black or white text on a colour, by its luminance.
export function inkOn(hex: string) {
	const [r, g, b] = rgb(hex).map((v) => {
		const c = v / 255
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? "#030712" : "#ffffff"
}
