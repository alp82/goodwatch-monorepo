// Building blocks for the Open Graph cards (1200x630), rendered by satori.
// Satori only supports flexbox: every element with more than one child needs display: flex.
// resvg can crash the process on rotated elements with blurred shadows, so keep everything
// axis-aligned and every size fixed and positive.
import type { CSSProperties, ReactNode } from "react"
import disneyLogo from "~/img/disneyplus-logo.png?inline"
import netflixLogo from "~/img/netflix-logo.svg?raw"
import primeLogo from "~/img/primevideo-logo.svg?raw"
import {
	GoodWatchWordmark,
	SATORI_FONT_FAMILY,
} from "~/ui/brand/GoodWatchWordmark"
import { SUBTEXT_MAX_LENGTH } from "~/ui/og-image/copy"
import {
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	scoreWord,
} from "~/utils/ratings"

export const WIDTH = 1200
export const HEIGHT = 630

export const AMBER = "#fbbf24"
export const INK = "#0a0a0a"

const svgUri = (svg: string) =>
	`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`

// Streaming provider logos, keyed by TMDB watch provider id.
export const PROVIDER_LOGOS: Record<string, string> = {
	"8": svgUri(netflixLogo),
	"9": svgUri(primeLogo),
	"337": disneyLogo,
}

// Same values as the --color-vibe-* tokens in app/tailwind.css.
const VIBE_COLORS: Record<number, string> = {
	0: "#7f1d1d",
	10: "#991b1b",
	20: "#b91c1c",
	30: "#c2410c",
	40: "#d97706",
	50: "#ca8a04",
	60: "#a3a323",
	70: "#65a32d",
	80: "#16934a",
	90: "#15803d",
	100: "#166534",
}

export const vibeColor = (score: number) =>
	VIBE_COLORS[goodwatchVibeIndex(score)]

export const row = (s: CSSProperties = {}): CSSProperties => ({
	display: "flex",
	flexDirection: "row",
	...s,
})
export const col = (s: CSSProperties = {}): CSSProperties => ({
	display: "flex",
	flexDirection: "column",
	...s,
})

// How wide a character sets compared with an Anton letter. The fallback fonts for other
// scripts run wider: CJK and Hangul are square, Arabic has no joined forms in satori.
const characterWidth = (char: string) => {
	if (
		/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(
			char,
		)
	)
		return 2.3
	if (/[\u0600-\u06ff\u0590-\u05ff]/.test(char)) return 1.7
	if (/[\u0400-\u04ff\u0370-\u03ff]/.test(char)) return 1.35
	if (/[\u0e00-\u0e7f\u0900-\u0dff]/.test(char)) return 1.3
	return 1
}
const textWidth = (text: string) =>
	[...text].reduce((sum, char) => sum + characterWidth(char), 0)

// Satori lays text out left to right. For Arabic and Hebrew titles, that puts the words in
// reverse order, so they are flipped back here; the letters inside each word come out right.
const RTL = /[\u0590-\u06ff]/
export const headlineText = (text: string) => {
	const upper = text.toUpperCase()
	if (!RTL.test(upper)) return upper
	return upper.split(/\s+/).reverse().join("\u00a0")
}

// Font sizes by text width in Anton letters: the first entry whose max width fits wins.
export type FontSizes = [maxWidth: number, fontSize: number][]
export const fitFontSize = (text: string, sizes: FontSizes) => {
	const width = textWidth(text)
	return sizes.find(([max]) => width <= max)?.[1] ?? sizes[sizes.length - 1][1]
}

export const Frame = ({
	children,
	bg = AMBER,
}: { children: ReactNode; bg?: string }) => (
	<div
		style={{
			display: "flex",
			position: "relative",
			width: WIDTH,
			height: HEIGHT,
			backgroundColor: bg,
			fontFamily: "Gabarito",
			color: "#fff",
			overflow: "hidden",
		}}
	>
		{children}
	</div>
)

// `size` is the height of the wordmark's line. On a light background (`dark` asks for dark ink) the wordmark keeps
// its colors and gets an ink plate, drawn a little smaller so that the plate is about as wide as the bare wordmark.
export const Brand = ({
	dark = false,
	size = 56,
}: { dark?: boolean; size?: number }) => (
	<GoodWatchWordmark
		fontSize={dark ? size * 0.9 : size}
		plate={dark}
		fontFamily={SATORI_FONT_FAMILY}
	/>
)

