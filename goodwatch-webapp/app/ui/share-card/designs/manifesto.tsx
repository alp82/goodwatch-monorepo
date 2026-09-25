// "Manifesto": a bold typographic poster on a full-bleed theme color.
// A giant flush-left headline, a hard-edged poster grid (#1 tall on the left, #2-#5 in a 2x2 on
// the right) with square ink rank tabs, and a numbered index along the bottom.
import { Brand, col, fit, flex } from "../kit"
import { type CardProps, type CardDesign, type CardTitle, THEMES } from "../model"

const W = 1080
const H = 1350
const M = 56 // outer margin
const GAP = 20
const GRID_TOP = 452
const HERO_W = 452
const HERO_H = 678
const CELL_W = (W - 2 * M - HERO_W - GAP - GAP) / 2 // 228
const CELL_H = (HERO_H - GAP) / 2 // 329

type Theme = (typeof THEMES)[keyof typeof THEMES]

// Square ink tab with the rank, pinned to a poster's top-left corner.
const Tab = ({ n, size, t }: { n: number; size: number; t: Theme }) => (
	<div
		style={flex({
			position: "absolute",
			top: 0,
			left: 0,
			width: size,
			height: size,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: t.ink,
			color: t.accent,
			fontFamily: "Gabarito",
			fontWeight: 900,
			fontSize: size * 0.78,
			lineHeight: 1,
			letterSpacing: -size * 0.04,
		})}
	>
		{n}
	</div>
)

// A poster cell: artwork (or a typographic stand-in) with its rank tab.
const Cell = ({ item, n, w, h, t, tab }: { item: CardTitle; n: number; w: number; h: number; t: Theme; tab: number }) => (
	<div data-slot={n - 1} style={flex({ position: "relative", width: w, height: h, backgroundColor: t.ink })}>
		{item.poster ? (
			<img src={item.poster} width={w} height={h} style={{ display: "flex", width: w, height: h, objectFit: "cover" }} />
		) : (
			<div style={col({ width: w, height: h, padding: 18, justifyContent: "flex-end", color: t.accent, fontFamily: "Gabarito", fontWeight: 900, fontSize: Math.round(w * 0.13), lineHeight: 0.95, letterSpacing: -1 })}>
				<div style={{ display: "flex" }}>{item.title}</div>
			</div>
		)}
		<Tab n={n} size={tab} t={t} />
	</div>
)

const Empty = ({ n, w, h, t }: { n: number; w: number; h: number; t: Theme }) => (
	<div
		data-slot={n - 1}
		style={col({ width: w, height: h, alignItems: "center", justifyContent: "center", border: `4px dashed ${t.ink}`, color: t.ink, fontFamily: "Gabarito", fontWeight: 900, fontSize: 40, opacity: 0.55 })}
	>
		<div style={{ display: "flex", fontSize: 72, lineHeight: 1 }}>+</div>
		<div style={{ display: "flex" }}>{`#${n}`}</div>
	</div>
)

// Fills unused grid space in exports so the grid never has holes.
const Stat = ({ w, h, t, big, label }: { w: number; h: number; t: Theme; big: string; label: string }) => (
	<div style={col({ width: w, height: h, padding: 22, justifyContent: "space-between", backgroundColor: t.ink, color: t.accent, fontFamily: "Gabarito" })}>
		<div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>{label}</div>
		<div style={{ display: "flex", fontSize: w > CELL_W ? 170 : 120, fontWeight: 900, lineHeight: 0.8, letterSpacing: -6 }}>{big}</div>
	</div>
)

const WIDE = CELL_W * 2 + GAP
// Widths of the blocks that fill the 2x2 when fewer than four runners-up exist.
const holes = (r: number) => (r >= 4 ? [] : r === 3 ? [CELL_W] : r === 2 ? [WIDE] : r === 1 ? [CELL_W, WIDE] : [WIDE, WIDE])

