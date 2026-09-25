// "Bento": a square grid of rounded tiles. #1 gets the big backdrop tile,
// the title and the brand get tiles of their own, empty ranks turn into stat tiles on export.
import type { CSSProperties, ReactNode } from "react"
import { alpha, col, fit, flex, kind, logo, Placeholder } from "../kit"
import { type CardProps, type CardDesign, type CardTitle, THEMES } from "../model"

const S = 1080
const PAD = 36
const GAP = 18
const R = 32
const INNER = S - 2 * PAD
const TOP_H = 580
const BOTTOM_H = INNER - TOP_H - GAP
const LEFT_W = 630
const RIGHT_W = INNER - LEFT_W - GAP
const TITLE_H = 340
const SECOND_H = TOP_H - TITLE_H - GAP
const BRAND_W = 240
const SMALL_W = (INNER - BRAND_W - 3 * GAP) / 3

type Theme = (typeof THEMES)[keyof typeof THEMES]

const Tile = ({ w, h, style, children, slot }: { w: number; h: number; style?: CSSProperties; children?: ReactNode; slot?: number }) => (
	<div data-slot={slot} style={col({ position: "relative", width: w, height: h, borderRadius: R, overflow: "hidden", flexShrink: 0, ...style })}>
		{children}
	</div>
)

const Glass = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
	<div
		style={flex({
			alignItems: "center",
			gap: 12,
			backgroundColor: "rgba(12,12,14,0.58)",
			border: "1.5px solid rgba(255,255,255,0.22)",
			borderRadius: 20,
			padding: "12px 16px",
			color: "#fff",
			...style,
		})}
	>
		{children}
	</div>
)

const Badge = ({ n, t, size = 44 }: { n: number; t: Theme; size?: number }) => (
	<div
		style={flex({
			width: size,
			height: size,
			flexShrink: 0,
			borderRadius: 999,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: t.accent,
			color: t.ink,
			fontSize: size * 0.55,
			fontWeight: 900,
		})}
	>
		{n}
	</div>
)

// Artwork, or a typographic gradient when the title has none.
const Art = ({ src, w, h, item, t }: { src: string | null; w: number; h: number; item: CardTitle; t: Theme }) =>
	src ? (
		<img src={src} width={w} height={h} style={{ display: "flex", position: "absolute", top: 0, left: 0, width: w, height: h, objectFit: "cover" }} />
	) : (
		<div
			style={col({
				position: "absolute",
				top: 0,
				left: 0,
				width: w,
				height: h,
				padding: 24,
				justifyContent: "center",
				backgroundImage: `linear-gradient(160deg, ${alpha(t.accent2, 0.9)}, ${alpha(t.accent, 0.9)})`,
				color: t.ink,
				fontSize: Math.min(64, w * 0.16),
				fontWeight: 900,
				lineHeight: 0.95,
				letterSpacing: -1,
			})}
		>
			<div style={{ display: "flex" }}>{item.title}</div>
		</div>
	)

