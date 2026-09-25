// PROTOTYPE - throwaway. "Marquee": a cinema façade at night. The list title sits on a backlit
// changeable-letter marquee framed by bulbs; the picks hang below in backlit poster lightboxes
// (#1 large in the center, the rest stacked either side), reflected on the wet pavement.
import type { CSSProperties } from "react"
import { alpha, Brand, col, flex, kind } from "../kit"
import { type CardProps, type Design, type ListItem, THEMES } from "../model"

const W = 1080
const H = 1920
const SIDE_W = 200
const SIDE_H = 300
const HERO_W = 420
const HERO_H = 630
const FRAME = 14
const HERO_FRAME = 20

// Break the title into at most 3 marquee rows of roughly equal length.
function rows(title: string) {
	const words = title.toUpperCase().split(/\s+/).filter(Boolean)
	const total = words.join(" ").length
	const lines = total <= 14 ? 1 : total <= 30 ? 2 : 3
	const target = total / lines
	const out: string[] = []
	let cur = ""
	for (const w of words) {
		const next = cur ? `${cur} ${w}` : w
		if (cur && next.length > target + 3 && out.length < lines - 1) {
			out.push(cur)
			cur = w
		} else cur = next
	}
	if (cur) out.push(cur)
	return out
}

const Bulbs = ({ n, size, color }: { n: number; size: number; color: string }) => (
	<div style={flex({ justifyContent: "space-between", width: "100%" })}>
		{Array.from({ length: n }, (_, i) => (
			<div
				key={i}
				style={{
					display: "flex",
					width: size,
					height: size,
					borderRadius: 999,
					backgroundImage: `radial-gradient(circle at 40% 35%, #ffffff 0%, #fff4c7 35%, ${color} 100%)`,
					boxShadow: `0 0 ${size}px ${alpha(color, 0.9)}`,
				}}
			/>
		))}
	</div>
)

// A backlit poster case. `glow` is off for the reflection copy (no blurred shadows under transforms).
function Lightbox({ item, rank, w, h, frame, accent, editing, glow }: { item?: ListItem; rank: number; w: number; h: number; frame: number; accent: string; editing?: boolean; glow: boolean }) {
	const outer: CSSProperties = {
		position: "relative",
		width: w + frame * 2,
		height: h + frame * 2,
		padding: frame,
		backgroundImage: "linear-gradient(160deg, #3a3a3e 0%, #121214 45%, #26262a 100%)",
		border: "2px solid #4a4a50",
		borderRadius: 6,
		...(glow ? { boxShadow: `0 0 60px ${alpha(accent, 0.35)}, 0 30px 60px rgba(0,0,0,0.6)` } : {}),
	}
	if (!item) {
		if (!editing) return <div style={flex({ ...outer, opacity: 0.5 })}><div style={{ display: "flex", width: w, height: h, backgroundColor: "#0c0c0e" }} /></div>
		return (
			<div data-slot={glow ? rank - 1 : undefined} style={flex(outer)}>
				<div style={col({ width: w, height: h, alignItems: "center", justifyContent: "center", backgroundColor: "#0c0c0e", border: `3px dashed ${alpha("#ffffff", 0.35)}`, color: alpha("#ffffff", 0.6), fontFamily: "Anton", fontSize: w * 0.12, letterSpacing: 2 })}>
					<div style={{ display: "flex", fontSize: w * 0.3, lineHeight: 1 }}>+</div>
					<div style={{ display: "flex" }}>{`No. ${rank}`}</div>
				</div>
			</div>
		)
	}
	return (
		<div data-slot={glow ? rank - 1 : undefined} style={flex(outer)}>
			{item.poster ? (
				<img src={item.poster} width={w} height={h} style={{ display: "flex", width: w, height: h, objectFit: "cover" }} />
			) : (
				<div style={col({ width: w, height: h, justifyContent: "flex-end", padding: w * 0.08, backgroundImage: `linear-gradient(180deg, #1c1c20 0%, ${alpha(accent, 0.55)} 100%)`, color: "#fff", fontFamily: "Anton", fontSize: w * 0.14, lineHeight: 1.02, textTransform: "uppercase" })}>
					<div style={{ display: "flex" }}>{item.title}</div>
				</div>
			)}
			{/* glass sheen across the case */}
			<div style={{ display: "flex", position: "absolute", top: frame, left: frame, width: w, height: h, backgroundImage: "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.06) 100%)" }} />
			<div
				style={flex({
					position: "absolute",
					top: rank === 1 ? -24 : -17,
					left: 0,
					right: 0,
					justifyContent: "center",
					alignSelf: "center",
					marginLeft: "auto",
					marginRight: "auto",
					width: rank === 1 ? 130 : 86,
					padding: rank === 1 ? "6px 0" : "4px 0",
					backgroundColor: accent,
					color: "#0a0a0a",
					...(glow ? { boxShadow: `0 0 24px ${alpha(accent, 0.7)}` } : {}),
					fontFamily: "Anton",
					fontSize: rank === 1 ? 38 : 26,
					lineHeight: 1,
					letterSpacing: 1,
				})}
			>
				{`No. ${rank}`}
			</div>
		</div>
	)
}

