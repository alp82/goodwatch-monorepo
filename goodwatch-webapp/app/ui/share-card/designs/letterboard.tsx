// "Letterboard": an oak-framed felt letter board hung on a wall, lit from
// the upper left. White plastic letters sit in the felt's grooves; the title and the ranks use
// the colored letter set. The wall takes a muted tint of the theme.
import { alpha, Brand, col, flex } from "../kit"
import { type CardProps, type CardDesign, THEMES } from "../model"

const S = 1080
const BOARD = { x: 84, y: 64, w: 912, h: 872 }
const FRAME = 30
const FELT = { w: BOARD.w - FRAME * 2, h: BOARD.h - FRAME * 2 }
const PITCH = 20 // one felt rib; letters sit on multiples of it
const LETTER = "#f6f4ee"
const INK = "#15120e"

// Mix a color toward a warm neutral, for a painted-wall look.
const mix = (hex: string, base: string, t: number) => {
	const a = Number.parseInt(hex.slice(1, 7), 16)
	const b = Number.parseInt(base.slice(1, 7), 16)
	const ch = (s: number) => Math.round(((a >> s) & 255) * t + ((b >> s) & 255) * (1 - t))
	return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

// Letters pressed into felt: a hard contact shadow below, a soft one around, a faint top highlight.
const plastic = { textShadow: "0 2px 0 rgba(0,0,0,0.9), 0 5px 10px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.25)" }
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
// Loose letterboard spacing swallows normal spaces; use an en space between words.
const spaced = (s: string) => s.split(" ").join("\u2002")

function LetterboardCard({ title, items, name, theme, editing }: CardProps) {
	const t = THEMES[theme]
	const wall = mix(t.accent, "#d9d2c5", 0.28)
	const wallDeep = mix(t.accent, "#a79c8a", 0.3)
	const rows = editing ? Math.max(items.length, 5) : Math.max(1, items.length)
	// Row heights snap to the felt ribs.
	const rowH = rows <= 3 ? PITCH * 4 : rows <= 5 ? PITCH * 3.5 : rows <= 7 ? PITCH * 3 : PITCH * 2
	const size = rows <= 3 ? 58 : rows <= 5 ? 50 : rows <= 7 ? 40 : 30
	const heading = (title || "My top 5").toUpperCase()
	const headSize = heading.length <= 16 ? 74 : heading.length <= 26 ? 56 : heading.length <= 40 ? 44 : 34
	// Each title shrinks to fit its row before it gets clipped.
	const avail = FELT.w - 110 - size * 2
	// One letter size for every row, like a real board: the longest title decides it.
	const longest = Math.max(1, ...items.slice(0, rows).map((i) => Math.min(40, i.title.length)))
	const fs = Math.max(size * 0.6, Math.min(size, avail / (longest * 0.74)))
	return (
		<div
			style={col({
				position: "relative",
				width: S,
				height: S,
				backgroundColor: wall,
				backgroundImage: `radial-gradient(ellipse at 25% 10%, ${alpha("#ffffff", 0.35)} 0%, ${alpha("#ffffff", 0)} 55%), linear-gradient(180deg, ${alpha(wallDeep, 0)} 55%, ${alpha(wallDeep, 0.35)} 100%)`,
				fontFamily: "Gabarito",
				overflow: "hidden",
			})}
		>
			{/* Board shadow on the wall, then the oak frame. */}
			<div style={{ display: "flex", position: "absolute", left: BOARD.x + 14, top: BOARD.y + 26, width: BOARD.w, height: BOARD.h, borderRadius: 10, backgroundColor: alpha("#1a120a", 0.35) }} />
			<div
				style={col({
					position: "absolute",
					left: BOARD.x,
					top: BOARD.y,
					width: BOARD.w,
					height: BOARD.h,
					borderRadius: 8,
					padding: FRAME,
					backgroundColor: "#a8773f",
					backgroundImage:
						"linear-gradient(135deg, rgba(255,236,200,0.35) 0%, rgba(255,236,200,0) 35%, rgba(60,30,5,0) 65%, rgba(60,30,5,0.35) 100%), repeating-linear-gradient(90deg, rgba(92,52,16,0.18) 0px, rgba(92,52,16,0.18) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 9px, rgba(255,230,190,0.12) 9px, rgba(255,230,190,0.12) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 23px)",
					boxShadow: "0 30px 50px rgba(30,18,6,0.35)",
				})}
			>
				<div style={col({ position: "relative", width: FELT.w, height: FELT.h, backgroundColor: "#141414", overflow: "hidden", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.6)" })}>
					{Array.from({ length: Math.floor(FELT.h / PITCH) }, (_, i) => (
						<div key={i} style={col({ position: "absolute", left: 0, top: i * PITCH, width: FELT.w, height: PITCH })}>
							<div style={{ display: "flex", width: FELT.w, height: PITCH - 5, backgroundImage: "linear-gradient(180deg, #1b1b1b 0%, #151515 100%)" }} />
							<div style={{ display: "flex", width: FELT.w, height: 4, backgroundColor: "#080808" }} />
							<div style={{ display: "flex", width: FELT.w, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
						</div>
					))}
					{/* Soft light falling from the upper left, and a vignette. */}
					<div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: FELT.w, height: FELT.h, backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 60%)" }} />
					<div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: FELT.w, height: FELT.h, backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />

					<div style={col({ position: "absolute", left: 0, top: 0, width: FELT.w, height: FELT.h, padding: `${PITCH * 2.5}px 56px ${PITCH * 2}px`, justifyContent: "space-between" })}>
						<div style={col({ alignItems: "center", gap: PITCH * 0.8 })}>
							<div
								data-edit="title"
								style={{ display: "flex", ...plastic, color: t.accent, fontWeight: 700, fontSize: headSize, letterSpacing: headSize * 0.16, lineHeight: `${headSize > 50 ? PITCH * 5 : PITCH * 3.5}px`, textAlign: "center", justifyContent: "center" }}
							>
								{spaced(heading)}
							</div>
							<div style={flex({ gap: 16, alignItems: "center" })}>
								<div style={{ display: "flex", width: 90, height: 5, backgroundColor: LETTER, boxShadow: "0 2px 0 rgba(0,0,0,0.9)" }} />
								<div style={{ display: "flex", width: 12, height: 12, transform: "rotate(45deg)", backgroundColor: t.accent, boxShadow: "0 2px 0 rgba(0,0,0,0.9)" }} />
								<div style={{ display: "flex", width: 90, height: 5, backgroundColor: LETTER, boxShadow: "0 2px 0 rgba(0,0,0,0.9)" }} />
							</div>
						</div>

						<div style={col({})}>
							{Array.from({ length: rows }, (_, i) => {
								const item = items[i]
								const text = item ? item.title.toUpperCase() : "·  ·  ·  ·  ·  ·"
								return (
									<div
										key={item?.key ?? `e${i}`}
										data-slot={item || editing ? i : undefined}
										style={flex({ alignItems: "center", height: rowH, gap: fs * 0.6, fontWeight: 700, fontSize: fs, letterSpacing: fs * 0.12, ...plastic })}
									>
										<div style={{ display: "flex", width: fs * 1.4, flexShrink: 0, justifyContent: "flex-end", color: t.accent }}>{String(i + 1)}</div>
										<div style={{ display: "flex", fontSize: fs, letterSpacing: fs * 0.12, color: item ? LETTER : alpha(LETTER, 0.3), whiteSpace: "nowrap" }}>{spaced(clip(text, 40))}</div>
									</div>
								)
							})}
						</div>

						<div style={flex({ justifyContent: "flex-end", fontWeight: 700, fontSize: 24, letterSpacing: 5, color: LETTER, ...plastic })}>
							<div data-edit="name" style={{ display: "flex" }}>{`— ${clip((name || "SOMEONE WITH TASTE").toUpperCase(), 22)}`}</div>
						</div>
					</div>
				</div>
			</div>

			<div style={flex({ position: "absolute", left: 0, top: BOARD.y + BOARD.h + 34, width: S, justifyContent: "center", alignItems: "center", gap: 24 })}>
				<Brand color={INK} size={36} />
				<div style={{ display: "flex", width: 2, height: 26, backgroundColor: alpha(INK, 0.3) }} />
				<div style={{ display: "flex", fontFamily: "Gabarito", fontWeight: 700, fontSize: 22, letterSpacing: 2, color: alpha(INK, 0.7) }}>goodwatch.app</div>
			</div>
		</div>
	)
}

export const letterboard: CardDesign = { key: "letterboard", name: "Letterboard", format: "Square 1:1", w: S, h: S, Card: LetterboardCard }