const Fade = ({ w, h, from = 0.45 }: { w: number; h: number; from?: number }) => (
	<div
		style={{
			display: "flex",
			position: "absolute",
			top: 0,
			left: 0,
			width: w,
			height: h,
			backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) ${Math.round(from * 100)}%, rgba(0,0,0,0.78) 100%)`,
		}}
	/>
)

// A ranked title tile: art, fade, glass label with the rank.
function RankTile({ item, rank, w, h, t, wide }: { item: CardTitle; rank: number; w: number; h: number; t: Theme; wide: boolean }) {
	const src = wide ? (item.backdrop ?? item.poster) : (item.poster ?? item.backdrop)
	return (
		<Tile w={w} h={h} slot={rank - 1}>
			<Art src={src} w={w} h={h} item={item} t={t} />
			{src && <Fade w={w} h={h} from={wide ? 0.35 : 0.55} />}
			<div style={flex({ position: "absolute", left: 14, right: 14, bottom: 14 })}>
				<Glass style={{ flex: 1, padding: wide ? "12px 16px" : "10px 12px" }}>
					<Badge n={rank} t={t} size={wide ? 44 : 38} />
					<div style={col({ flex: 1, minWidth: 0 })}>
						<div style={{ display: "flex", fontSize: wide ? fit(item.title, [[22, 30], [40, 25], [999, 21]]) : fit(item.title, [[12, 21], [24, 18], [999, 16]]), fontWeight: 900, lineHeight: 1.1 }}>
							{item.title}
						</div>
						{(wide || item.year) && (
							<div style={{ display: "flex", fontSize: wide ? 19 : 15, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
								{wide ? [item.year, kind(item), item.score != null ? `${item.score} on GoodWatch` : null].filter(Boolean).join("  ·  ") : item.year}
							</div>
						)}
					</div>
				</Glass>
			</div>
		</Tile>
	)
}

// The #1 tile: a giant numeral sits on the backdrop.
function HeroTile({ item, t }: { item: CardTitle; t: Theme }) {
	const src = item.backdrop ?? item.poster
	return (
		<Tile w={LEFT_W} h={TOP_H} slot={0}>
			<Art src={src} w={LEFT_W} h={TOP_H} item={item} t={t} />
			{src && <Fade w={LEFT_W} h={TOP_H} from={0.3} />}
			<div style={{ display: "flex", position: "absolute", top: 18, left: 30, fontSize: 210, fontWeight: 900, lineHeight: 1, letterSpacing: -10, color: t.accent, textShadow: "0 10px 40px rgba(0,0,0,0.45)" }}>
				1
			</div>
			<div style={col({ position: "absolute", left: 30, right: 30, bottom: 28, gap: 12 })}>
				<div style={{ display: "flex", fontSize: fit(item.title, [[14, 58], [24, 48], [40, 38], [999, 30]]), fontWeight: 900, lineHeight: 1, letterSpacing: -1.5, color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
					{item.title}
				</div>
				<div style={flex({ gap: 10 })}>
					{[item.year, kind(item), item.genre].filter(Boolean).map((x) => (
						<Glass key={String(x)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 18, fontWeight: 700 }}>
							{x}
						</Glass>
					))}
					{item.score != null && (
						<div style={flex({ padding: "6px 14px", borderRadius: 999, fontSize: 18, fontWeight: 900, backgroundColor: t.accent, color: t.ink })}>{`${item.score} GoodWatch`}</div>
					)}
				</div>
			</div>
		</Tile>
	)
}

// Stand-ins for empty ranks on export, so the grid never shows a hole.
function statTiles(items: CardTitle[]) {
	const scores = items.map((i) => i.score).filter((s): s is number => s != null)
	const years = items.map((i) => i.year).filter((y): y is number => y != null)
	const out: { label: string; value: string }[] = []
	if (scores.length) out.push({ label: "Avg GoodWatch score", value: String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)) })
	if (years.length) out.push({ label: years.length > 1 ? `Spanning ${Math.min(...years)} to ${Math.max(...years)}` : "Released", value: years.length > 1 ? `${Math.max(...years) - Math.min(...years)} yrs` : String(years[0]) })
	out.push({ label: items.length === 1 ? "Title, no notes" : "Titles, no skips", value: String(items.length) })
	out.push({ label: "Make yours at", value: "goodwatch.app" })
	return out
}

function StatTile({ w, h, label, value, t }: { w: number; h: number; label: string; value: string; t: Theme }) {
	return (
		<Tile w={w} h={h} style={{ backgroundColor: alpha(t.accent, 0.1), border: `2px solid ${alpha(t.accent, 0.35)}`, padding: 26, justifyContent: "space-between" }}>
			<div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: alpha("#ffffff", 0.6), lineHeight: 1.2 }}>{label}</div>
			<div style={{ display: "flex", fontSize: fit(value, [[2, 120], [4, 92], [7, 64], [999, 32]]), fontWeight: 900, lineHeight: 0.9, letterSpacing: -3, color: t.accent }}>{value}</div>
		</Tile>
	)
}

export function BentoCard({ title, items, name, theme, editing }: CardProps) {
	const t = THEMES[theme]
	const stats = statTiles(items)
	let statIndex = 0
	// Rank 2 is a wide backdrop tile; ranks 3-5 are poster tiles.
	const slot = (rank: number, w: number, h: number, wide: boolean) => {
		const item = items[rank - 1]
		if (item) return <RankTile key={rank} item={item} rank={rank} w={w} h={h} t={t} wide={wide} />
		if (editing) return <Placeholder key={rank} w={w} h={h} n={rank} color="#ffffff" style={{ borderRadius: R, flexShrink: 0 }} />
		const s = stats[statIndex++ % stats.length]
		return <StatTile key={rank} w={w} h={h} label={s.label} value={s.value} t={t} />
	}
	const headline = title || "My top 5"
	return (
		<div
			style={col({
				position: "relative",
				width: S,
				height: S,
				padding: PAD,
				gap: GAP,
				backgroundColor: t.ink,
				backgroundImage: `radial-gradient(circle at 85% 0%, ${alpha(t.accent, 0.28)} 0%, ${alpha(t.accent, 0)} 55%)`,
				fontFamily: "Gabarito",
				color: "#fff",
				overflow: "hidden",
			})}
		>
			<div style={flex({ gap: GAP, height: TOP_H })}>
				{items[0] ? (
					<HeroTile item={items[0]} t={t} />
				) : (
					<Placeholder w={LEFT_W} h={TOP_H} n={1} color="#ffffff" style={{ borderRadius: R, flexShrink: 0 }} />
				)}
				<div style={col({ gap: GAP, width: RIGHT_W })}>
					<Tile w={RIGHT_W} h={TITLE_H} style={{ backgroundImage: `linear-gradient(145deg, ${t.accent} 0%, ${t.accent2} 100%)`, color: t.ink, padding: 28, justifyContent: "space-between" }}>
						<div style={flex({ justifyContent: "space-between", alignItems: "center" })}>
							<div style={{ display: "flex", fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>{`TOP ${Math.max(items.length, 1)}`}</div>
							<div style={flex({ width: 14, height: 14, borderRadius: 999, backgroundColor: t.ink })} />
						</div>
						<div data-edit="title" style={{ display: "flex", fontSize: fit(headline, [[12, 58], [22, 48], [34, 40], [52, 32], [999, 26]]), fontWeight: 900, lineHeight: 0.98, letterSpacing: -1.5 }}>
							{headline}
						</div>
					</Tile>
					{slot(2, RIGHT_W, SECOND_H, true)}
				</div>
			</div>
			<div style={flex({ gap: GAP, height: BOTTOM_H })}>
				{slot(3, SMALL_W, BOTTOM_H, false)}
				{slot(4, SMALL_W, BOTTOM_H, false)}
				{slot(5, SMALL_W, BOTTOM_H, false)}
				<Tile w={BRAND_W} h={BOTTOM_H} style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.14)", padding: 24, justifyContent: "space-between" }}>
					<img src={logo("#fbbf24")} width={62} height={66} style={{ width: 62, height: 66 }} />
					<div style={col({ gap: 6 })}>
						<div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>CURATED BY</div>
						<div style={{ display: "flex", fontSize: fit(name || "someone with taste", [[12, 26], [20, 21], [999, 17]]), fontWeight: 900, color: t.accent2, lineHeight: 1.1, wordBreak: "break-all" }}>
							{name || "someone with taste"}
						</div>
					</div>
					<div style={col({ gap: 2 })}>
						<div style={{ display: "flex", fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>GoodWatch</div>
						<div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>goodwatch.app</div>
					</div>
				</Tile>
			</div>
		</div>
	)
}

export const bento: CardDesign = { key: "bento", name: "Bento", format: "Square 1:1", w: S, h: S, Card: BentoCard }
