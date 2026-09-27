// Colors of the map: islands' tints as 0 to 1 channels, and the heat of a taste match.

export type Rgb = [number, number, number]

export const hexRgb = (hex: string): Rgb => [
	Number.parseInt(hex.slice(1, 3), 16) / 255,
	Number.parseInt(hex.slice(3, 5), 16) / 255,
	Number.parseInt(hex.slice(5, 7), 16) / 255,
]

export const rgbCss = (c: Rgb, alpha = 1) =>
	`rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
]

/** A color lifted to a luminous one: more saturation and a floor on brightness, so tints glow on the night sea. */
export function luminous(c: Rgb): Rgb {
	const l = (Math.max(...c) + Math.min(...c)) / 2
	const out = c.map((v) => l + (v - l) * 1.5)
	const top = Math.max(...out, 1e-3)
	const k = Math.max(0.78, top) / top
	return out.map((v) => Math.min(1, Math.max(0, v * k))) as Rgb
}

const HEAT_STOPS = ["#3f3a36", "#78716c", "#d6b36a", "#fbbf24"].map(hexRgb)

/** The color of a taste match, 50 to 99: warm gold for the best, grey for the far. */
export function matchColor(match: number) {
	const t =
		Math.min(1, Math.max(0, (match - 50) / 49)) * (HEAT_STOPS.length - 1)
	const k = Math.min(HEAT_STOPS.length - 2, Math.floor(t))
	return rgbCss(mixRgb(HEAT_STOPS[k], HEAT_STOPS[k + 1], t - k))
}
