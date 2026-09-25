// "Front page": a broadsheet front page. The list title is the banner
// headline, #1 is the lead photo, #2–#5 run as photo columns below. Photos print as duotone:
// grayscale plus the theme color as the spot ink, with a halftone screen over them.
import type { CSSProperties } from "react"
import { alpha, Brand, col, fit, flex, kind, svgUri } from "../kit"
import { type CardProps, type CardDesign, hash, type CardTitle, THEMES } from "../model"

const W = 1080
const H = 1350
const PAPER = "#efe9dc"
const INK = "#16140f"
const M = 56

// Dot screen laid over photos. One SVG per size keeps it identical in DOM and satori.
const halftone = (w: number, h: number) =>
	svgUri(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="d" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.25" fill="#000"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#d)"/></svg>`,
	)

// Spot color that still reads as ink on newsprint (very light accents get darkened).
const spot = (accent: string) => {
	const n = Number.parseInt(accent.slice(1), 16)
	const lum = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
	if (lum < 150) return accent
	const f = 150 / lum
	const c = (v: number) => Math.round(v * f).toString(16).padStart(2, "0")
	return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`
}

function Photo({ item, w, h, ink, slot, poster }: { item: CardTitle; w: number; h: number; ink: string; slot: number; poster?: boolean }) {
	const src = poster ? (item.poster ?? item.backdrop) : (item.backdrop ?? item.poster)
	const layer: CSSProperties = { position: "absolute", top: 0, left: 0, width: w, height: h }
	return (
		<div data-slot={slot} style={flex({ position: "relative", width: w, height: h, backgroundColor: "#cfc8b8", overflow: "hidden" })}>
			{src ? (
				<img src={src} width={w} height={h} style={{ ...layer, display: "flex", objectFit: "cover", objectPosition: poster ? "center 20%" : "center", filter: "grayscale(1) contrast(1.25) brightness(1.05)" }} />
			) : (
				<div style={col({ ...layer, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "#d9d2c2", fontFamily: "Playfair Display", fontWeight: 900, fontSize: Math.min(40, w * 0.12), color: INK, textAlign: "center" })}>
					<div style={{ display: "flex" }}>{item.title}</div>
				</div>
			)}
			<div style={{ ...layer, display: "flex", backgroundColor: ink, opacity: 0.38 }} />
			<img src={halftone(w, h)} width={w} height={h} style={{ ...layer, display: "flex", opacity: 0.16 }} />
		</div>
	)
}

const Empty = ({ w, h, n }: { w: number; h: number; n: number }) => (
	<div data-slot={n - 1} style={col({ width: w, height: h, alignItems: "center", justifyContent: "center", border: `3px dashed ${alpha(INK, 0.35)}`, color: alpha(INK, 0.55), fontFamily: "Playfair Display", fontWeight: 900, fontSize: 28 })}>
		<div style={{ display: "flex", fontSize: 56, lineHeight: 1 }}>+</div>
		<div style={{ display: "flex" }}>{`No. ${n}`}</div>
	</div>
)

const Rule = ({ w = 4, style }: { w?: number; style?: CSSProperties }) => <div style={{ display: "flex", width: "100%", height: w, backgroundColor: INK, ...style }} />

function NewsprintCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const ink = spot(t.accent)
	const headline = title || "My top 5"
	const [lead, ...rest] = items
	const cols = editing ? 4 : Math.max(0, Math.min(rest.length, 4))
	const issue = (hash(headline + items.map((i) => i.key).join()) % 900) + 100
	// Columns keep a four-up grid so short lists don't stretch one photo across the page.
	const colW = Math.floor((W - M * 2 - 3 * 25) / 4)
	const photoH = 230
	// The lead photo takes whatever height the headline and columns leave.
	const size = fit(headline, [[16, 96], [28, 80], [44, 64], [999, 52]])
	const headLines = Math.max(1, Math.ceil((headline.length * size * 0.48) / (W - M * 2)))
	const leadH = Math.min(760, 470 - (headLines * size * 0.98 - 94) + (cols ? 0 : 330))
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: PAPER, color: INK, fontFamily: "Instrument Serif", padding: `44px ${M}px 40px`, overflow: "hidden" })}>
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.35) 0%, rgba(0,0,0,0.06) 100%)" }} />

			{/* masthead */}
			<div style={flex({ justifyContent: "space-between", alignItems: "center", fontFamily: "Space Mono", fontSize: 15, letterSpacing: 2 })}>
				<Brand color={INK} size={30} />
				<div style={flex({ gap: 22, textTransform: "uppercase" })}>
					<div style={{ display: "flex" }}>{`Vol. XXVI · No. ${issue}`}</div>
					<div style={{ display: "flex", color: ink, fontWeight: 700 }}>Late edition</div>
				</div>
			</div>
			<Rule w={2} style={{ marginTop: 14 }} />
			<div style={flex({ justifyContent: "center", padding: "8px 0 4px" })}>
				<div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 900, fontSize: 88, letterSpacing: -2, lineHeight: 1 }}>The Good Watch</div>
			</div>
			<div style={flex({ justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${INK}`, borderBottom: `5px solid ${INK}`, fontFamily: "Space Mono", fontSize: 15, letterSpacing: 2, textTransform: "uppercase" })}>
				<div style={{ display: "flex" }}>{date}</div>
				<div style={{ display: "flex" }}>All the picks fit to print</div>
				<div style={{ display: "flex" }}>goodwatch.app</div>
			</div>

			{/* headline */}
			<div style={flex({ marginTop: 22, gap: 12, alignItems: "center", fontFamily: "Space Mono", fontWeight: 700, fontSize: 16, letterSpacing: 3, color: ink, textTransform: "uppercase" })}>
				<div style={{ display: "flex", width: 34, height: 4, backgroundColor: ink }} />
				<div style={{ display: "flex" }}>{`Special report · The top ${Math.max(items.length, editing ? 5 : 1)}`}</div>
			</div>
			<div data-edit="title" style={{ display: "flex", marginTop: 8, fontFamily: "Playfair Display", fontWeight: 900, fontSize: size, lineHeight: 0.98, letterSpacing: -1.5 }}>
				{headline}
			</div>
			<div style={flex({ marginTop: 12, gap: 8, alignItems: "baseline", fontSize: 25, fontStyle: "italic" })}>
				<div style={{ display: "flex" }}>Ranked, argued over, and final. By</div>
				<div style={{ display: "flex", fontFamily: "Space Mono", fontStyle: "normal", fontWeight: 700, fontSize: 19, letterSpacing: 1, textTransform: "uppercase", color: ink }}>
					{name || "our critic"}
				</div>
			</div>

			{/* lead story */}
			<div style={flex({ marginTop: 20, gap: 26, flexGrow: 1, minHeight: 0 })}>
				<div style={col({ width: 640, gap: 8 })}>
					{lead ? <Photo item={lead} w={640} h={leadH} ink={ink} slot={0} /> : <Empty w={640} h={leadH} n={1} />}
					<div style={{ display: "flex", fontSize: 19, fontStyle: "italic", color: alpha(INK, 0.75) }}>
						{lead ? `No. 1 — ${lead.title}${lead.year ? ` (${lead.year})` : ""}. Photograph: the archive.` : "No. 1 — to be announced."}
					</div>
				</div>
				<div style={col({ flex: 1, paddingLeft: 24, borderLeft: `2px solid ${INK}` })}>
					<div style={{ display: "flex", fontFamily: "Anton", fontSize: 150, lineHeight: 0.9, color: ink }}>1</div>
					<div style={{ display: "flex", marginTop: 8, fontFamily: "Playfair Display", fontWeight: 900, fontSize: lead ? fit(lead.title, [[14, 40], [26, 32], [999, 26]]) : 32, lineHeight: 1.05 }}>
						{lead?.title ?? "Your No. 1 goes here"}
					</div>
					<div style={{ display: "flex", marginTop: 10, fontFamily: "Space Mono", fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase", color: alpha(INK, 0.7) }}>
						{lead ? [lead.year, kind(lead), lead.genre].filter(Boolean).join(" · ") : ""}
					</div>
					<div style={{ display: "flex", marginTop: 14, fontSize: 23, lineHeight: 1.25 }}>
						{lead ? (lead.score != null ? `Takes the top spot with a GoodWatch score of ${lead.score}. No contest.` : "Takes the top spot. No contest.") : ""}
					</div>
					<div style={flex({ flexGrow: 1 })} />
					<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", color: ink }}>Continued at goodwatch.app →</div>
				</div>
			</div>

			{/* photo columns */}
			{cols > 0 && (
				<div style={col({ marginTop: 18 })}>
					<Rule w={2} />
					<div style={flex({ marginTop: 16, gap: 25 })}>
						{Array.from({ length: cols }, (_, i) => {
							const item = rest[i]
							return (
								<div key={item?.key ?? `e${i}`} style={col({ width: colW, gap: 8 })}>
									{item ? <Photo item={item} w={colW} h={photoH} ink={ink} slot={i + 1} poster /> : <Empty w={colW} h={photoH} n={i + 2} />}
									<div style={flex({ gap: 10, alignItems: "baseline" })}>
										<div style={{ display: "flex", fontFamily: "Anton", fontSize: 34, lineHeight: 1, color: ink }}>{i + 2}</div>
										<div style={{ display: "flex", flex: 1, fontFamily: "Playfair Display", fontWeight: 900, fontSize: item ? fit(item.title, [[16, 23], [28, 19], [999, 16]]) : 20, lineHeight: 1.05 }}>
											{item?.title ?? "Open spot"}
										</div>
									</div>
									<div style={{ display: "flex", fontFamily: "Space Mono", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: alpha(INK, 0.65) }}>
										{item ? [item.year, kind(item), item.score != null ? `GW ${item.score}` : null].filter(Boolean).join(" · ") : ""}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

export const newsprint: CardDesign = { key: "newsprint", name: "Front page", format: "Post 4:5", w: W, h: H, Card: NewsprintCard }