export function ManifestoCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const ink = t.ink
	const [first, ...rest] = items
	const headline = title || "My top 5"
	const titleSize = fit(headline, [[10, 200], [16, 168], [26, 138], [40, 112], [56, 90], [999, 74]])
	const scores = items.map((i) => i.score).filter((s): s is number => s != null)
	const avg = scores.length ? String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)) : null
	const years = items.map((i) => i.year).filter((y): y is number => !!y)

	// Right-hand 2x2: ranks 2-5, then filler blocks in exports.
	const cells = Array.from({ length: 4 }, (_, i) => rest[i] ?? null)
	const fillers = [
		avg ? { big: avg, label: "AVG SCORE" } : null,
		years.length ? { big: `'${String(Math.min(...years)).slice(2)}`, label: "OLDEST PICK" } : null,
		{ big: String(items.length), label: items.length === 1 ? "TITLE" : "TITLES" },
	].filter((f): f is { big: string; label: string } => !!f)

	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: t.accent, color: ink, fontFamily: "Gabarito", overflow: "hidden" })}>
			{/* Masthead */}
			<div style={flex({ position: "absolute", top: 44, left: M, right: M, alignItems: "center", justifyContent: "space-between" })}>
				<Brand color={ink} size={36} />
				<div style={flex({ gap: 26, fontSize: 20, fontWeight: 700, letterSpacing: 2 })}>
					<div style={{ display: "flex" }}>{`TOP ${String(Math.max(items.length, 1)).padStart(2, "0")}`}</div>
					<div style={{ display: "flex" }}>{date.toUpperCase()}</div>
				</div>
			</div>
			<div style={{ display: "flex", position: "absolute", top: 104, left: M, width: W - 2 * M, height: 8, backgroundColor: ink }} />

			{/* Headline */}
			<div
				data-edit="title"
				style={{
					display: "flex",
					position: "absolute",
					top: 128,
					left: M - 6,
					width: W - 2 * M + 12,
					height: GRID_TOP - 128 - 36,
					alignItems: "flex-end",
					fontSize: titleSize,
					fontWeight: 900,
					lineHeight: 0.84,
					letterSpacing: -titleSize * 0.055,
				}}
			>
				{headline}
			</div>

			{/* Grid */}
			<div style={flex({ position: "absolute", top: GRID_TOP, left: M, gap: GAP })}>
				{first ? <Cell item={first} n={1} w={HERO_W} h={HERO_H} t={t} tab={150} /> : <Empty n={1} w={HERO_W} h={HERO_H} t={t} />}
				<div style={flex({ width: WIDE, flexWrap: "wrap", gap: GAP })}>
					{cells.map((item, i) => {
						if (item) return <Cell key={item.key} item={item} n={i + 2} w={CELL_W} h={CELL_H} t={t} tab={84} />
						if (editing) return <Empty key={`e${i}`} n={i + 2} w={CELL_W} h={CELL_H} t={t} />
						return null
					})}
					{/* Export: fill the holes left by a short list with ink stat blocks. */}
					{!editing && holes(rest.length).map((w, i) => (fillers[i] ? <Stat key={`s${i}`} w={w} h={CELL_H} t={t} {...fillers[i]} /> : null))}
				</div>
			</div>

			{/* Index */}
			<div style={col({ position: "absolute", left: M, right: M, top: GRID_TOP + HERO_H + 22, gap: 0 })}>
				<div style={{ display: "flex", height: 4, backgroundColor: ink }} />
				<div style={flex({ flexWrap: "wrap", columnGap: 30, rowGap: 2, paddingTop: 12, fontSize: items.length > 3 ? 23 : 27, fontWeight: 900, letterSpacing: -0.3 })}>
					{items.map((item, i) => (
						<div key={item.key} style={flex({ gap: 9 })}>
							<div style={{ display: "flex", fontWeight: 400 }}>{String(i + 1).padStart(2, "0")}</div>
							<div style={{ display: "flex" }}>{item.title}</div>
						</div>
					))}
				</div>
			</div>

			{/* Footer */}
			<div style={flex({ position: "absolute", left: M, right: M, bottom: 38, justifyContent: "space-between", alignItems: "flex-end", fontSize: 20, fontWeight: 700, letterSpacing: 1 })}>
				<div style={flex({ gap: 10 })}>
					<div style={{ display: "flex", fontWeight: 400 }}>Curated by</div>
					<div style={{ display: "flex" }}>{name || "someone with taste"}</div>
				</div>
				<div style={flex({ gap: 10 })}>
					<div style={{ display: "flex", fontWeight: 400 }}>Make yours at</div>
					<div style={{ display: "flex" }}>goodwatch.app</div>
				</div>
			</div>
		</div>
	)
}

export const manifesto: CardDesign = { key: "manifesto", name: "Manifesto", format: "Post 4:5", w: W, h: H, Card: ManifestoCard }
