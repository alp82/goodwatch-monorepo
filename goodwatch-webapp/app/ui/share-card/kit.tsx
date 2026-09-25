// Shared building blocks for share-list card designs.
//
// Card contract (every design follows it):
// - Renders twice: DOM for the live preview, satori for the PNG. Inline styles only, every element
//   with more than one child needs display: flex, no z-index (later siblings paint on top), no CSS grid,
//   no React fragments inside card markup (satori collapses their children).
// - Mark the element that represents rank i (0-based) with data-slot={i}: the editor opens the
//   title dialog on click and accepts drops there. Mark the list title data-edit="title". The byline
//   (`name`, always the owner's @handle) isn't editable. When `editing` is true, render placeholders (with data-slot) for
//   empty ranks up to five. Never render placeholders when exporting.
// - resvg panics (and takes the server down) on some inputs: negative sizes, a zero-height box
//   with a dashed border, a blurred boxShadow on a rotated parent. Check renders with scripts/check-share-cards.ts, which renders
//   each card in its own process.
import type { CSSProperties } from "react"
import logoAmber from "~/img/goodwatch-logo-amber.svg?raw"
import type { CardTitle } from "./model"

export const svgUri = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`
export const logo = (color: string) => svgUri(logoAmber.split("#fbbf24").join(color))
export const flex = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s })
export const col = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "column", ...s })
export const fit = (text: string, sizes: [number, number][]) => sizes.find(([max]) => text.length <= max)?.[1] ?? sizes[sizes.length - 1][1]
export const alpha = (hex: string, a: number) => {
	const n = Number.parseInt(hex.slice(1), 16)
	return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
export const kind = (i: CardTitle) => (i.type === "movie" ? "Movie" : "Series")
export const pad = (n: number) => String(n).padStart(2, "0")

// Same lockup as the Open Graph images: amber mark with a white wordmark on dark backgrounds,
// all ink on light ones. `color` is the wordmark color the design wants; it only picks the variant.
const AMBER = "#fbbf24"
const INK = "#0a0a0a"
const isDark = (hex: string) => {
	const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex
	const n = Number.parseInt(full.slice(1, 7), 16)
	return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128
}
export const Brand = ({ color = "#ffffff", size }: { color?: string; size: number; font?: string }) => {
	const dark = isDark(color)
	return (
		<div style={flex({ alignItems: "center", gap: size * 0.3 })}>
			<img src={logo(dark ? INK : AMBER)} width={size * 0.95} height={size} style={{ width: size * 0.95, height: size }} />
			<div style={{ display: "flex", fontFamily: "Gabarito", fontWeight: 900, fontSize: size * 0.85, color: dark ? INK : "#ffffff", letterSpacing: -0.5, textTransform: "none" }}>GoodWatch</div>
		</div>
	)
}

export const Img = ({ src, w, h, style, slot }: { src: string | null; w: number; h: number; style?: CSSProperties; slot?: number }) =>
	src ? (
		<img data-slot={slot} src={src} width={w} height={h} style={{ display: "flex", width: w, height: h, objectFit: "cover", ...style }} />
	) : (
		<div data-slot={slot} style={{ display: "flex", width: w, height: h, backgroundColor: "#2a2a2a", ...style }} />
	)

export const Placeholder = ({ w, h, n, color, style }: { w: number; h: number; n: number; color: string; style?: CSSProperties }) => (
	<div
		data-slot={n - 1}
		style={col({
			width: w,
			height: h,
			alignItems: "center",
			justifyContent: "center",
			border: `4px dashed ${alpha(color, 0.45)}`,
			color: alpha(color, 0.7),
			fontFamily: "Gabarito",
			fontWeight: 700,
			fontSize: Math.max(22, Math.min(w, h) * 0.12),
			...style,
		})}
	>
		<div style={{ display: "flex", fontSize: Math.min(w, h) * 0.3, lineHeight: 1 }}>+</div>
		<div style={{ display: "flex" }}>{`#${n}`}</div>
	</div>
)

