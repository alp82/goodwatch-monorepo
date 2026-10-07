// How a browser loads the fonts of share cards. The image renderer reads the TTF files (fonts.ts); a page gets
// the same fonts as WOFF2 slices (scripts/subset-share-card-fonts.py) and downloads a slice only when a card
// shows a character of it. Gabarito's Latin characters come from the brand font's files, which every page
// loads (app/fonts/gabarito.css), so a card declares only Gabarito's remaining characters.
//
// Until a font has loaded, its text shows in a local font that is scaled to the card font's width and given
// its ascent and descent (font-display: swap), so the swap doesn't rewrap or move text in the card. A
// character that a card font doesn't have, such as Cyrillic in Anton, shows in a local font at its own size:
// a bold one where the card font is heavy. The card's image draws such characters in Oswald or Noto Sans.
import { CARD_FONTS, CARD_FONT_DIR, type CardFont } from "./fonts.ts"
import { FONT_SLICES, type FontSlice } from "./font-slices.ts"

const sliceUrl = (file: string, slice: FontSlice) =>
	`${CARD_FONT_DIR}/${file.replace(/\.ttf$/, "")}.${slice}.woff2`

const faceRules = (font: CardFont) =>
	Object.entries(FONT_SLICES[font.file] ?? {}).map(
		([slice, range]) =>
			`@font-face{font-family:"${font.name}";src:url("${sliceUrl(font.file, slice as FontSlice)}") format("woff2");font-weight:${font.weight};font-style:${font.style};font-display:swap;unicode-range:${range}}`,
	)

// The local fonts. Arial, Times New Roman, and Courier New: Windows, macOS, and iOS. Liberation has their
// widths on Linux. Roboto and Noto Serif: Android.
const local = (...names: string[]) => names.map((name) => `local("${name}")`).join(",")
const ARIAL = local("Arial", "ArialMT", "Liberation Sans")
const ARIAL_BOLD = local("Arial Bold", "Arial-BoldMT", "Liberation Sans Bold")
const ROBOTO_BOLD = local("Roboto Bold", "Roboto-Bold")
const TIMES = local("Times New Roman", "TimesNewRomanPSMT", "Liberation Serif")
const TIMES_ITALIC = local("Times New Roman Italic", "TimesNewRomanPS-ItalicMT", "Liberation Serif Italic")
const TIMES_BOLD = local("Times New Roman Bold", "TimesNewRomanPS-BoldMT", "Liberation Serif Bold")
const TIMES_BOLD_ITALIC = local("Times New Roman Bold Italic", "TimesNewRomanPS-BoldItalicMT", "Liberation Serif Bold Italic")
const NOTO_SERIF = local("Noto Serif", "NotoSerif")
const NOTO_SERIF_ITALIC = local("Noto Serif Italic", "NotoSerif-Italic")
const NOTO_SERIF_BOLD = local("Noto Serif Bold", "NotoSerif-Bold")
const NOTO_SERIF_BOLD_ITALIC = local("Noto Serif Bold Italic", "NotoSerif-BoldItalic")
const COURIER = local("Courier New", "CourierNewPSMT", "Liberation Mono")
const COURIER_BOLD = local("Courier New Bold", "CourierNewPS-BoldMT", "Liberation Mono Bold")

// For characters outside a heavy card font: a bold local font, because the element's own weight is 400.
const HEAVY_SANS_FACE = `@font-face{font-family:"Card Heavy Sans";src:${ARIAL_BOLD},${ROBOTO_BOLD}}`
const HEAVY_SANS = `"Card Heavy Sans",sans-serif`
// The characters a metric fallback stands in for: Latin, punctuation, and currency signs. Its scale fits the
// card font's Latin letters, so other scripts skip it.
const FALLBACK_RANGE = "U+0000-02FF,U+1E00-1EFF,U+2000-20CF"

interface Fallback {
	weight?: CardFont["weight"]
	style?: CardFont["style"]
	src: string
	/** Percent: size-adjust, then the card font's ascent, descent, and line gap over size-adjust. */
	metrics: [size: number, ascent: number, descent: number, lineGap?: number]
}

