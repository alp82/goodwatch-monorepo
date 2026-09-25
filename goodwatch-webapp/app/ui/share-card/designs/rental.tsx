// "Rental card": a video-store checkout card half out of its kraft pocket.
// Typed titles on ruled lines, rank as the line number, due-date stamps in the theme's ink,
// the #1 poster paper-clipped to the corner, and a handwritten member signature.
import { alpha, Brand, col, fit, flex, Img, kind, pad, svgUri } from "../kit"
import { type CardProps, type CardDesign, hash, type CardTitle, THEMES } from "../model"

const W = 1080
const H = 1350
const CARD_W = 860
const CARD_X = 110
const CARD_Y = 128
const CARD_H = 1110
const PAPER = "#f7f1e1"
const TYPE = "#26211a"
const RULE = "rgba(64, 120, 190, 0.28)"
const MARGIN = "rgba(214, 52, 52, 0.55)"

const lum = (hex: string) => {
	const n = Number.parseInt(hex.slice(1, 7), 16)
	return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
}
// Stamp ink must read on cream paper, so light accents are pushed darker.
const ink = (hex: string) => {
	const n = Number.parseInt(hex.slice(1, 7), 16)
	const k = lum(hex) > 150 ? 0.55 : lum(hex) > 110 ? 0.8 : 1
	const c = (v: number) => Math.round(v * k)
	return `#${[c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

const PAPERCLIP = svgUri(
	`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="150" viewBox="0 0 60 150"><path d="M18 120 V34 a12 12 0 0 1 24 0 V128 a18 18 0 0 1 -36 0 V20 a24 24 0 0 1 48 0 V110" fill="none" stroke="#9aa3ad" stroke-width="6" stroke-linecap="round"/><path d="M18 120 V34 a12 12 0 0 1 24 0 V128 a18 18 0 0 1 -36 0 V20 a24 24 0 0 1 48 0 V110" fill="none" stroke="#e8ecef" stroke-width="2" stroke-linecap="round" transform="translate(-1 -1)"/></svg>`,
)

const dueDate = (date: string, days: number) => {
	const d = new Date(date)
	if (Number.isNaN(d.getTime())) return "DUE"
	d.setDate(d.getDate() + days)
	return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase()
}

function RentalCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const stamp = ink(t.accent)
	const max = 5
	const count = editing ? Math.max(5, Math.min(max, items.length + 1)) : Math.max(1, Math.min(items.length, max))
	const seed = hash(items.map((i) => i.key).join() + title)
	const heading = title || "My top 5"
	const tableH = 580
	// Real cards have blank ruled lines; never draw fewer than five.
	const lines = Math.max(count, 5)
	const rowH = Math.min(116, Math.floor(tableH / lines))
	const dense = rowH < 90
	const thumbH = rowH - (dense ? 12 : 22)
	const thumbW = Math.round(thumbH / 1.5)
	const first = items[0]
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: t.ink, fontFamily: "Space Mono", color: TYPE, overflow: "hidden" })}>
			{/* Desk: warm pool of lamp light tinted by the theme. */}
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: `radial-gradient(ellipse at 40% 35%, ${alpha(t.accent, 0.28)} 0%, ${alpha(t.accent, 0.06)} 45%, ${alpha("#000000", 0)} 75%)` }} />
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, ${alpha("#000000", 0)} 60%, ${alpha("#000000", 0.5)} 100%)` }} />

			<div style={flex({ position: "absolute", top: 42, left: 70, right: 70, justifyContent: "space-between", alignItems: "center" })}>
				<Brand color="#ffffff" size={40} />
			</div>

			{/* The card. Shadow sits on the inner body (a blurred shadow on the rotated parent crashes resvg). */}
			<div style={col({ position: "absolute", left: CARD_X, top: CARD_Y, width: CARD_W, height: CARD_H, transform: "rotate(-1.6deg)" })}>
				<div style={col({ position: "relative", width: CARD_W, height: CARD_H, backgroundColor: PAPER, borderRadius: 10, boxShadow: `0 30px 60px ${alpha("#000000", 0.55)}`, padding: "40px 48px 0 48px" })}>
					<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, borderRadius: 10, backgroundImage: `radial-gradient(ellipse at 70% 20%, ${alpha("#ffffff", 0.6)} 0%, ${alpha("#ffffff", 0)} 55%), linear-gradient(180deg, ${alpha("#b89b62", 0)} 60%, ${alpha("#b89b62", 0.18)} 100%)` }} />

					<div style={col({ marginTop: 8, gap: 4, paddingRight: 200 })}>
						<div style={{ display: "flex", fontSize: 16, letterSpacing: 4, color: alpha(TYPE, 0.5) }}>LIST</div>
						<div data-edit="title" style={{ display: "flex", fontWeight: 700, fontSize: fit(heading, [[18, 50], [30, 40], [46, 32], [999, 26]]), lineHeight: 1.12, textTransform: "uppercase", letterSpacing: -0.5 }}>
							{heading}
						</div>
					</div>

					{/* Column heads */}
					<div style={flex({ marginTop: 44, height: 40, alignItems: "flex-end", fontSize: 16, letterSpacing: 4, color: alpha(TYPE, 0.55), borderBottom: `3px solid ${alpha(TYPE, 0.8)}`, paddingBottom: 8 })}>
						<div style={{ display: "flex", width: 70 }}>NO.</div>
						<div style={{ display: "flex", flex: 1 }}>TITLE</div>
						<div style={{ display: "flex", width: 190, justifyContent: "center" }}>DATE DUE</div>
					</div>

					<div style={col({ position: "relative", height: rowH * lines })}>
						<div style={{ display: "flex", position: "absolute", top: 0, left: 56, width: 3, height: rowH * lines, backgroundColor: MARGIN }} />
						{Array.from({ length: lines }, (_, i) => {
							const item: CardTitle | undefined = items[i]
							if (i >= count) return <div key={`line-${i}`} style={{ display: "flex", height: rowH, borderBottom: `2px solid ${RULE}` }} />
							const rot = ((seed >> (i * 3)) % 9) - 6
							return (
								<div key={item?.key ?? `empty-${i}`} data-slot={i} style={flex({ position: "relative", height: rowH, alignItems: "center", borderBottom: `2px solid ${RULE}` })}>
									<div style={{ display: "flex", width: 70, fontSize: dense ? 24 : 30, fontWeight: 700, color: alpha(TYPE, 0.75) }}>{pad(i + 1)}</div>
									{item ? (
										<Img src={item.poster} w={thumbW} h={thumbH} style={{ borderRadius: 3, boxShadow: `0 3px 8px ${alpha("#000000", 0.35)}`, flexShrink: 0 }} />
									) : (
										<div style={{ display: "flex", width: thumbW, height: thumbH, border: `3px dashed ${alpha(TYPE, 0.3)}`, borderRadius: 3, flexShrink: 0 }} />
									)}
									<div style={col({ flex: 1, marginLeft: 22, gap: dense ? 0 : 4, minWidth: 0 })}>
										<div style={{ display: "flex", fontSize: item ? fit(item.title, dense ? [[22, 26], [34, 21], [999, 18]] : [[20, 34], [30, 28], [44, 23], [999, 20]]) : 26, fontWeight: 700, lineHeight: 1.1, textTransform: "uppercase", color: item ? TYPE : alpha(TYPE, 0.3) }}>
											{item?.title ?? "________________"}
										</div>
										{item && (
											<div style={{ display: "flex", fontSize: dense ? 15 : 18, letterSpacing: 2, color: alpha(TYPE, 0.55), textTransform: "uppercase" }}>
												{[item.year, kind(item), item.score != null ? `GW ${item.score}` : null].filter(Boolean).join(" · ")}
											</div>
										)}
									</div>
									<div style={flex({ width: 190, justifyContent: "center" })}>
										{item && (
											<div
												style={col({
													alignItems: "center",
													padding: dense ? "2px 12px" : "6px 16px",
													border: `${dense ? 3 : 4}px solid ${stamp}`,
													borderRadius: 8,
													color: stamp,
													opacity: 0.82,
													transform: `rotate(${rot}deg)`,
													lineHeight: 1,
												})}
											>
												<div style={{ display: "flex", fontSize: dense ? 12 : 14, letterSpacing: 4 }}>DUE</div>
												<div style={{ display: "flex", fontSize: dense ? 22 : 30, fontWeight: 700, letterSpacing: 1 }}>{dueDate(date, (i + 1) * 3)}</div>
											</div>
										)}
									</div>
								</div>
							)
						})}
					</div>

					<div style={flex({ marginTop: 26, alignItems: "flex-end", gap: 18 })}>
						<div style={{ display: "flex", fontSize: 16, letterSpacing: 4, color: alpha(TYPE, 0.55), paddingBottom: 10 }}>SIGNED</div>
						<div data-edit="name" style={flex({ flex: 1, borderBottom: `2px solid ${alpha(TYPE, 0.5)}`, paddingBottom: 2, paddingLeft: 10 })}>
							<div style={{ display: "flex", fontFamily: "Permanent Marker", fontSize: fit(name || "a movie person", [[14, 44], [22, 36], [999, 28]]), color: "#1f3f8f", transform: "rotate(-2deg)" }}>
								{name || "a movie person"}
							</div>
						</div>
					</div>

					{/* Clipped #1 poster with its paperclip. */}
					<div style={col({ position: "absolute", top: 22, right: 44, width: 154, transform: "rotate(4deg)" })}>
						<div style={flex({ padding: 7, backgroundColor: "#ffffff", boxShadow: `0 12px 24px ${alpha("#000000", 0.35)}` })}>
							{first ? <Img src={first.poster} w={140} h={210} /> : <div data-slot={0} style={{ display: "flex", width: 140, height: 210, backgroundColor: alpha(TYPE, 0.12) }} />}
						</div>
						<img src={PAPERCLIP} width={40} height={100} style={{ position: "absolute", top: -34, left: 22, width: 40, height: 100 }} />
					</div>
				</div>
			</div>

			{/* Kraft pocket, painted over the bottom of the card. */}
			<div style={col({ position: "absolute", left: 80, top: CARD_Y + CARD_H - 60, width: 920, height: H - (CARD_Y + CARD_H - 60) + 40, backgroundColor: "#c79f62", borderRadius: "14px 14px 0 0", boxShadow: `0 -10px 30px ${alpha("#000000", 0.35)}`, padding: "22px 44px", backgroundImage: `linear-gradient(180deg, ${alpha("#ffffff", 0.18)} 0%, ${alpha("#ffffff", 0)} 30%)` })}>
				<div style={flex({ justifyContent: "space-between", alignItems: "center", color: "#3d2a10" })}>
					<div style={flex({ alignItems: "center", gap: 14, fontSize: 20, fontWeight: 700, letterSpacing: 4 })}>
						<div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent }} />
						PLEASE BE KIND · REWIND
					</div>
					<div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>goodwatch.app</div>
				</div>
				<div style={flex({ marginTop: 18, justifyContent: "space-between" })}>
					{Array.from({ length: 46 }, (_, i) => (
						<div key={i} style={{ display: "flex", width: 10, height: 3, backgroundColor: alpha("#3d2a10", 0.35) }} />
					))}
				</div>
				<div style={{ display: "flex", marginTop: 14, fontFamily: "Anton", fontSize: 76, lineHeight: 1, letterSpacing: 6, color: alpha("#3d2a10", 0.16) }}>VIDEO CLUB</div>
			</div>
		</div>
	)
}

export const rental: CardDesign = { key: "rental", name: "Rental card", format: "Post 4:5", w: W, h: H, Card: RentalCard }
