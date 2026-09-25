// "Ceremony": a premium awards presentation. Black marble plinths in 2-1-3
// order under spotlight cones, posters in thin metal frames, engraved gold/silver/bronze plaques,
// serif typography, and the runners-up as honorable mentions on a stone ledge.
import type { CSSProperties } from "react"
import { alpha, Brand, col, fit, flex, kind, Placeholder, svgUri } from "../kit"
import { type CardProps, type CardDesign, type CardTitle, THEMES } from "../model"

const W = 1080
const H = 1920
const FLOOR = 1430
const FACE = 26 // height of a plinth's top face

type Theme = (typeof THEMES)[keyof typeof THEMES]

const CREAM = "#f2ece1"
const MUTED = "#a39c90"
const BG = "#0b0b0d"

const METALS = {
	1: { hi: "#f6e7b8", mid: "#c9a45c", lo: "#7d6231", text: "#3b2c0e", label: "Grand prize" },
	2: { hi: "#f4f5f7", mid: "#b7bcc4", lo: "#6d737c", text: "#2a2d33", label: "Second" },
	3: { hi: "#f1caa3", mid: "#b77a4a", lo: "#6e4424", text: "#361d0b", label: "Third" },
} as const
const ROMAN = ["I", "II", "III", "IV", "V"]

// A black marble plinth: lit top face, a front with soft veins and a floor-level shade.
const plinthSvg = (w: number, h: number, seed: number) => {
	const veins = [0, 1, 2]
		.map((i) => {
			const x0 = ((seed * (i + 3) * 37) % (w - 60)) + 30
			const y0 = FACE + 20 + i * ((h - FACE) / 3)
			return `<path d="M${x0} ${y0} C ${x0 + 60} ${y0 + 40}, ${x0 - 40} ${y0 + 90}, ${x0 + 30} ${y0 + 150}" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2" fill="none"/>`
		})
		.join("")
	return svgUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
			`<defs>` +
			`<linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#101012"/><stop offset="0.45" stop-color="#232327"/><stop offset="1" stop-color="#0c0c0e"/></linearGradient>` +
			`<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>` +
			`<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2c2c31"/><stop offset="0.5" stop-color="#4a4a52"/><stop offset="1" stop-color="#26262b"/></linearGradient>` +
			`</defs>` +
			`<polygon points="0,${FACE} 18,0 ${w - 18},0 ${w},${FACE}" fill="url(#t)"/>` +
			`<rect x="0" y="${FACE}" width="${w}" height="${h - FACE}" fill="url(#f)"/>` +
			veins +
			`<rect x="0" y="${FACE}" width="${w}" height="2" fill="#ffffff" fill-opacity="0.12"/>` +
			`<rect x="0" y="${FACE}" width="${w}" height="${h - FACE}" fill="url(#s)"/>` +
			"</svg>",
	)
}

// Three soft light cones falling from above onto the plinths.
const conesSvg = (tint: string) =>
	svgUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${FLOOR}" viewBox="0 0 ${W} ${FLOOR}">` +
			`<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint}" stop-opacity="0.02"/><stop offset="0.55" stop-color="${tint}" stop-opacity="0.07"/><stop offset="1" stop-color="${tint}" stop-opacity="0.16"/></linearGradient></defs>` +
			`<polygon points="490,0 590,0 740,${FLOOR} 340,${FLOOR}" fill="url(#c)"/>` +
			`<polygon points="200,0 270,0 400,${FLOOR} 60,${FLOOR}" fill="url(#c)"/>` +
			`<polygon points="810,0 880,0 1020,${FLOOR} 680,${FLOOR}" fill="url(#c)"/>` +
			"</svg>",
	)

const metal = (rank: 1 | 2 | 3) => {
	const m = METALS[rank]
	return `linear-gradient(100deg, ${m.lo} 0%, ${m.mid} 22%, ${m.hi} 48%, ${m.mid} 70%, ${m.lo} 100%)`
}

// Poster in a thin champagne frame, or a typographic stand-in.
const Framed = ({ item, w, slot, t, style }: { item: CardTitle; w: number; slot: number; t: Theme; style?: CSSProperties }) => {
	const h = Math.round(w * 1.5)
	return (
		<div data-slot={slot} style={flex({ position: "absolute", padding: 7, backgroundImage: "linear-gradient(135deg, #8d7a55, #e4d3a8 45%, #7a6845)", boxShadow: "0 40px 70px rgba(0,0,0,0.75)", ...style })}>
			{item.poster ? (
				<img src={item.poster} width={w} height={h} style={{ display: "flex", width: w, height: h, objectFit: "cover" }} />
			) : (
				<div style={col({ width: w, height: h, padding: 22, justifyContent: "flex-end", backgroundImage: `linear-gradient(170deg, #1d1d21, ${alpha(t.accent, 0.5)})`, color: CREAM, fontFamily: "Instrument Serif", fontSize: Math.round(w * 0.15), lineHeight: 1 })}>
					<div style={{ display: "flex" }}>{item.title}</div>
				</div>
			)}
		</div>
	)
}