// size-adjust is the card font's average advance width over the local font's, weighted by English letter
// frequency (the method of app/fonts/gabarito.css). Anton is measured in upper case, because every design sets
// its Anton text in capitals or digits: in lower case it would be 85.2%. A family's second list is for Android.
// The Roboto values come from Arial's and the brand font's ratio between the two, not from Roboto's own file.
const FALLBACKS: Record<string, { generic: string; families: Fallback[][] }> = {
	Anton: {
		generic: HEAVY_SANS,
		families: [
			[{ src: ARIAL_BOLD, metrics: [68.79, 170.99, 47.84] }],
			[{ src: ROBOTO_BOLD, metrics: [73.14, 160.83, 45] }],
		],
	},
	"Bricolage Grotesque": {
		generic: "sans-serif",
		families: [
			[
				{ weight: 400, src: ARIAL, metrics: [106.7, 87.16, 25.3] },
				{ weight: 800, src: ARIAL_BOLD, metrics: [103.56, 89.8, 26.07] },
			],
		],
	},
	"Instrument Serif": {
		generic: "serif",
		families: [
			[
				{ style: "normal", src: TIMES, metrics: [84.32, 117.41, 36.77] },
				{ style: "italic", src: TIMES_ITALIC, metrics: [88.61, 111.73, 34.99] },
			],
			[
				{ style: "normal", src: NOTO_SERIF, metrics: [70.43, 140.57, 44.02] },
				{ style: "italic", src: NOTO_SERIF_ITALIC, metrics: [76.57, 129.29, 40.49] },
			],
		],
	},
	"Playfair Display": {
		generic: "serif",
		families: [
			[
				{ weight: 900, style: "normal", src: TIMES_BOLD, metrics: [109.19, 99.1, 22.99] },
				{ weight: 400, style: "italic", src: TIMES_ITALIC, metrics: [105.18, 102.88, 23.86] },
				{ weight: 900, style: "italic", src: TIMES_BOLD_ITALIC, metrics: [113, 95.76, 22.21] },
			],
			[
				{ weight: 900, style: "normal", src: NOTO_SERIF_BOLD, metrics: [91.5, 118.25, 27.43] },
				{ weight: 400, style: "italic", src: NOTO_SERIF_ITALIC, metrics: [90.89, 119.05, 27.62] },
				{ weight: 900, style: "italic", src: NOTO_SERIF_BOLD_ITALIC, metrics: [90.7, 119.29, 27.67] },
			],
		],
	},
	"Space Mono": {
		generic: "monospace",
		families: [
			[
				{ weight: 400, src: COURIER, metrics: [101.98, 109.82, 35.4] },
				{ weight: 700, src: COURIER_BOLD, metrics: [101.98, 109.82, 35.4] },
			],
		],
	},
	VT323: { generic: "monospace", families: [[{ src: COURIER, metrics: [66.66, 120.02, 30] }]] },
	"Rubik Mono One": { generic: HEAVY_SANS, families: [[{ src: COURIER_BOLD, metrics: [141.64, 65.8, 21.6] }]] },
	"Permanent Marker": {
		generic: HEAVY_SANS,
		families: [
			[{ src: ARIAL_BOLD, metrics: [106.31, 104.36, 29.86, 2.85] }],
			[{ src: ROBOTO_BOLD, metrics: [113.04, 98.14, 28.08, 2.68] }],
		],
	},
}
// Gabarito's fallback fonts are the brand font's (app/fonts/gabarito.css).
const GABARITO_STACK = `"Gabarito","Gabarito Fallback","Gabarito Fallback Roboto",sans-serif`

const fallbackName = (family: string, index: number) => `${family} Fallback${index ? " Android" : ""}`

// A card names one font per element in its inline style, for the image renderer. This rule puts the fallback
// fonts behind that name. The selectors match the style attribute as React writes it into the server HTML
// (font-family:Space Mono) and as the browser writes it for an element that React created there
// (font-family: "Space Mono").
const stackRule = (family: string, stack: string) =>
	`[style*='font-family:${family}'],[style*='font-family: ${family}'],[style*='font-family: "${family}"']{font-family:${stack}!important}`

