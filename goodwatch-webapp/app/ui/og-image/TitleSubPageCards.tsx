// The cards of a title's sub-pages (/movie|show/<key>/fingerprint, /tropes, /at-a-glance), each with the poster at
// the left:
// - Fingerprint: the poster beside an ink panel with the tag, the title and its strongest feelings, one line each in
//   the feeling's color, sized by strength.
// - Tropes: a small poster with the title and the count under it, beside a cloud of the title's tropes on amber
//   (signature tropes first, set largest).
// - At a glance: the poster beside the title and six fact tiles on amber.
// Words around the title's own data live in copy.ts (TITLE_SUB_PAGE_CARD_COPY). Image fields hold data URIs.
import type { CSSProperties } from "react"
import { TITLE_SUB_PAGE_CARD_COPY as COPY } from "~/ui/og-image/copy"
import {
	AMBER,
	Brand,
	Frame,
	HEADLINE_LINE_HEIGHT,
	HEIGHT,
	Headline,
	INK,
	Picture,
	Tag,
	col,
	fitHeadline,
} from "~/ui/og-image/parts"

export interface OgTitleFingerprintContent {
	kind: "title-fingerprint"
	/** "Fingerprint · Movie · 2021" */
	tag: string
	title: string
	poster: string | null
	/** The strongest feelings, strongest first, at most four: words, color, size from 0 (smallest) to 1. */
	lines: { text: string; color: string; size: number }[]
}

export interface OgTitleTropesContent {
	kind: "title-tropes"
	title: string
	poster: string | null
	total: number
	/** Up to ten trope names, signature tropes first. */
	tropes: string[]
}

export interface OgTitleGlanceContent {
	kind: "title-glance"
	title: string
	poster: string | null
	/** Up to six facts. */
	tiles: { label: string; value: string }[]
}

const SIDE = 56
const POSTER_W = 420
const DARK = "#0b0f17"
const TEXT_LEFT = POSTER_W + SIDE
const TEXT_W = 1200 - TEXT_LEFT - SIDE

const clip = (text: string, max: number) =>
	text.length > max ? `${text.slice(0, max - 1).trim()}…` : text

function PosterPanel({ src }: { src: string | null }) {
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: POSTER_W,
				height: HEIGHT,
				display: "flex",
				backgroundColor: "#1f2937",
			}}
		>
			<Picture
				src={src}
				alignTop
				style={{ top: 0, left: 0, width: POSTER_W, height: HEIGHT }}
			/>
		</div>
	)
}

// --- Fingerprint ---------------------------------------------------------------------------------------------------

const LINE_GAP = 10
const lineSize = (size: number) => Math.round(30 + size * 18)

export function TitleFingerprintCard({
	content,
}: { content: OgTitleFingerprintContent }) {
	const lines = content.lines.slice(0, 4)
	const linesHeight = lines.reduce(
		(sum, l) => sum + lineSize(l.size) * 1.25 + LINE_GAP,
		0,
	)
	// Between the brand (top 44, about 60 tall) and the lines: the tag and the title.
	const titleHeight = HEIGHT - 130 - 50 - 30 - LINE_GAP - 12 - linesHeight
	const fit = fitHeadline(content.title, {
		width: TEXT_W,
		height: titleHeight,
		max: 84,
		min: 44,
	})
	return (
		<Frame bg={DARK}>
			<PosterPanel src={content.poster} />
			<div
				style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}
			>
				<Brand />
			</div>
			<div
				style={col({
					position: "absolute",
					left: TEXT_LEFT,
					top: 130,
					width: TEXT_W,
					bottom: 50,
					justifyContent: "flex-end",
					gap: LINE_GAP,
				})}
			>
				<div
					style={{
						display: "flex",
						fontSize: 24,
						fontWeight: 900,
						letterSpacing: 3,
						color: AMBER,
					}}
				>
					{content.tag.toUpperCase()}
				</div>
				<div
					style={{
						display: "flex",
						paddingTop: fit.accentRoom,
						maxHeight: titleHeight,
						overflow: "hidden",
						fontFamily: "Anton",
						fontSize: fit.fontSize,
						lineHeight: HEADLINE_LINE_HEIGHT,
						color: "#fff",
						marginBottom: 12,
					}}
				>
					{fit.text}
				</div>
				{lines.map((line) => (
					<div
						key={line.text}
						style={{
							display: "flex",
							fontSize: lineSize(line.size),
							lineHeight: 1.25,
							fontWeight: 900,
							color: line.color,
							whiteSpace: "nowrap",
						}}
					>
						{line.text}
					</div>
				))}
			</div>
		</Frame>
	)
}

