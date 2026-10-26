// For tests: the file a browser takes from an img's srcset and sizes, for a window width and pixel ratio. Only the
// conditions our sizes use: min-width and min-resolution, and lengths in px or calc(<px> * <factor>) or vw; or density
// descriptors (1x, 2x) without sizes.

/** The img's srcset and sizes attributes from server HTML. */
export function imageAttributes(html: string): {
	srcset: string
	sizes: string
} {
	const attr = (name: string) =>
		new RegExp(`${name}="([^"]*)"`).exec(html)?.[1] ?? ""
	return { srcset: attr("srcSet") || attr("srcset"), sizes: attr("sizes") }
}

function length(value: string, width: number): number {
	const px = /^([\d.]+)px$/.exec(value)
	if (px) return Number(px[1])
	const vw = /^([\d.]+)vw$/.exec(value)
	if (vw) return (Number(vw[1]) * width) / 100
	const calc = /^calc\((.+) \* ([\d.]+)\)$/.exec(value)
	if (calc) return length(calc[1], width) * Number(calc[2])
	throw new Error(`Unknown length ${value}`)
}

/** The slot `sizes` gives for a window. */
export function slot(sizes: string, width: number, dpr: number): number {
	for (const rule of sizes.split(", ")) {
		const cond =
			/^\((min-width|min-resolution): ([\d.]+)(px|dppx)\) (.+)$/.exec(rule)
		if (cond) {
			const value = Number.parseFloat(cond[2])
			if (cond[1] === "min-width" ? width < value : dpr < value) continue
			return length(cond[4], width)
		}
		return length(rule, width)
	}
	return 0
}

/** The file a browser takes: the smallest candidate at least slot × pixel ratio wide, or the largest. */
export function pick(html: string, width: number, dpr: number): string {
	const { srcset, sizes } = imageAttributes(html)
	// Density descriptors (a fixed width): the smallest density at or above the pixel ratio, or the largest.
	if (/ [\d.]+x(, |$)/.test(srcset)) {
		const byDensity = srcset
			.split(", ")
			.map((entry) => {
				const [url, x] = entry.split(" ")
				return { url, x: Number.parseFloat(x) }
			})
			.sort((a, b) => a.x - b.x)
		return (byDensity.find((c) => c.x >= dpr) ?? byDensity.at(-1))?.url ?? ""
	}
	const candidates = srcset.split(", ").map((entry) => {
		const [url, w] = entry.split(" ")
		return { url, w: Number.parseInt(w) }
	})
	const need = slot(sizes, width, dpr) * dpr
	return (candidates.find((c) => c.w >= need) ?? candidates.at(-1))?.url ?? ""
}

/** The TMDB size in a file's address (`w185`, `h632`). */
export const tmdbSize = (url: string) =>
	/\/t\/p\/([a-z0-9]+)\//.exec(url)?.[1] ?? ""
