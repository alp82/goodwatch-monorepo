// PROTOTYPE - throwaway. The five GoodWatch logo systems of /prototype/rec-brand. White and yellow are held for all
// five; D is A with a white "ood", E is D inside C's badge. They differ in structure: where the G lives, how the name is split, and what happens on a light background.
// `size` is always the height in px that today's code gives the G at that placement, so the placements compare.
import type { CSSProperties, ReactNode } from "react"
import gSvg from "~/img/goodwatch-logo-amber.svg?raw"

export const WHITE = "#ffffff"
export const YELLOW = "#fbbf24"
export const INK = "#0a0a0a"

export type Tone = "dark" | "light"
type LockupProps = { size: number; tone?: Tone }

// The site's G asset with its color opened up to `currentColor` and its play arrow named, for the boot animation.
const G_MARKUP = gSvg
	.slice(gSvg.indexOf("<svg"))
	.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/, "")
	.replace(/#fbbf24/g, "currentColor")
	.replace(/\sid="path3"/, ' class="rb-g-play"')
	.replace(/\s(id|width|height|inkscape:[\w-]+|sodipodi:[\w-]+)="[^"]*"/g, "")
const G_RATIO = 179.84 / 189.16

export function G({ h, color, className = "" }: { h: number | string; color: string; className?: string }) {
	const height = typeof h === "number" ? `${h}px` : h
	return (
		<span
			aria-hidden
			className={`rb-g ${className}`}
			style={{ height, width: `calc(${height} * ${G_RATIO})`, color }}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: the repository's own SVG file
			dangerouslySetInnerHTML={{ __html: G_MARKUP }}
		/>
	)
}

export type BrandSystem = {
	key: "A" | "B" | "C" | "D" | "E"
	/** The structural family, for the placements that treat a family differently. D follows A, E follows C. */
	treatment: "initial" | "split" | "badge"
	name: string
	line: string
	/** The standard lockup. */
	Lockup: (p: LockupProps) => JSX.Element
	/** What the lockup becomes where there is little height (caption, pill, section heading). */
	Small: (p: LockupProps) => JSX.Element
	/** The emblem alone: the companion for score icons, the dock and the remote. Never a wordmark. */
	Emblem: (p: LockupProps) => JSX.Element
	/** Bento's tile has room for an emblem on top and a name at the bottom: what goes where. */
	bento: { top: ReactNode; bottom: ReactNode; note: string }
	decorative: string
	spec: { label: string; value: ReactNode }[]
}

const Label = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
	<span role="img" aria-label="GoodWatch" style={{ display: "inline-flex", ...style }}>
		{children}
	</span>
)
const Swatches = () => (
	<span className="flex flex-wrap gap-x-3 gap-y-1">
		{[
			[WHITE, "white"],
			[YELLOW, "yellow"],
			[INK, "ink"],
		].map(([hex, name]) => (
			<span key={hex} className="inline-flex items-center gap-1.5">
				<i className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-white/30" style={{ background: hex }} />
				<span className="rb-mono text-[12px]">{hex}</span> {name}
			</span>
		))}
	</span>
)