// A picture that covers its box. People and posters keep the top, where faces are.
export const Picture = ({
	src,
	style,
	alignTop = false,
}: { src: string | null; style: CSSProperties; alignTop?: boolean }) =>
	src ? (
		<img
			alt=""
			src={src}
			style={{
				position: "absolute",
				objectFit: "cover",
				objectPosition: alignTop ? "center top" : "center",
				...style,
			}}
		/>
	) : null

// A short uppercase label on a solid block, such as "Movie · 2010 · 2h 28m".
export const Tag = ({ text }: { text: string }) => (
	<div style={row()}>
		<div
			style={{
				display: "flex",
				backgroundColor: INK,
				color: AMBER,
				fontSize: 24,
				fontWeight: 900,
				letterSpacing: 3,
				padding: "7px 16px",
				borderRadius: 6,
			}}
		>
			{text.toUpperCase()}
		</div>
	</div>
)

// Anton advance widths in em for the characters titles use (from the font's hmtx table). Anything else falls back to
// an average letter scaled by characterWidth, which covers the wider fallback fonts for other scripts.
const ANTON_EM: Record<string, number> = {
	" ": 0.234,
	"!": 0.229,
	"#": 0.546,
	$: 0.462,
	"%": 1.057,
	"&": 0.52,
	"'": 0.214,
	"(": 0.291,
	")": 0.291,
	"*": 0.452,
	"+": 0.355,
	",": 0.236,
	"-": 0.311,
	".": 0.229,
	"/": 0.405,
	"0": 0.494,
	"1": 0.331,
	"2": 0.494,
	"3": 0.494,
	"4": 0.494,
	"5": 0.494,
	"6": 0.494,
	"7": 0.494,
	"8": 0.494,
	"9": 0.494,
	":": 0.242,
	";": 0.245,
	"?": 0.492,
	"@": 0.864,
	A: 0.485,
	B: 0.479,
	C: 0.474,
	D: 0.493,
	E: 0.412,
	F: 0.399,
	G: 0.485,
	H: 0.499,
	I: 0.227,
	J: 0.466,
	K: 0.472,
	L: 0.397,
	M: 0.746,
	N: 0.498,
	O: 0.486,
	P: 0.472,
	Q: 0.494,
	R: 0.477,
	S: 0.461,
	T: 0.396,
	U: 0.474,
	V: 0.469,
	W: 0.712,
	X: 0.484,
	Y: 0.446,
	Z: 0.41,
}
const charEm = (char: string) =>
	ANTON_EM[char] ??
	ANTON_EM[char.normalize("NFD")[0]] ??
	0.5 * characterWidth(char)

// CJK has no spaces, and satori breaks it between any two characters.
const BREAKS_ANYWHERE = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/
const tokens = (text: string) =>
	text
		.split(/\s+/)
		.filter(Boolean)
		.flatMap((word) => (BREAKS_ANYWHERE.test(word) ? [...word] : [word]))

const HEADLINE_LINE_HEIGHT = 0.95
const HEADLINE_LETTER_SPACING = 1
// The width of a run of text in px at a font size, with a 3% margin for kerning and rounding.
const runWidth = (text: string, fontSize: number) =>
	[...text].reduce(
		(sum, char) => sum + charEm(char) * fontSize + HEADLINE_LETTER_SPACING,
		0,
	) * 1.03

// Greedy word wrap, as satori does it. Returns the lines, or null when a single word is wider than the box.
const wrap = (words: string[], fontSize: number, width: number) => {
	const lines: string[] = []
	for (const word of words) {
		if (runWidth(word, fontSize) > width) return null
		const last = lines[lines.length - 1]
		if (last !== undefined && runWidth(`${last} ${word}`, fontSize) <= width)
			lines[lines.length - 1] = `${last} ${word}`
		else lines.push(word)
	}
	return lines
}

export type HeadlineFit = { fontSize: number; text: string }
/**
 * The largest font size, from `max` down to `min`, at which the uppercase headline wraps inside a `width` x `height`
 * box. At `min`, a headline that still doesn't fit keeps the lines that do and ends with an ellipsis, and a word that
 * is too wide on its own is cut, so the text never leaves its box.
 */
