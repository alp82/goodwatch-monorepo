// The /for-you card: an amber bar with the logo across the top; under it a dimmed wall of top-scored posters that fades
// into black, "FOR YOU" over the wall's second row and the line on the black below. The example taste print, on a dark
// disc with the five family pills as on the page, fills the left and overlaps the bar.
// Satori: flex only, every multi-child element needs display:flex, no text inside <svg>, overlay <svg>s need a viewBox.
import { FOR_YOU_CARD_COPY } from "~/ui/og-image/copy"
import { AMBER, Brand, INK, row } from "~/ui/og-image/parts"
import { type WhorlAttribute, build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"

export interface OgForYouContent {
	kind: "for-you"
	/** The example taste's attributes, as the page shows them to visitors. */
	attributes: WhorlAttribute[]
	/** Top-scored posters for the wall, best first, up to 16. */
	posters: (string | null)[]
}

const BG = "#0b0f17"
const BAR_H = 90
const WALL_POSTER_W = 146
const WALL_TOP = BAR_H - 40
const DISC = { left: 30, top: 15, size: 600 }
// Wall slots (row-major, eight per row) in fill order: right half, left edge, then the ones under the disc.
const WALL_SLOTS = [4, 5, 6, 7, 12, 13, 14, 15, 0, 8, 1, 9, 2, 10, 3, 11]

/** The print at `size` px with its family pills round the rim. */
function Print({
	attributes,
	size,
	pill = 22,
}: { attributes: WhorlAttribute[]; size: number; pill?: number }) {
	const g = build(attributes, 18, true)
	const b = g.box + 30 // room for the pills outside the rim
	const s = size / (2 * b)
	const px = (x: number, y: number) => ({ x: (x + b) * s, y: (y + b) * s })
	const pillH = Math.round(pill * 1.9)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: size,
				height: size,
			}}
		>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image; the alt text comes from the page meta */}
			<svg width={size} height={size} viewBox={`${-b} ${-b} ${b * 2} ${b * 2}`}>
				{g.turns.flatMap((turn, i) =>
					turn.paths.map((p, j) => (
						<path
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed geometry
							key={`${i}-${j}`}
							d={p.d}
							fill="none"
							stroke={FAMILY_COLOR[p.family]}
							strokeOpacity={p.opacity}
							strokeWidth={2.4}
							strokeLinecap="round"
						/>
					)),
				)}
				{g.markers.map((m) => (
					<circle
						key={m.a.key}
						cx={m.x}
						cy={m.y}
						r={m.r}
						fill={m.a.edge > 0 ? FAMILY_COLOR[m.a.family] : "none"}
						stroke={FAMILY_COLOR[m.a.family]}
						strokeWidth={m.a.edge > 0 ? 0 : 1.2}
					/>
				))}
			</svg>
			{g.labels.map((l) => {
				const p = px(l.x, l.y)
				const word = FOR_YOU_CARD_COPY.families[l.id].toUpperCase()
				const w = Math.round(word.length * pill * 0.78 + pill * 1.7)
				return (
					<div
						key={l.id}
						style={{
							display: "flex",
							position: "absolute",
							left: p.x - w / 2,
							top: p.y - pillH / 2,
							width: w,
							height: pillH,
							alignItems: "center",
							justifyContent: "center",
							borderRadius: pillH,
							backgroundColor: INK,
							border: `3px solid ${FAMILY_COLOR[l.id]}`,
							fontSize: pill,
							fontWeight: 900,
							letterSpacing: 1.5,
							color: FAMILY_COLOR[l.id],
						}}
					>
						{word}
					</div>
				)
			})}
		</div>
	)
}

function Poster({ src, w }: { src: string | null; w: number }) {
	const h = Math.round(w * 1.5)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: w,
				height: h,
				borderRadius: Math.round(w / 12),
				overflow: "hidden",
				backgroundColor: "#1f2937",
				border: "2px solid rgba(255,255,255,0.12)",
			}}
		>
			{src && (
				<img
					alt=""
					src={src}
					width={w}
					height={h}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: w,
						height: h,
						objectFit: "cover",
					}}
				/>
			)}
		</div>
	)
}

const at = (left: number, top: number) =>
	({ display: "flex", position: "absolute", left, top }) as const

export function ForYouCard({ content }: { content: OgForYouContent }) {
	// Two rows of eight, each poster once. The best go where the disc doesn't cover them: the right half first, then the
	// left edge; with fewer posters the covered slots stay empty.
	const shown = content.posters.filter((p): p is string => Boolean(p))
	const wall: (string | null)[] = Array(WALL_SLOTS.length).fill(null)
	WALL_SLOTS.forEach((slot, i) => {
		wall[slot] = shown[i] ?? null
	})
	const [first, second] = FOR_YOU_CARD_COPY.title
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: 1200,
				height: 630,
				backgroundColor: BG,
				overflow: "hidden",
			}}
		>
			<div
				style={row({
					position: "absolute",
					left: -20,
					top: WALL_TOP,
					width: 1260,
					flexWrap: "wrap",
					gap: 12,
					opacity: 0.55,
				})}
			>
				{wall.map((src, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed wall
					<Poster key={i} src={src} w={WALL_POSTER_W} />
				))}
			</div>
			<div
				style={{
					display: "flex",
					position: "absolute",
					inset: 0,
					backgroundImage:
						"linear-gradient(90deg, rgba(11,15,23,0.94) 0%, rgba(11,15,23,0.88) 55%, rgba(11,15,23,0.78) 100%)",
				}}
			/>
			{/* The wall's lower edge fades into the background, so the line below sits on plain black. */}
			<div
				style={{
					...at(0, BAR_H + 290),
					width: 1200,
					height: 130,
					backgroundImage: `linear-gradient(180deg, rgba(11,15,23,0) 0%, ${BG} 100%)`,
				}}
			/>
			<div
				style={row({
					position: "absolute",
					left: 0,
					top: 0,
					width: 1200,
					height: BAR_H,
					backgroundColor: AMBER,
					alignItems: "center",
					justifyContent: "flex-end",
					padding: "0 44px",
				})}
			>
				<Brand dark size={44} />
			</div>
			<div
				style={{
					...at(DISC.left, DISC.top),
					width: DISC.size,
					height: DISC.size,
					borderRadius: DISC.size,
					backgroundColor: BG,
					border: "2px solid rgba(255,255,255,0.08)",
				}}
			/>
			<div style={at(DISC.left, DISC.top)}>
				<Print attributes={content.attributes} size={DISC.size} />
			</div>
			{/* Centered on the wall's second row. */}
			<div
				style={{
					...at(690, BAR_H + 226),
					fontFamily: "Anton",
					fontSize: 150,
					lineHeight: 1,
					gap: 33,
				}}
			>
				<div style={{ display: "flex", color: "#ffffff" }}>
					{first.toUpperCase()}
				</div>
				<div style={{ display: "flex", color: AMBER }}>
					{second.toUpperCase()}
				</div>
			</div>
			<div
				style={{
					...at(692, BAR_H + 428),
					width: 470,
					fontSize: 30,
					fontWeight: 700,
					lineHeight: 1.25,
					color: "#d1d5db",
				}}
			>
				{FOR_YOU_CARD_COPY.line}
			</div>
		</div>
	)
}