function Facade({ items, accent, editing, glow }: { items: ListItem[]; accent: string; editing?: boolean; glow: boolean }) {
	const box = (i: number, big: boolean) => (
		<Lightbox item={items[i]} rank={i + 1} w={big ? HERO_W : SIDE_W} h={big ? HERO_H : SIDE_H} frame={big ? HERO_FRAME : FRAME} accent={accent} editing={editing} glow={glow} />
	)
	const side = (a: number, b: number) => (
		<div style={col({ gap: 26, justifyContent: "center" })}>
			{box(a, false)}
			{box(b, false)}
		</div>
	)
	return (
		<div style={flex({ width: W, justifyContent: "center", alignItems: "center", gap: 34 })}>
			{side(1, 3)}
			{box(0, true)}
			{side(2, 4)}
		</div>
	)
}

function MarqueeCard({ title, items, name, theme, date, editing }: CardProps) {
	const t = THEMES[theme]
	const lines = rows(title || "My top 5")
	const longest = Math.max(...lines.map((l) => l.length))
	const letter = Math.min(118, Math.floor(780 / Math.max(longest, 6) / 0.52), lines.length === 3 ? 84 : 118)
	const shown = items.slice(0, 5)
	const facadeTop = 700
	const facadeH = HERO_H + HERO_FRAME * 2
	return (
		<div style={col({ position: "relative", width: W, height: H, backgroundColor: "#07070a", color: "#fff", fontFamily: "Gabarito", overflow: "hidden" })}>
			{/* night sky and wall */}
			<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, ${t.ink} 0%, #0b0b10 38%, #050507 62%, #020203 100%)` }} />
			<div style={{ display: "flex", position: "absolute", top: 60, left: -200, width: W + 400, height: 900, backgroundImage: `radial-gradient(ellipse at 50% 35%, ${alpha(t.accent, 0.3)} 0%, ${alpha(t.accent, 0)} 62%)` }} />

			{/* wall panels behind the lightboxes, lit from the canopy */}
			<div style={{ display: "flex", position: "absolute", top: 640, left: 0, width: W, height: facadeH + 90, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 108px)" }} />
			<div style={{ display: "flex", position: "absolute", top: 640, left: 0, width: W, height: facadeH + 90, backgroundImage: `linear-gradient(180deg, ${alpha(t.accent, 0.16)} 0%, ${alpha(t.accent, 0)} 40%)` }} />
			{/* header */}
			<div style={flex({ position: "absolute", top: 64, left: 64, right: 64, justifyContent: "space-between", alignItems: "center" })}>
				<Brand color="#ffffff" size={42} />
				<div style={{ display: "flex", fontFamily: "Rubik Mono One", fontSize: 26, letterSpacing: 4, color: t.accent, textShadow: `0 0 12px ${alpha(t.accent, 0.95)}, 0 0 34px ${alpha(t.accent, 0.8)}` }}>
					NOW SHOWING
				</div>
			</div>

			{/* marquee sign */}
			<div style={col({ position: "absolute", top: 170, left: 50, width: 980, alignItems: "center" })}>
				<div style={col({ width: 980, padding: "22px 30px", gap: 16, backgroundImage: "linear-gradient(180deg, #2b2b31 0%, #151518 100%)", border: "3px solid #3d3d44", borderRadius: 10, boxShadow: `0 0 90px ${alpha(t.accent, 0.35)}` })}>
					<Bulbs n={24} size={20} color={t.accent2} />
					<div
						data-edit="title"
						style={col({
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
							minHeight: 330,
							padding: "28px 24px",
							backgroundImage: "linear-gradient(180deg, #fffdf6 0%, #f4efe2 55%, #e9e2d0 100%)",
							borderRadius: 4,
							boxShadow: `inset 0 0 40px ${alpha("#ffffff", 0.9)}`,
						})}
					>
						{lines.map((line, i) => (
							<div key={i} style={col({ alignItems: "center", width: "100%" })}>
								<div style={{ display: "flex", width: "100%", height: 3, backgroundColor: "#c9c1ad" }} />
								<div style={{ display: "flex", fontFamily: "Anton", fontSize: letter, lineHeight: 1.08, letterSpacing: letter * 0.08, color: "#111114", padding: "4px 0" }}>{line}</div>
							</div>
						))}
						<div style={{ display: "flex", width: "100%", height: 3, backgroundColor: "#c9c1ad" }} />
					</div>
					<Bulbs n={24} size={20} color={t.accent2} />
				</div>
				{/* canopy underside */}
				<div style={{ display: "flex", width: 1040, height: 34, marginTop: -2, backgroundImage: `linear-gradient(180deg, #1d1d22 0%, #0c0c0f 100%)`, borderBottom: `4px solid ${t.accent}`, boxShadow: `0 10px 40px ${alpha(t.accent, 0.55)}` }} />
			</div>

			{/* lightboxes */}
			<div style={flex({ position: "absolute", top: facadeTop, left: 0, width: W })}>
				<Facade items={shown} accent={t.accent} editing={editing} glow />
			</div>

			{/* wet pavement reflection */}
			<div style={flex({ position: "absolute", top: facadeTop + facadeH + 26, left: 0, width: W, height: 420, overflow: "hidden" })}>
				<div style={flex({ position: "absolute", top: 0, left: 0, width: W, height: facadeH, transform: "scaleY(-1)", opacity: 0.5 })}>
					<Facade items={shown} accent={t.accent} glow={false} />
				</div>
				<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: 420, backgroundImage: "linear-gradient(180deg, rgba(3,3,5,0.2) 0%, rgba(3,3,5,0.7) 40%, #030305 78%)" }} />
				<div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: W, height: 2, backgroundColor: alpha(t.accent, 0.5) }} />
			</div>

			{/* program + footer */}
			<div style={col({ position: "absolute", left: 64, right: 64, bottom: 60, gap: 30 })}>
				<div style={flex({ flexWrap: "wrap", columnGap: 26, rowGap: 10, fontFamily: "Space Mono", fontSize: 24, letterSpacing: 1.5, color: alpha("#ffffff", 0.82), textTransform: "uppercase" })}>
					{shown.map((item, i) => (
						<div key={item.key} style={flex({ gap: 10 })}>
							<div style={{ display: "flex", color: t.accent, fontWeight: 700 }}>{`${i + 1}`}</div>
							<div style={{ display: "flex" }}>{item.title}</div>
							<div style={{ display: "flex", color: alpha("#ffffff", 0.4) }}>{[item.year, kind(item)].filter(Boolean).join(" ")}</div>
						</div>
					))}
				</div>
				<div style={flex({ justifyContent: "space-between", alignItems: "flex-end", paddingTop: 26, borderTop: `2px solid ${alpha("#ffffff", 0.12)}` })}>
					<div style={col({ gap: 4 })}>
						<div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 3, color: alpha("#ffffff", 0.45) }}>PROGRAMMED BY</div>
						<div data-edit="name" style={{ display: "flex", fontSize: 36, fontWeight: 900, color: t.accent2 }}>{name || "someone with taste"}</div>
					</div>
					<div style={col({ alignItems: "flex-end", gap: 4 })}>
						<div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 3, color: alpha("#ffffff", 0.45) }}>{date.toUpperCase()}</div>
						<div style={{ display: "flex", fontSize: 36, fontWeight: 900 }}>goodwatch.app</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const marquee: Design = { key: "marquee", name: "Marquee", format: "Story 9:16", w: W, h: H, max: 5, Card: MarqueeCard }