// --- Tropes --------------------------------------------------------------------------------------------------------

const CLOUD_LEFT = 300
// The first two names set largest, the next three middle, the rest smallest in a lighter ink.
const tropeSize = (i: number) => (i < 2 ? 64 : i < 5 ? 46 : 34)
const LIGHT_INK = "rgba(10,10,10,0.62)"

export function TitleTropesCard({
	content,
}: { content: OgTitleTropesContent }) {
	return (
		<Frame>
			<div
				style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}
			>
				<Brand dark />
			</div>
			<div
				style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}
			>
				<Tag text={COPY.tropesTag} />
			</div>
			<div
				style={{
					display: "flex",
					position: "absolute",
					left: SIDE,
					top: 150,
					width: 200,
					height: 300,
					borderRadius: 14,
					overflow: "hidden",
					backgroundColor: "#1f2937",
					border: `4px solid ${INK}`,
				}}
			>
				<Picture
					src={content.poster}
					alignTop
					style={{ top: 0, left: 0, width: 200, height: 300 }}
				/>
			</div>
			<div
				style={col({
					position: "absolute",
					left: SIDE,
					top: 470,
					width: 200,
					gap: 2,
				})}
			>
				<div
					style={{
						display: "flex",
						fontSize: 22,
						fontWeight: 900,
						letterSpacing: 2,
						color: INK,
					}}
				>
					{clip(content.title.toUpperCase(), 32)}
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 20,
						fontWeight: 700,
						color: INK,
						opacity: 0.7,
					}}
				>
					{COPY.tropesCount(content.total)}
				</div>
			</div>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					position: "absolute",
					left: CLOUD_LEFT,
					top: 120,
					width: 1200 - CLOUD_LEFT - SIDE,
					height: 470,
					overflow: "hidden",
					alignItems: "center",
					alignContent: "center",
					justifyContent: "center",
					columnGap: 26,
					rowGap: 6,
				}}
			>
				{content.tropes.slice(0, 10).map((name, i) => (
					<div
						key={name}
						style={{
							display: "flex",
							fontFamily: "Anton",
							fontSize: tropeSize(i),
							lineHeight: 1.08,
							letterSpacing: 1,
							color: i >= 5 ? LIGHT_INK : INK,
							whiteSpace: "nowrap",
						}}
					>
						{clip(name.toUpperCase(), 30)}
					</div>
				))}
			</div>
		</Frame>
	)
}

// --- At a glance ---------------------------------------------------------------------------------------------------

const TILE: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	justifyContent: "space-between",
	// Three to a row in the text column: 3 x 212 + 2 x 14 = 664 of its 668 px.
	width: 212,
	height: 120,
	backgroundColor: INK,
	borderRadius: 16,
	padding: "14px 18px",
}
const TILES_HEIGHT = 2 * 120 + 14
// A value stays on one line: about nine characters fit at the largest size ("2 h 35 min" has narrow spaces).
const valueSize = (value: string) =>
	value.length > 13 ? 22 : value.length > 10 ? 26 : 36
const GLANCE_TOP = 130

export function TitleGlanceCard({
	content,
}: { content: OgTitleGlanceContent }) {
	return (
		<Frame>
			<PosterPanel src={content.poster} />
			<div
				style={{
					position: "absolute",
					top: 44,
					left: TEXT_LEFT,
					display: "flex",
				}}
			>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: TEXT_LEFT,
					top: GLANCE_TOP,
					width: TEXT_W,
					bottom: 52,
					gap: 16,
					justifyContent: "flex-end",
				})}
			>
				<Headline
					text={content.title}
					width={TEXT_W}
					height={HEIGHT - GLANCE_TOP - 52 - 16 - TILES_HEIGHT}
					max={80}
				/>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
					{content.tiles.slice(0, 6).map((tile) => (
						<div key={tile.label} style={TILE}>
							<div
								style={{
									display: "flex",
									fontSize: 18,
									fontWeight: 900,
									letterSpacing: 2,
									color: "rgba(251,191,36,0.75)",
								}}
							>
								{tile.label.toUpperCase()}
							</div>
							<div
								style={{
									display: "flex",
									fontSize: valueSize(tile.value),
									whiteSpace: "nowrap",
									fontWeight: 900,
									color: AMBER,
								}}
							>
								{clip(tile.value, 16)}
							</div>
						</div>
					))}
				</div>
			</div>
		</Frame>
	)
}
