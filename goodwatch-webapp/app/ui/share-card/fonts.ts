// The fonts card designs use. The files ship in public/fonts/share-card with their licenses.
// The image renderer reads these TTF files. A browser loads WOFF2 slices of them: see font-faces.ts.

export interface CardFont {
	name: string
	file: string
	weight: 400 | 700 | 800 | 900
	style: "normal" | "italic"
}

export const CARD_FONT_DIR = "/fonts/share-card"

export const CARD_FONTS: CardFont[] = [
	{ name: "Gabarito", file: "Gabarito-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Gabarito", file: "Gabarito-Bold.ttf", weight: 700, style: "normal" },
	{ name: "Gabarito", file: "Gabarito-Black.ttf", weight: 900, style: "normal" },
	{ name: "Anton", file: "Anton-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Space Mono", file: "SpaceMono-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Space Mono", file: "SpaceMono-Bold.ttf", weight: 700, style: "normal" },
	{ name: "Bricolage Grotesque", file: "BricolageGrotesque-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Bricolage Grotesque", file: "BricolageGrotesque-ExtraBold.ttf", weight: 800, style: "normal" },
	{ name: "Instrument Serif", file: "InstrumentSerif-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Instrument Serif", file: "InstrumentSerif-Italic.ttf", weight: 400, style: "italic" },
	{ name: "Playfair Display", file: "PlayfairDisplay-Black.ttf", weight: 900, style: "normal" },
	{ name: "Playfair Display", file: "PlayfairDisplay-Italic.ttf", weight: 400, style: "italic" },
	{ name: "Playfair Display", file: "PlayfairDisplay-BlackItalic.ttf", weight: 900, style: "italic" },
	{ name: "VT323", file: "VT323-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Permanent Marker", file: "PermanentMarker-Regular.ttf", weight: 400, style: "normal" },
	{ name: "Rubik Mono One", file: "RubikMonoOne-Regular.ttf", weight: 400, style: "normal" },
]