const STEPS = [
	{ rank: 2 as const, x: 64, w: 314, h: 330, poster: 252 },
	{ rank: 1 as const, x: 383, w: 314, h: 440, poster: 284 },
	{ rank: 3 as const, x: 702, w: 314, h: 270, poster: 252 },
]

const Hairline = ({ w, color }: { w: number; color: string }) => <div style={{ display: "flex", width: w, height: 1.5, backgroundColor: color }} />

export function CeremonyCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const headline = title || "My top 5"
	const size = fit(headline, [[12, 132], [20, 112], [32, 92], [48, 76], [999, 62]])
	const year = date.slice(-4)
	const bench = items.slice(3, 5)
	const benchSlots = editing ? 2 : bench.length
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: BG, color: CREAM, fontFamily: "Gabarito", overflow: "hidden" })}>
			{/* Room: a faint theme-tinted haze behind the stage, cones of light, a warm floor glow */}
			<div style={{ display: "flex", position: "absolute", top: 520, left: -120, width: 1320, height: 1100, backgroundImage: `radial-gradient(ellipse at center, ${alpha(t.accent, 0.16)} 0%, ${alpha(t.accent, 0)} 60%)` }} />
			<img src={conesSvg("#fff6e0")} width={W} height={FLOOR} style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: FLOOR }} />
			<div style={{ display: "flex", position: "absolute", top: FLOOR - 70, left: 0, width: W, height: 200, backgroundImage: "radial-gradient(ellipse at center, rgba(255,240,210,0.13) 0%, rgba(255,240,210,0) 65%)" }} />
			<div style={{ display: "flex", position: "absolute", top: FLOOR, left: 0, width: W, height: H - FLOOR, backgroundImage: "linear-gradient(180deg, #141416 0%, #0b0b0d 100%)" }} />
			<div style={{ display: "flex", position: "absolute", top: FLOOR, left: 0, width: W, height: 1.5, backgroundColor: "rgba(255,255,255,0.1)" }} />

			{/* Header */}
			<div style={col({ position: "absolute", top: 104, left: 70, right: 70, alignItems: "center" })}>
				<Brand color="#ffffff" size={40} />
				<div style={flex({ alignItems: "center", gap: 22, marginTop: 54 })}>
					<Hairline w={90} color={alpha(t.accent, 0.8)} />
					<div style={{ display: "flex", fontSize: 21, fontWeight: 700, letterSpacing: 9, color: MUTED }}>{`THE GOODWATCH AWARDS ${year}`}</div>
					<Hairline w={90} color={alpha(t.accent, 0.8)} />
				</div>
				<div
					data-edit="title"
					style={{ display: "flex", marginTop: 30, textAlign: "center", justifyContent: "center", fontFamily: "Instrument Serif", fontSize: size, lineHeight: 0.98, letterSpacing: -1, color: CREAM }}
				>
					{headline}
				</div>
				<div style={{ display: "flex", marginTop: 22, fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 34, color: t.accent === "#4f6bff" ? t.accent2 : t.accent }}>and the winners are</div>
			</div>

			{/* Plinths */}
			{STEPS.map((s, i) => {
				const item = items[s.rank - 1]
				const m = METALS[s.rank]
				return (
					<div key={s.rank} style={{ display: "flex", position: "absolute", left: s.x, top: FLOOR - s.h, width: s.w, height: s.h }}>
						<img src={plinthSvg(s.w, s.h, i + 2)} width={s.w} height={s.h} style={{ display: "flex", position: "absolute", top: 0, left: 0, width: s.w, height: s.h }} />
						<div style={col({ position: "absolute", top: FACE + 34, left: 26, right: 26, alignItems: "center" })}>
							<div style={col({ alignItems: "center", width: 150, padding: "10px 0 8px", backgroundImage: metal(s.rank), boxShadow: "0 6px 14px rgba(0,0,0,0.5)", color: m.text })}>
								<div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 900, fontSize: 44, lineHeight: 1 }}>{ROMAN[s.rank - 1]}</div>
								<div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 4, marginTop: 4 }}>{m.label.toUpperCase()}</div>
							</div>
							<div style={{ display: "flex", marginTop: 26, textAlign: "center", justifyContent: "center", fontFamily: "Instrument Serif", fontSize: item ? fit(item.title, [[14, 38], [24, 32], [40, 27], [999, 23]]) : 28, lineHeight: 1.05, color: item ? CREAM : alpha(CREAM, 0.35) }}>
								{item?.title ?? (editing ? "Add a title" : "Vacant")}
							</div>
							{item && s.h > 300 && (
								<div style={{ display: "flex", marginTop: 10, fontSize: 16, fontWeight: 700, letterSpacing: 3, color: MUTED }}>{[item.year, kind(item).toUpperCase()].filter(Boolean).join("  ·  ")}</div>
							)}
						</div>
					</div>
				)
			})}

			{/* Posters standing on the plinths */}
			{STEPS.map((s) => {
				const item = items[s.rank - 1]
				const ph = Math.round(s.poster * 1.5)
				const left = s.x + (s.w - s.poster - 14) / 2
				const top = FLOOR - s.h + FACE / 2 - ph - 14
				if (item) return <Framed key={`p${s.rank}`} item={item} w={s.poster} slot={s.rank - 1} t={t} style={{ left, top }} />
				if (editing) return <Placeholder key={`p${s.rank}`} w={s.poster + 14} h={ph + 14} n={s.rank} color="#ffffff" style={{ position: "absolute", left, top }} />
				return null
			})}

			{/* Honorable mentions */}
			<div style={col({ position: "absolute", top: FLOOR + 52, left: 80, right: 80, alignItems: "center", gap: 26 })}>
				{benchSlots > 0 ? (
					<div style={col({ alignItems: "center", gap: 26, width: "100%" })}>
						<div style={flex({ alignItems: "center", gap: 22 })}>
							<Hairline w={120} color="rgba(255,255,255,0.18)" />
							<div style={{ display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: 8, color: MUTED }}>HONORABLE MENTIONS</div>
							<Hairline w={120} color="rgba(255,255,255,0.18)" />
						</div>
						<div style={flex({ gap: 24, justifyContent: "center", width: "100%" })}>
							{Array.from({ length: benchSlots }, (_, i) => {
								const item = bench[i]
								return item ? (
									<div key={item.key} data-slot={3 + i} style={flex({ width: 448, height: 150, gap: 20, padding: 14, alignItems: "center", backgroundImage: "linear-gradient(100deg, #1b1b1f, #121215)", border: "1.5px solid rgba(255,255,255,0.1)" })}>
										{item.poster ? (
											<img src={item.poster} width={80} height={120} style={{ display: "flex", width: 80, height: 120, objectFit: "cover" }} />
										) : (
											<div style={{ display: "flex", width: 80, height: 120, backgroundImage: `linear-gradient(170deg, #26262b, ${alpha(t.accent, 0.5)})` }} />
										)}
										<div style={col({ flex: 1, gap: 6 })}>
											<div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 900, fontSize: 30, lineHeight: 1, color: alpha(CREAM, 0.55) }}>{ROMAN[3 + i]}</div>
											<div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: fit(item.title, [[16, 34], [28, 28], [999, 23]]), lineHeight: 1.02 }}>{item.title}</div>
											{item.year && <div style={{ display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 3, color: MUTED }}>{item.year}</div>}
										</div>
									</div>
								) : (
									<Placeholder key={`e${i}`} w={448} h={150} n={i + 4} color="#ffffff" />
								)
							})}
						</div>
					</div>
				) : (
					<div style={col({ alignItems: "center", gap: 10, marginTop: 40 })}>
						<div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 40, color: alpha(CREAM, 0.8) }}>Nominate your own</div>
						<div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 8, color: MUTED }}>GOODWATCH.APP</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div style={flex({ position: "absolute", left: 80, right: 80, bottom: 70, justifyContent: "space-between", alignItems: "flex-end", paddingTop: 26, borderTop: "1.5px solid rgba(255,255,255,0.12)" })}>
				<div style={col({ gap: 6 })}>
					<div style={{ display: "flex", fontSize: 16, fontWeight: 700, letterSpacing: 5, color: MUTED }}>PRESENTED BY</div>
					<div data-edit="name" style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 38, color: CREAM }}>{name || "someone with taste"}</div>
				</div>
				<div style={col({ alignItems: "flex-end", gap: 6 })}>
					<div style={{ display: "flex", fontSize: 16, fontWeight: 700, letterSpacing: 5, color: MUTED }}>HOLD YOUR OWN</div>
					<div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 38, color: CREAM }}>goodwatch.app</div>
				</div>
			</div>
		</div>
	)
}

export const ceremony: CardDesign = { key: "ceremony", name: "Ceremony", format: "Story 9:16", w: W, h: H, Card: CeremonyCard }
