// TMDB image URLs: one host, TMDB's fixed size steps, and the srcSet and sizes strings.
//
// The size rule: request the smallest step that covers the displayed width times the device
// pixel ratio, and count a pixel ratio above 2 as 2. A phone with a ratio of 3 gets the same file
// as one with a ratio of 2. Past 2 the extra pixels aren't visible at normal viewing distance.
// An image with a fixed width offers a 1x and a 2x file. An image whose width follows the viewport
// offers the steps with their widths, and tmdbSizes keeps the browser's choice near 2x on phones.
//
// The image host answers directly. www.themoviedb.org/t/p/... redirects to it, which costs a second
// request and a second connection per image.

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

export type TmdbImageKind = "poster" | "backdrop" | "profile" | "logo"

interface Step {
	name: string
	/** Pixels wide. For h632 this is the width of a 2:3 portrait. */
	width: number
}

// The steps of TMDB's /configuration response, without "original".
const STEPS: Record<TmdbImageKind, Step[]> = {
	poster: [
		{ name: "w92", width: 92 },
		{ name: "w154", width: 154 },
		{ name: "w185", width: 185 },
		{ name: "w342", width: 342 },
		{ name: "w500", width: 500 },
		{ name: "w780", width: 780 },
	],
	backdrop: [
		{ name: "w300", width: 300 },
		{ name: "w780", width: 780 },
		{ name: "w1280", width: 1280 },
	],
	profile: [
		{ name: "w45", width: 45 },
		{ name: "w185", width: 185 },
		{ name: "h632", width: 421 },
	],
	logo: [
		{ name: "w45", width: 45 },
		{ name: "w92", width: 92 },
		{ name: "w154", width: 154 },
		{ name: "w185", width: 185 },
		{ name: "w300", width: 300 },
		{ name: "w500", width: 500 },
	],
}

/** Pixel ratios above this one request the same file as this one. */
export const MAX_PIXEL_RATIO = 2

/** The URL of one size. Paths are stored with or without a leading slash. */
export function tmdbImageUrl(path: string, size: string): string {
	return `${TMDB_IMAGE_BASE}/${size}/${path.replace(/^\/+/, "")}`
}

/** The smallest step that covers a displayed width at a pixel ratio, or the largest step. */
export function tmdbSizeFor(
	kind: TmdbImageKind,
	displayWidth: number,
	pixelRatio = 1,
): string {
	const needed =
		displayWidth * Math.min(Math.max(pixelRatio, 1), MAX_PIXEL_RATIO)
	const steps = STEPS[kind]
	return (steps.find((step) => step.width >= needed) ?? steps[steps.length - 1])
		.name
}

export interface TmdbImageSource {
	src: string
	srcSet?: string
	sizes?: string
}

/** An image with a fixed displayed width: one file for a pixel ratio of 1 and one for 2 and above. */
export function tmdbFixedImage(
	kind: TmdbImageKind,
	path: string,
	displayWidth: number,
): TmdbImageSource {
	const one = tmdbSizeFor(kind, displayWidth, 1)
	const two = tmdbSizeFor(kind, displayWidth, 2)
	const src = tmdbImageUrl(path, one)
	if (one === two) return { src }
	return { src, srcSet: `${src} 1x, ${tmdbImageUrl(path, two)} 2x` }
}

/** One entry of a sizes attribute: a media condition, or null for the last entry, and a CSS length. */
export type SizeRule = [condition: string | null, length: string]

// The browser requests slot width times pixel ratio, and takes the smallest file that covers it.
// Phones have pixel ratios of 2.6 to 3.5, so for them sizes reports a narrower slot, and the
// request lands at 1.8 to 2.1 times the displayed width. That keeps a full-width backdrop at w780
// and a two-column poster at w342 on phones up to 430 px wide.
// Only the last rule, the phone layout, gets these entries: wider screens rarely have such
// ratios, and a page repeats the attribute on every poster.
const HIGH_RATIOS: [minRatio: number, factor: number][] = [
	[3, 0.6],
	[2.5, 0.7],
]

const scaled = (length: string, factor: number) => {
	const px = /^(\d+(?:\.\d+)?)px$/.exec(length)
	return px
		? `${Math.round(Number(px[1]) * factor)}px`
		: `calc(${length} * ${factor})`
}

/**
 * The sizes attribute for the displayed widths. The last rule has no condition and is the phone
 * layout. There, pixel ratios above 2 count as about 2.
 */
export function tmdbSizes(rules: SizeRule[]): string {
	return rules
		.flatMap(([condition, length]) =>
			condition
				? [`${condition} ${length}`]
				: [
						...HIGH_RATIOS.map(
							([ratio, factor]) =>
								`(min-resolution: ${ratio}dppx) ${scaled(length, factor)}`,
						),
						length,
					],
		)
		.join(", ")
}

/**
 * An image whose displayed width depends on the viewport. The browser picks the file from srcSet.
 * `src` is the fallback for a client without srcSet support and what crawlers index.
 * `minWidth` and `maxWidth` are the narrowest and the widest the image is displayed. They leave
 * out the steps that no layout needs, which keeps the attribute short: a page has many posters.
 */
export function tmdbFluidImage(
	kind: TmdbImageKind,
	path: string,
	rules: SizeRule[],
	{
		fallbackWidth,
		minWidth = 0,
		maxWidth = Number.POSITIVE_INFINITY,
	}: { fallbackWidth: number; minWidth?: number; maxWidth?: number },
): TmdbImageSource {
	const steps = STEPS[kind]
	const first = Math.max(
		0,
		steps.findIndex((step) => step.width >= minWidth),
	)
	const last = steps.findIndex(
		(step) => step.width >= maxWidth * MAX_PIXEL_RATIO,
	)
	const used = steps.slice(first, last === -1 ? steps.length : last + 1)
	return {
		src: tmdbImageUrl(path, tmdbSizeFor(kind, fallbackWidth, 1)),
		srcSet: used
			.map((step) => `${tmdbImageUrl(path, step.name)} ${step.width}w`)
			.join(", "),
		sizes: tmdbSizes(rules),
	}
}

/**
 * "lazy" waits until the image is near the viewport. "eager" is for an image that is visible
 * without scrolling. "high" is for the page's largest image: eager, and fetched first.
 */
export type ImagePriority = "lazy" | "eager" | "high"

/** The loading attributes of an image. Lazy is the default everywhere. */
export function imageLoadingProps(priority: ImagePriority = "lazy") {
	if (priority === "lazy")
		return { loading: "lazy", decoding: "async" } as const
	if (priority === "high") return { fetchpriority: "high" } as const
	return {}
}

/**
 * The priority of a card in a poster grid. The first row on a phone is two cards, and one of them
 * is the page's largest image. A wide screen shows six in the first row. Every later card is lazy.
 */
export function gridPosterPriority(index: number): ImagePriority {
	return index < 2 ? "high" : index < 6 ? "eager" : "lazy"
}