const fallbackRules = (family: string) => {
	if (family === "Gabarito") return [stackRule(family, GABARITO_STACK)]
	const { generic, families } = FALLBACKS[family]
	const faces = families.flatMap((fallbacks, index) =>
		fallbacks.map(
			({ weight, style, src, metrics: [size, ascent, descent, lineGap = 0] }) =>
				`@font-face{font-family:"${fallbackName(family, index)}";src:${src};${weight ? `font-weight:${weight};` : ""}${style ? `font-style:${style};` : ""}size-adjust:${size}%;ascent-override:${ascent}%;descent-override:${descent}%;line-gap-override:${lineGap}%;unicode-range:${FALLBACK_RANGE}}`,
		),
	)
	const stack = [`"${family}"`, ...families.map((_, index) => `"${fallbackName(family, index)}"`), generic]
	return [...faces, stackRule(family, stack.join(","))]
}

// The card font of each design's title and every font family the design's source names. The title is the
// largest text of a page that shows one card, so that page preloads its font. null: the title is in Gabarito,
// which the root route preloads. font-faces.test.ts holds this list against the design files.
export const DESIGN_FONTS: Record<string, { title: string | null; families: string[] }> = {
	podium: { title: "Anton-Regular.ttf", families: ["Anton", "Gabarito"] },
	tickets: { title: "PlayfairDisplay-BlackItalic.ttf", families: ["Anton", "Gabarito", "Playfair Display", "Space Mono"] },
	filmstrip: { title: "RubikMonoOne-Regular.ttf", families: ["Gabarito", "Rubik Mono One", "Space Mono"] },
	marquee: { title: "Anton-Regular.ttf", families: ["Anton", "Gabarito", "Rubik Mono One", "Space Mono"] },
	cover: { title: "InstrumentSerif-Regular.ttf", families: ["Bricolage Grotesque", "Gabarito", "Instrument Serif"] },
	newsprint: { title: "PlayfairDisplay-Black.ttf", families: ["Anton", "Gabarito", "Instrument Serif", "Playfair Display", "Space Mono"] },
	bento: { title: null, families: ["Gabarito"] },
	vhs: { title: "Anton-Regular.ttf", families: ["Anton", "Gabarito", "Permanent Marker", "Rubik Mono One", "Space Mono"] },
	trading: { title: "Anton-Regular.ttf", families: ["Anton", "Gabarito", "Instrument Serif", "Rubik Mono One", "Space Mono"] },
	letterboard: { title: null, families: ["Gabarito"] },
	manifesto: { title: null, families: ["Gabarito"] },
	ceremony: { title: "InstrumentSerif-Regular.ttf", families: ["Gabarito", "Instrument Serif", "Playfair Display"] },
	rental: { title: "SpaceMono-Bold.ttf", families: ["Anton", "Gabarito", "Permanent Marker", "Space Mono"] },
	teletext: { title: "VT323-Regular.ttf", families: ["Gabarito", "VT323"] },
	receipt: { title: "SpaceMono-Bold.ttf", families: ["Anton", "Gabarito", "Space Mono"] },
}

const ALL_FAMILIES = [...new Set(CARD_FONTS.map((font) => font.name))]

/** The font rules for a page's cards: every card font, or only those of the one design the page shows. */
export const cardFontCss = (design?: string) => {
	const families = (design && DESIGN_FONTS[design]?.families) || ALL_FAMILIES
	return [
		...CARD_FONTS.filter((font) => families.includes(font.name)).flatMap(faceRules),
		HEAVY_SANS_FACE,
		...families.flatMap(fallbackRules),
	].join("\n")
}

/** The file to preload on a page whose largest text is this design's title, or null when no preload is needed. */
export const titleFontPreload = (design: string) => {
	const file = DESIGN_FONTS[design]?.title
	return file ? sliceUrl(file, "latin") : null
}