// ---------------------------------------------------------------------------------------------------------------
// A. Initial G: the header's own lockup. The white G symbol is the first letter, "oodWatch" follows in yellow.
// Ratios are the header's: G 28px beside 36px type, on the baseline, 2px apart.
// `whiteGood` is D's one change: "ood" joins the G in white, so the color splits at the word.
function MarkA({ size, whiteGood }: { size: number; whiteGood?: boolean }) {
	return (
		<span className="rb-lock rb-a" style={{ fontSize: size / 0.778 }}>
			<G h={size} color={WHITE} className="rb-a-g" />
			<span className="rb-a-t">{whiteGood ? <span style={{ color: WHITE }}>ood</span> : "ood"}Watch</span>
		</span>
	)
}
function InitialG({ size, tone = "dark", whiteGood }: LockupProps & { whiteGood?: boolean }) {
	const mark = <MarkA size={size} whiteGood={whiteGood} />
	return <Label>{tone === "light" ? <span className="rb-plate" style={{ fontSize: size / 0.778 }}>{mark}</span> : mark}</Label>
}
const LockupA = (p: LockupProps) => <InitialG {...p} />
const LockupD = (p: LockupProps) => <InitialG {...p} whiteGood />
function EmblemA({ size, tone = "dark" }: LockupProps) {
	if (tone === "dark") return <G h={size} color={WHITE} />
	return (
		<span className="inline-flex items-center justify-center" style={{ width: size * 1.5, height: size * 1.5, borderRadius: size * 0.36, background: INK }}>
			<G h={size} color={WHITE} />
		</span>
	)
}
export const VariantA: BrandSystem = {
	key: "A",
	treatment: "initial",
	name: "Initial G",
	line: "The header's lockup, made the rule: the white G symbol is the first letter of the name.",
	Lockup: LockupA,
	Small: LockupA,
	Emblem: EmblemA,
	bento: {
		top: <LockupA size={34} />,
		bottom: null,
		note: "One lockup on top. The separate name line goes: the G would be said twice.",
	},
	decorative: "Title case is the brand, so uppercase GOODWATCH in a card's own type reads clearly as costume. It stays copy.",
	spec: [
		{ label: "Palette", value: <Swatches /> },
		{ label: "Type", value: "Gabarito 700, title case, no tracking. Reads \"GoodWatch\" only together with the symbol." },
		{ label: "Emblem", value: "Inside the word, as the initial. White. Height 0.78 em, on the baseline." },
		{ label: "Spacing", value: "G to \"oodWatch\": 0.056 em (2px at 36px). Clear space: half a G." },
		{ label: "Small sizes", value: "Same lockup at every size, down to a 10px G. Emblem-only: the bare white G." },
		{ label: "Light backgrounds", value: "Backing plate: an ink chip hugs the lockup (radius 0.26 em). Colors never change." },
		{ label: "Boot", value: "G scales in, \"oodWatch\" wipes out of it to the right, the play arrow pulses once. Reduced motion: one 0.3s fade." },
	],
}

// ---------------------------------------------------------------------------------------------------------------
// D. Initial G, white Good: exactly A's lockup, with "ood" in white beside the white G. Only "Watch" is yellow.
export const VariantD: BrandSystem = {
	...VariantA,
	key: "D",
	name: "Initial G · white Good",
	line: "A's lockup with the color split at the word: white G and white \"ood\", yellow \"Watch\".",
	Lockup: LockupD,
	Small: LockupD,
	bento: { ...VariantA.bento, top: <LockupD size={34} /> },
	spec: VariantA.spec.map((row) =>
		row.label === "Type"
			? { ...row, value: "Gabarito 700, title case, no tracking. White \"ood\" beside the white G, yellow \"Watch\"." }
			: row.label === "Boot"
				? { ...row, value: "As A: the G scales in, \"oodWatch\" wipes out of it to the right, the play arrow pulses once. Reduced motion: one 0.3s fade." }
				: row,
	),
}