export const fitHeadline = (
	text: string,
	box: { width: number; height: number; max: number; min?: number },
): HeadlineFit => {
	const upper = headlineText(text)
	const words = tokens(upper)
	const min = box.min ?? 44
	for (let size = box.max; size >= min; size -= 2) {
		const lines = wrap(words, size, box.width)
		if (lines && lines.length * size * HEADLINE_LINE_HEIGHT <= box.height)
			return { fontSize: size, text: upper }
	}
	const maxLines = Math.max(
		1,
		Math.floor(box.height / (min * HEADLINE_LINE_HEIGHT)),
	)
	const lines: string[] = []
	for (const word of words) {
		let piece = word
		while (piece.length > 1 && runWidth(piece, min) > box.width)
			piece = piece.slice(0, -1)
		const last = lines[lines.length - 1]
		if (last !== undefined && runWidth(`${last} ${piece}`, min) <= box.width)
			lines[lines.length - 1] = `${last} ${piece}`
		else lines.push(piece)
		if (lines.length > maxLines) break
	}
	if (
		lines.length <= maxLines &&
		lines.join(" ").length === words.join(" ").length
	)
		return { fontSize: min, text: lines.join(" ") }
	const kept = lines.slice(0, maxLines)
	let lastLine = `${kept[kept.length - 1]}…`
	while (lastLine.length > 1 && runWidth(lastLine, min) > box.width)
		lastLine = `${lastLine.slice(0, -2)}…`
	kept[kept.length - 1] = lastLine
	return { fontSize: min, text: kept.join(" ") }
}

// The headline in Anton, sized by fitHeadline to its box. The box also clips, so nothing can spill onto the brand.
export const Headline = ({
	text,
	width,
	height,
	max,
	min,
}: {
	text: string
	width: number
	height: number
	max: number
	min?: number
}) => {
	const fit = fitHeadline(text, { width, height, max, min })
	// PROTOTYPE (awards-og): accented capitals ("CÉSAR") reach above the 0.95 line box, and the box's clip cut the
	// accent off. Room above the first line keeps it.
	const accentRoom = /[\u00c0-\u00de\u0100-\u017f]/.test(fit.text)
		? Math.round(fit.fontSize * 0.14)
		: 0
	return (
		<div
			style={{
				display: "flex",
				paddingTop: accentRoom,
				maxWidth: width,
				maxHeight: height + accentRoom,
				overflow: "hidden",
				fontFamily: "Anton",
				fontSize: fit.fontSize,
				lineHeight: HEADLINE_LINE_HEIGHT,
				letterSpacing: HEADLINE_LETTER_SPACING,
				color: INK,
			}}
		>
			{fit.text}
		</div>
	)
}

// Fixed heights the text columns reserve, so the headline's box is what is left between them.
// TEXT_TOP is just under the brand (top 44, about 60 tall).
export const TEXT_TOP = 120
export const TAG_HEIGHT = 44
export const SCORE_HEIGHT = 156
// Two lines at 30 px, as a 40-character subtext can wrap in a narrow column.
export const SUBTEXT_HEIGHT = 76

// A subtext only shows when it is short enough to read at a glance.
export const showsSubtext = (text: string | null): text is string =>
	!!text && text.length <= SUBTEXT_MAX_LENGTH
export const Subtext = ({ text }: { text: string | null }) =>
	showsSubtext(text) ? (
		<div
			style={{
				display: "flex",
				fontSize: 30,
				fontWeight: 700,
				color: INK,
				opacity: 0.8,
			}}
		>
			{text}
		</div>
	) : null

// The GoodWatch score as a block in its vibe color: the number with its word ("Masterpiece") below.
export const ScoreBlock = ({ score }: { score: number }) => (
	<div style={{ display: "flex" }}>
		<div
			style={col({
				alignItems: "center",
				backgroundColor: vibeColor(score),
				borderRadius: 20,
				padding: "8px 30px 14px",
			})}
		>
			<div
				style={{
					display: "flex",
					fontFamily: "Anton",
					fontSize: 108,
					color: "#fff",
					lineHeight: 1.05,
				}}
			>
				{String(goodwatchScoreDisplay(score))}
			</div>
			<div
				style={{
					display: "flex",
					fontSize: 24,
					fontWeight: 900,
					color: "#fff",
					letterSpacing: 3,
				}}
			>
				{scoreWord(score)?.toUpperCase()}
			</div>
		</div>
	</div>
)
