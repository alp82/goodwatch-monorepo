// Building blocks for the Open Graph cards (1200x630), rendered by satori.
// Satori only supports flexbox: every element with more than one child needs display: flex.
// resvg can crash the process on rotated elements with blurred shadows, so keep everything
// axis-aligned and every size fixed and positive.
import type { CSSProperties, ReactNode } from "react"
import disneyLogo from "~/img/disneyplus-logo.png?inline"
import logoAmber from "~/img/goodwatch-logo-amber.svg?raw"
import netflixLogo from "~/img/netflix-logo.svg?raw"
import primeLogo from "~/img/primevideo-logo.svg?raw"
import { BRAND_NAME, SUBTEXT_MAX_LENGTH } from "~/ui/og-image/copy"
import {
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	scoreLabels,
} from "~/utils/ratings"

export const WIDTH = 1200
export const HEIGHT = 630

export const AMBER = "#fbbf24"
export const INK = "#0a0a0a"

const svgUri = (svg: string) =>
	`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
const LOGO_AMBER = svgUri(logoAmber)
const LOGO_INK = svgUri(logoAmber.split(AMBER).join(INK))

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

const vibeColor = (score: number) => VIBE_COLORS[goodwatchVibeIndex(score)]
const scoreWord = (score: number) =>
	scoreLabels[Math.min(10, Math.floor(score / 10) + 1)]

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

export const Brand = ({
	dark = false,
	size = 56,
}: { dark?: boolean; size?: number }) => (
	<div style={row({ alignItems: "center", gap: size * 0.3 })}>
		<img
			alt=""
			src={dark ? LOGO_INK : LOGO_AMBER}
			width={size * 0.95}
			height={size}
		/>
		<div
			style={{
				fontFamily: "Gabarito",
				fontWeight: 900,
				fontSize: size * 0.85,
				color: dark ? INK : "#fff",
				letterSpacing: -0.5,
			}}
		>
			{BRAND_NAME}
		</div>
	</div>
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

export const Headline = ({
	text,
	sizes,
}: { text: string; sizes: FontSizes }) => (
	<div
		style={{
			display: "flex",
			fontFamily: "Anton",
			fontSize: fitFontSize(text, sizes),
			lineHeight: 0.95,
			letterSpacing: 1,
			color: INK,
		}}
	>
		{headlineText(text)}
	</div>
)

// A subtext only shows when it is short enough to read at a glance.
export const Subtext = ({ text }: { text: string | null }) =>
	text && text.length <= SUBTEXT_MAX_LENGTH ? (
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
				{scoreWord(score).toUpperCase()}
			</div>
		</div>
	</div>
)