// ---------------------------------------------------------------------------------------------------------------
// B. Split word: the whole name in type, white "Good" and yellow "Watch", with the G as a separate smaller tile.
// Emblem and wordmark come apart, so each can be used alone.
function TileB({ em = true, size, tone = "dark" }: { em?: boolean; size?: number; tone?: Tone }) {
	const box = em ? undefined : { width: size, height: size, borderRadius: (size ?? 0) * 0.23 }
	return (
		<span className="rb-b-tile" style={{ background: tone === "dark" ? YELLOW : INK, ...box }}>
			<G h={em ? "0.56em" : (size ?? 0) * 0.64} color={tone === "dark" ? INK : YELLOW} />
		</span>
	)
}
function WordsB({ tone = "dark" }: { tone?: Tone }) {
	return (
		<span>
			<span className="rb-b-good" style={{ color: tone === "dark" ? WHITE : INK }}>Good</span>
			<span className="rb-b-watch" style={{ color: tone === "dark" ? YELLOW : INK }}>Watch</span>
		</span>
	)
}
function LockupB({ size, tone = "dark" }: LockupProps) {
	return (
		<Label>
			<span className="rb-lock rb-b" style={{ fontSize: size * 1.07 }}>
				<TileB tone={tone} />
				<WordsB tone={tone} />
			</span>
		</Label>
	)
}
export const VariantB: BrandSystem = {
	key: "B",
	treatment: "split",
	name: "Split word",
	line: "The full name in strong horizontal type, split by color at the word, with the G as a separate tile.",
	Lockup: LockupB,
	Small: LockupB,
	Emblem: ({ size, tone }) => <TileB em={false} size={size} tone={tone} />,
	bento: {
		top: <TileB em={false} size={64} />,
		bottom: (
			<span className="rb-lock rb-b" style={{ fontSize: 30 }}>
				<WordsB />
			</span>
		),
		note: "The tile's two slots fit as they are: emblem on top, wordmark without emblem below.",
	},
	decorative: "Title case and a color split are the brand, so one-color uppercase GOODWATCH in a card's own type stays copy.",
	spec: [
		{ label: "Palette", value: <Swatches /> },
		{ label: "Type", value: "Gabarito 800, title case, tracking -0.02 em. White \"Good\", yellow \"Watch\"." },
		{ label: "Emblem", value: "Separate, in front: a yellow tile with the G in ink, 0.86 em, centered on the capitals." },
		{ label: "Spacing", value: "Tile to word: 0.3 em. Tile radius 0.2 em. Clear space: one tile." },
		{ label: "Small sizes", value: "Same lockup down to 11px type. Emblem-only: the tile. Wordmark-only is allowed too." },
		{ label: "Light backgrounds", value: "Ink translation, no plate: the type turns ink, the tile turns ink and keeps the yellow G. The color split is lost there." },
		{ label: "Boot", value: "Tile scales in, \"Good\" then \"Watch\" rise into place, the play arrow pulses once. Reduced motion: one 0.3s fade." },
	],
}

// ---------------------------------------------------------------------------------------------------------------
// C. Badge: one enclosed plaque with its own ink field and a yellow keyline. Stacked GOOD over WATCH, set to one
// width, beside a G as tall as both lines. Where there is little height it turns into a one-line pill.
function LockupC({ size }: LockupProps) {
	const H = size * 1.6
	const f = H * 0.362
	return (
		<Label>
			<span className="rb-lock rb-c" style={{ height: H, gap: H * 0.11, padding: `0 ${H * 0.2}px 0 ${H * 0.16}px`, borderWidth: Math.max(1.5, H * 0.035), borderRadius: H * 0.2 }}>
				<G h={H * 0.62} color={WHITE} className="rb-c-g" />
				<span className="rb-c-words" style={{ gap: f * 0.16 }}>
					{/* GOOD is set 1.281 times larger: its width then equals WATCH's at weight 900. */}
					<span className="rb-c-good" style={{ fontSize: f * 1.281, color: WHITE }}>Good</span>
					<span className="rb-c-watch" style={{ fontSize: f, color: YELLOW }}>Watch</span>
				</span>
			</span>
		</Label>
	)
}
function SmallC({ size }: LockupProps) {
	const h = size * 1.3
	return (
		<Label>
			<span className="rb-lock rb-c" style={{ height: h, gap: h * 0.2, padding: `0 ${h * 0.36}px 0 ${h * 0.3}px`, borderWidth: Math.max(1, h * 0.05), borderRadius: h * 0.3, fontSize: h * 0.5, letterSpacing: "0.03em" }}>
				<G h={h * 0.56} color={WHITE} />
				<span>
					<span style={{ color: WHITE }}>Good</span>
					<span style={{ color: YELLOW }}>Watch</span>
				</span>
			</span>
		</Label>
	)
}
function EmblemC({ size }: LockupProps) {
	// Under 16px a keyline and a G no longer fit: the bare white G stands in.
	if (size < 16) return <G h={size} color={WHITE} />
	return (
		<span className="rb-c inline-flex justify-center" style={{ width: size, height: size, borderWidth: Math.max(1, size * 0.05), borderRadius: size * 0.22 }}>
			<G h={size * 0.58} color={WHITE} />
		</span>
	)
}
export const VariantC: BrandSystem = {
	key: "C",
	treatment: "badge",
	name: "Badge",
	line: "A stacked signature sealed in its own plaque: half as wide as the others, and the same on any background.",
	Lockup: LockupC,
	Small: SmallC,
	Emblem: EmblemC,
	bento: {
		top: <LockupC size={52} />,
		bottom: null,
		note: "The stacked badge fills the emblem's slot. The separate name line goes.",
	},
	decorative: "Uppercase is this brand's casing, so uppercase copy sits closer to it. It still stays copy: the brand is the plaque, never loose letters.",
	spec: [
		{ label: "Palette", value: <Swatches /> },
		{ label: "Type", value: "Gabarito 900, uppercase. GOOD (white) over WATCH (yellow), sized to one width." },
		{ label: "Emblem", value: "Inside the plaque, in front, white, as tall as both lines." },
		{ label: "Spacing", value: "Plaque: height H, radius 0.2 H, yellow keyline 0.035 H, width 2.4 H. Clear space: 0.25 H." },
		{ label: "Small sizes", value: "Under 32px height: a one-line pill, same field, keyline and colors. Emblem-only: the G in a square plaque, the bare G under 16px." },
		{ label: "Light backgrounds", value: "Nothing changes: the badge brings its own ink field." },
		{ label: "Boot", value: "The plaque opens from a line like the TV powering on, the G scales in, GOOD drops and WATCH rises. Reduced motion: one 0.3s fade." },
	],
}

