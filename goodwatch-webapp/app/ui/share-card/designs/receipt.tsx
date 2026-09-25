// "Receipt": a 9:16 story. A thermal-paper receipt for the list, tilted on a loud color field.
import type { ReactNode } from "react"
import { alpha, Brand, col, fit, flex, kind, pad, svgUri } from "../kit"
import { type CardDesign, type CardProps, type CardTitle, hash, THEMES } from "../model"

// 9:16 story. A thermal-paper receipt for your taste, tilted on a loud color field.
// Pure typography, no posters: it reads instantly and looks nothing like a streaming UI.
const RECEIPT_W = 820
const zigzag = (color: string, flip: boolean) => {
	const tooth = 20
	const h = 22
	let d = flip ? "M0 0" : `M0 ${h}`
	for (let x = 0; x < RECEIPT_W; x += tooth) d += flip ? ` L${x + tooth / 2} ${h} L${x + tooth} 0` : ` L${x + tooth / 2} 0 L${x + tooth} ${h}`
	d += " Z"
	return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${RECEIPT_W}" height="${h}" viewBox="0 0 ${RECEIPT_W} ${h}"><path d="${d}" fill="${color}"/></svg>`)
}
// Drawn dashes: resvg panics on a zero-height box with a dashed border.
const Rule = () => (
	<div style={flex({ justifyContent: "space-between", margin: "26px 0" })}>
		{Array.from({ length: 35 }, (_, i) => (
			<div key={i} style={{ display: "flex", width: 12, height: 3, backgroundColor: "#2b2b2b" }} />
		))}
	</div>
)
const Line = ({ l, r, size = 26, bold = false }: { l: ReactNode; r: ReactNode; size?: number; bold?: boolean }) => (
	<div style={flex({ justifyContent: "space-between", fontSize: size, fontWeight: bold ? 700 : 400, lineHeight: 1.45 })}>
		<div style={{ display: "flex" }}>{l}</div>
		<div style={{ display: "flex" }}>{r}</div>
	</div>
)

export function ReceiptCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const paper = "#fbf9f2"
	const ink = "#1c1c1c"
	const seed = hash(items.map((i) => i.key).join(",") + title)
	const scores = items.map((i) => i.score).filter((s): s is number => s != null)
	const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
	const dense = items.length > 5
	const bars = Array.from({ length: 58 }, (_, i) => 2 + ((((seed >>> (i % 29)) ^ (i * 7919)) >>> 0) % 7))
	const shown = editing && items.length < 5 ? [...items, ...Array(5 - items.length).fill(null)] : items
	return (
		<div
			style={col({
				position: "relative",
				width: 1080,
				height: 1920,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: t.accent,
				backgroundImage: `radial-gradient(circle at 20% 10%, ${alpha(t.accent2, 0.9)} 0%, ${alpha(t.accent2, 0)} 55%)`,
				fontFamily: "Space Mono",
				color: ink,
				overflow: "hidden",
			})}
		>
			<div style={col({ width: RECEIPT_W, transform: "rotate(-2.5deg)" })}>
				<img src={zigzag(paper, false)} width={RECEIPT_W} height={22} style={{ display: "flex", width: RECEIPT_W, height: 22 }} />
				<div style={col({ position: "relative", backgroundColor: paper, padding: "40px 64px 48px", boxShadow: `0 40px 60px ${alpha(t.ink, 0.35)}` })}>
					<div style={col({ alignItems: "center", gap: 6 })}>
						<Brand color={ink} size={58} />
						<div style={{ display: "flex", fontSize: 26, letterSpacing: 8, marginTop: 14 }}>*** TASTE RECEIPT ***</div>
					</div>
					<Rule />
					<Line l="DATE" r={date.toUpperCase()} />
					<Line l="ORDER" r={`#${String(seed % 1000000).padStart(6, "0")}`} />
					<div data-edit="name" style={col({})}>
						<Line l="CURATOR" r={(name || "ANONYMOUS").toUpperCase()} />
					</div>
					<Rule />
					<div data-edit="title" style={{ display: "flex", fontSize: fit(title, [[18, 50], [30, 42], [999, 34]]), fontWeight: 700, lineHeight: 1.15, textTransform: "uppercase" }}>
						{title || "My top 5"}
					</div>
					<Rule />
					<div style={col({ gap: dense ? 10 : 22 })}>
						{shown.map((item: CardTitle | null, i) => (
							<div key={item?.key ?? `empty-${i}`} data-slot={i} style={col({})}>
								<div style={flex({ fontSize: dense ? 26 : 32, fontWeight: 700, lineHeight: 1.2 })}>
									<div style={{ display: "flex", width: dense ? 58 : 70, flexShrink: 0 }}>{pad(i + 1)}</div>
									<div style={{ display: "flex", flex: 1, textTransform: "uppercase", color: item ? ink : alpha(ink, 0.3) }}>
										{item?.title ?? "_ _ _ _ _ _ _ _"}
									</div>
									<div style={{ display: "flex", marginLeft: 20 }}>{item?.score != null ? item.score : ""}</div>
								</div>
								{item && (
									<div style={{ display: "flex", marginLeft: dense ? 58 : 70, fontSize: dense ? 20 : 22, color: alpha(ink, 0.6), textTransform: "uppercase" }}>
										{[item.year, item.genre ?? kind(item)].filter(Boolean).join(" · ")}
									</div>
								)}
							</div>
						))}
					</div>
					<Rule />
					<Line l="ITEMS" r={items.length} />
					{avg != null && <Line l="AVG GOODWATCH SCORE" r={avg} />}
					<Line l="TOTAL" r="NO REGRETS" size={34} bold />
					<Rule />
					<div style={flex({ justifyContent: "center", alignItems: "flex-end", height: 96, gap: 3, marginTop: 6 })}>
						{bars.map((w, i) => (
							<div key={i} style={{ display: "flex", width: w, height: i % 11 === 0 ? 96 : 84, backgroundColor: i % 3 === 2 ? paper : ink }} />
						))}
					</div>
					<div style={col({ alignItems: "center", marginTop: 22, fontSize: 24, letterSpacing: 4 })}>
						<div style={{ display: "flex" }}>THANK YOU FOR WATCHING</div>
						<div style={{ display: "flex", fontWeight: 700 }}>MAKE YOURS AT GOODWATCH.APP</div>
					</div>

					<div
						style={col({
							position: "absolute",
							right: -40,
							top: 18,
							width: 210,
							height: 210,
							borderRadius: 999,
							border: `7px solid ${alpha("#d62828", 0.8)}`,
							alignItems: "center",
							justifyContent: "center",
							transform: "rotate(-16deg)",
							color: alpha("#d62828", 0.85),
							fontWeight: 700,
							fontSize: 26,
							letterSpacing: 2,
							lineHeight: 1.1,
						})}
					>
						<div style={{ display: "flex" }}>CERTIFIED</div>
						<div style={{ display: "flex", fontSize: 50, fontFamily: "Anton", letterSpacing: 1 }}>GOOD</div>
						<div style={{ display: "flex" }}>TASTE</div>
					</div>
				</div>
				<img src={zigzag(paper, true)} width={RECEIPT_W} height={22} style={{ display: "flex", width: RECEIPT_W, height: 22 }} />
			</div>
		</div>
	)
}

export const receipt: CardDesign = { key: "receipt", name: "Receipt", format: "Story 9:16", w: 1080, h: 1920, Card: ReceiptCard }
