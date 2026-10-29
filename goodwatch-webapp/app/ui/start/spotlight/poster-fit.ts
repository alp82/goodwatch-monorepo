// Whole posters only in the spotlight card's rows (PosterPager.tsx). Each row is a size container; per breakpoint a
// poster is at most the width the card's fixed height holds (`colMax`), shrunk just enough that a whole number fits
// the row's width. CSS container queries do it from the first paint, so nothing shifts when scripts start.
//
// spotlight.css holds `fitCss`'s output for both rows between its "poster fit" markers; poster-fit.test.ts checks that
// it's up to date and how many posters each listed screen size shows. Regenerate it with:
//   node -e 'import("./app/ui/start/spotlight/poster-fit.ts").then((m) => console.log(m.allFitCss()))'

/** One breakpoint of a row: its media query ("" for the base), the widest poster, the gap and the side padding. */
export type FitSpec = {
	media: string
	minWidth: number
	maxHeight?: number
	minHeight?: number
	colMax: number
	gap: number
	pad: number
	/**
	 * Exactly this many posters per view here, at any width: they shrink below colMax to fit, and past the width they
	 * fill at colMax the row stays that wide, centered.
	 */
	fixedN?: number
}

/** The most posters a view holds. */
const MAX_N = 12

/**
 * The results row: four whole posters per view on every phone (about 70 px at 375, at most 88 px so the card's phone
 * height holds them with the page dots under them; wider phones keep four, centered), 4 at 768, 6 at 1024 and
 * 1440 × 900, 7 on short laptops, 8 at 1920 × 1080.
 */
export const RESULTS_FIT: readonly FitSpec[] = [
	{ media: "", minWidth: 0, colMax: 88, gap: 10, pad: 16, fixedN: 4 },
	{ media: "(min-width: 640px)", minWidth: 640, colMax: 160, gap: 14, pad: 24 },
	{
		media: "(min-width: 1024px)",
		minWidth: 1024,
		colMax: 192,
		gap: 14,
		pad: 28,
	},
	{
		media: "(min-width: 1024px) and (max-height: 820px)",
		minWidth: 1024,
		maxHeight: 820,
		colMax: 168,
		gap: 14,
		pad: 28,
	},
	{
		media: "(min-width: 1600px) and (min-height: 1000px)",
		minWidth: 1600,
		minHeight: 1000,
		colMax: 200,
		gap: 14,
		pad: 28,
	},
]

/** "Also for you": 6 on phones, 3 at 768, 5 at 1024, 6 at 1440, 7 at 1920. Pad 4 leaves room for a focus ring. */
export const ALSO_FIT: readonly FitSpec[] = [
	{ media: "", minWidth: 0, colMax: 46, gap: 8, pad: 4 },
	{ media: "(min-width: 640px)", minWidth: 640, colMax: 90, gap: 12, pad: 4 },
	{ media: "(min-width: 1024px)", minWidth: 1024, colMax: 96, gap: 12, pad: 4 },
	{
		media: "(min-width: 1800px)",
		minWidth: 1800,
		colMax: 110,
		gap: 12,
		pad: 4,
	},
]

/** The scroller's box ends this far past the whole posters: less than a gap, so the next poster never peeks in. */
const edge = (s: FitSpec) => Math.max(0, Math.min(s.pad, 8, s.gap - 2))

/** The container width from which a row holds n + 1 posters: once n posters at colMax and their gaps don't fill it. */
const widthFor = (s: FitSpec, n: number) =>
	n * (s.colMax + s.gap) - s.gap + 2 * s.pad + 0.5

/** The widest a row gets: fixedN posters at colMax and their gaps (none without a fixedN). */
const capWidth = (s: FitSpec) =>
	s.fixedN === undefined ? null : widthFor(s, s.fixedN) - 0.5

/**
 * The CSS for a row named `name`: `.<name>` is the container, `.<name>-box` (inside it) gets `--poster-n` (posters per
 * view), `--poster-g`, `--poster-p` and `--poster-e`, and `--poster-w` (a poster's width) for anything inside it;
 * `.<name>-c` is a poster's column and `.<name>-row` the scroller.
 */
export function fitCss(name: string, specs: readonly FitSpec[]): string {
	const out: string[] = [
		`.${name} {\n\tcontainer: ${name} / inline-size;\n\tmargin-inline: auto;\n}`,
		`.${name}-box {\n\t--poster-w: calc(\n\t\t(100cqw - 2 * var(--poster-p) - (var(--poster-n) - 1) * var(--poster-g)) /\n\t\tvar(--poster-n)\n\t);\n}`,
		`.${name}-c {\n\tflex-shrink: 0;\n\twidth: var(--poster-w);\n}`,
		`.${name}-row {\n\tmargin-inline: calc(var(--poster-p) - var(--poster-e));\n\tpadding-inline: var(--poster-e);\n\tgap: var(--poster-g);\n\tscroll-padding-inline: var(--poster-e);\n}`,
	]
	for (const s of specs) {
		const cap = capWidth(s)
		const rules = [
			`.${name} {\n\tmax-width: ${cap === null ? "none" : `${cap}px`};\n}`,
			`.${name}-box {\n\t--poster-n: ${s.fixedN ?? 1};\n\t--poster-g: ${s.gap}px;\n\t--poster-p: ${s.pad}px;\n\t--poster-e: ${edge(s)}px;\n}`,
		]
		for (let n = 1; s.fixedN === undefined && n < MAX_N; n++)
			rules.push(
				`@container ${name} (min-width: ${widthFor(s, n)}px) {\n\t.${name}-box {\n\t\t--poster-n: ${n + 1};\n\t}\n}`,
			)
		out.push(
			s.media
				? `@media ${s.media} {\n${rules.map((r) => r.replace(/^/gm, "\t")).join("\n")}\n}`
				: rules.join("\n"),
		)
	}
	return out.join("\n")
}

/** Both rows' CSS, as spotlight.css holds it. */
export const allFitCss = () =>
	[fitCss("start-results", RESULTS_FIT), fitCss("start-also", ALSO_FIT)].join(
		"\n",
	)

/** The spec that applies in a window of vw × vh px (the last matching one, as in the CSS). */
export function fitAt(
	specs: readonly FitSpec[],
	vw: number,
	vh: number,
): FitSpec {
	let at = specs[0]
	for (const s of specs) {
		if (vw < s.minWidth) continue
		if (s.maxHeight !== undefined && vh > s.maxHeight) continue
		if (s.minHeight !== undefined && vh < s.minHeight) continue
		at = s
	}
	return at
}

/**
 * How many posters a row given `width` px holds per view, how wide each is, and how wide the row is (its cap, centered,
 * when the space is wider), as the CSS computes it.
 */
export function postersPerView(spec: FitSpec, width: number) {
	const cap = capWidth(spec)
	const rowWidth = cap === null ? width : Math.min(width, cap)
	let n = spec.fixedN ?? 1
	for (let k = 1; spec.fixedN === undefined && k < MAX_N; k++)
		if (rowWidth >= widthFor(spec, k)) n = k + 1
	return {
		n,
		rowWidth,
		posterWidth: (rowWidth - 2 * spec.pad - (n - 1) * spec.gap) / n,
	}
}