// ---------------------------------------------------------------------------------------------------------------
// E. Initial G badge: D inside C's plaque. Same ink field, yellow keyline and stack, but title case at weight 700,
// and the G is the initial of the top row ("ood" follows it), never a separate emblem beside a full "Good".
function LockupE({ size }: LockupProps) {
	const H = size * 1.6
	const f = H * 0.42
	return (
		<Label>
			<span className="rb-lock rb-c rb-e" style={{ height: H, padding: `0 ${H * 0.24}px 0 ${H * 0.2}px`, borderWidth: Math.max(1.5, H * 0.035), borderRadius: H * 0.2, fontSize: f }}>
				<span className="rb-e-words" style={{ gap: f * 0.2 }}>
					<span className="rb-e-top">
						<G h={f * 0.778} color={WHITE} className="rb-e-g" />
						<span className="rb-e-ood">ood</span>
					</span>
					<span className="rb-e-watch">Watch</span>
				</span>
			</span>
		</Label>
	)
}
// Little height: D's horizontal wordmark inside C's one-line outlined pill.
function SmallE({ size }: LockupProps) {
	const h = size * 1.3
	return (
		<Label>
			<span className="rb-lock rb-c rb-e" style={{ height: h, padding: `0 ${h * 0.36}px 0 ${h * 0.3}px`, borderWidth: Math.max(1, h * 0.05), borderRadius: h * 0.3 }}>
				<MarkA size={h * 0.44} whiteGood />
			</span>
		</Label>
	)
}
export const VariantE: BrandSystem = {
	key: "E",
	treatment: "badge",
	name: "Initial G badge",
	line: "D sealed in C's plaque: the white G starts the top row with white \"ood\", yellow \"Watch\" sits below.",
	Lockup: LockupE,
	Small: SmallE,
	Emblem: EmblemC,
	bento: {
		top: <LockupE size={52} />,
		bottom: null,
		note: "The stacked badge fills the emblem's slot. The separate name line goes.",
	},
	decorative: "Title case is the brand, so uppercase GOODWATCH in a card's own type reads clearly as costume. It stays copy.",
	spec: [
		{ label: "Palette", value: <Swatches /> },
		{ label: "Type", value: "Gabarito 700, title case, one size for both rows. White G + \"ood\" over yellow \"Watch\", flush left." },
		{ label: "Emblem", value: "Inside the word, as the initial of the top row. White. Height 0.78 em, on the baseline. No second G." },
		{ label: "Spacing", value: "Plaque: height H, radius 0.2 H, yellow keyline 0.035 H. Type 0.42 H, G to \"ood\" 0.056 em. Clear space: 0.25 H." },
		{ label: "Small sizes", value: "Under 32px height: D's horizontal wordmark in a one-line outlined pill. Emblem-only: C's, the G in a square plaque, the bare G under 16px." },
		{ label: "Light backgrounds", value: "Nothing changes: the badge brings its own ink field." },
		{ label: "Boot", value: "The plaque opens from a line, the top row (G + \"ood\") drops in, \"Watch\" rises. Reduced motion: one 0.3s fade." },
	],
}

export const BRANDS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD, E: VariantE }
